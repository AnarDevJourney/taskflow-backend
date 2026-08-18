import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';
import { toObjectId } from '@common/utils/object-id';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '@common/utils/pagination';
import {
  JOB_CREATE_NOTIFICATION,
  NOTIFICATIONS_QUEUE,
} from './notifications.constants';
import { CreateNotificationJob } from './types/notification-job.interface';

export interface NotifyParams {
  recipientIds: (string | Types.ObjectId)[];
  actorId?: string | Types.ObjectId | null;
  type: NotificationType;
  // i18n message keys + interpolation params — see `notifications.messages.*`
  // in the frontend locale files. Not literal text: the client translates.
  titleKey: string;
  titleParams?: Record<string, string | number>;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  link?: string | null;
  taskId?: string | Types.ObjectId | null;
  projectId?: string | Types.ObjectId | null;
  workspaceId?: string | Types.ObjectId | null;
  dedupeKey?: string | null;

  // by default the actor is removed from the recipients — you are not told
  // about your own action. Set this for the few events where you are: a
  // self-assigned task is still a task landing in your inbox.
  includeActor?: boolean;
}

/**
 * Public notification API for the rest of the app.
 *
 * Nothing here writes to Mongo or touches the socket server: `notify*` only
 * pushes a job onto the BullMQ queue (a single Redis round-trip) and returns.
 * NotificationsProcessor picks the job up, creates the documents and pushes
 * them over the websocket — so a slow fan-out never delays the HTTP request
 * that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private queue: Queue<CreateNotificationJob>,
    private gateway: NotificationsGateway,
  ) {}

  // ─── Enqueue ─────────────────────────────────────────────────────
  // never throws: a notification is not worth failing the caller's request
  async notify(params: NotifyParams): Promise<void> {
    const actorId = params.actorId ? params.actorId.toString() : null;

    // dedupe recipients and, unless the event opts in, drop the actor so
    // nobody is notified about their own action
    const recipientIds = [
      ...new Set(params.recipientIds.map((id) => id.toString())),
    ].filter((id) => params.includeActor || id !== actorId);

    if (recipientIds.length === 0) return;

    const job: CreateNotificationJob = {
      recipientIds,
      actorId,
      type: params.type,
      titleKey: params.titleKey,
      titleParams: params.titleParams ?? {},
      bodyKey: params.bodyKey,
      bodyParams: params.bodyParams ?? {},
      link: params.link ?? null,
      taskId: params.taskId?.toString() ?? null,
      projectId: params.projectId?.toString() ?? null,
      workspaceId: params.workspaceId?.toString() ?? null,
      dedupeKey: params.dedupeKey ?? null,
    };

    try {
      await this.queue.add(JOB_CREATE_NOTIFICATION, job);
    } catch (err) {
      this.logger.error(
        `Failed to enqueue ${params.type} notification for ${recipientIds.length} recipient(s)`,
        err as Error,
      );
    }
  }

  // ─── Read API ────────────────────────────────────────────────────
  async findForUser(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      isRead?: boolean;
      type?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ): Promise<PaginatedResult<NotificationDocument>> {
    const { page = 1, limit = 20, unreadOnly = false, isRead, type, dateFrom, dateTo } = query;

    const filter: Record<string, any> = { recipientId: toObjectId(userId) };
    // `isRead` (used by the Notifications table page) takes precedence over
    // the older `unreadOnly` flag (used by the bell panel) when both are set
    if (isRead !== undefined) filter.isRead = isRead;
    else if (unreadOnly) filter.isRead = false;

    if (type) filter.type = type;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const { skip, limit: take } = getPaginationParams({ page, limit });

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('actorId', 'name email avatarUrl'),
      this.notificationModel.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, page, take) };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.countUnread(userId);
    return { count };
  }

  // ─── Mark as read ────────────────────────────────────────────────
  // pushes the new count to the user's other tabs so every open bell agrees
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationModel.findOneAndUpdate(
      { _id: toObjectId(notificationId), recipientId: toObjectId(userId) },
      { isRead: true, readAt: new Date() },
    );
    this.gateway.pushUnreadCount(userId, await this.countUnread(userId));
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { recipientId: toObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
    this.gateway.pushUnreadCount(userId, 0);
  }

  // ─── Pre-built triggers ──────────────────────────────────────────
  // one method per domain event — call sites stay free of copy/link/type
  // details, and the wording of a notification lives in exactly one place

  async notifyTaskAssigned(params: {
    recipientId: string;
    actorId: string;
    actorName: string;
    taskId: string;
    taskKey: string;
    taskTitle: string;
    projectId: string;
    workspaceId: string;
    taskUrl: string;
  }) {
    const isSelfAssignment = params.recipientId === params.actorId;

    await this.notify({
      recipientIds: [params.recipientId],
      actorId: params.actorId,
      // assigning a task to yourself still produces a notification
      includeActor: true,
      type: NotificationType.TASK_ASSIGNED,
      titleKey: isSelfAssignment ? 'taskAssignedSelf' : 'taskAssigned',
      titleParams: { actorName: params.actorName },
      bodyKey: 'taskAssigned',
      bodyParams: { taskKey: params.taskKey, taskTitle: params.taskTitle },
      link: params.taskUrl,
      taskId: params.taskId,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  async notifyTaskStatusChanged(params: {
    recipientIds: string[];
    actorId: string;
    actorName: string;
    taskId: string;
    taskKey: string;
    taskTitle: string;
    projectId: string;
    workspaceId: string;
    oldStatus: string;
    newStatus: string;
    taskUrl: string;
  }) {
    await this.notify({
      recipientIds: params.recipientIds,
      actorId: params.actorId,
      type: NotificationType.TASK_STATUS_CHANGED,
      titleKey: 'taskStatusChanged',
      titleParams: {
        actorName: params.actorName,
        taskKey: params.taskKey,
        newStatus: params.newStatus,
      },
      bodyKey: 'taskStatusChanged',
      bodyParams: {
        taskTitle: params.taskTitle,
        oldStatus: params.oldStatus,
        newStatus: params.newStatus,
      },
      link: params.taskUrl,
      taskId: params.taskId,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  async notifyCommentMention(params: {
    recipientIds: string[];
    actorId: string;
    actorName: string;
    taskId: string;
    taskKey: string;
    projectId: string;
    workspaceId: string;
    commentSnippet: string;
    taskUrl: string;
  }) {
    await this.notify({
      recipientIds: params.recipientIds,
      actorId: params.actorId,
      type: NotificationType.COMMENT_MENTION,
      titleKey: 'commentMention',
      titleParams: { actorName: params.actorName },
      bodyKey: 'commentMention',
      bodyParams: {
        taskKey: params.taskKey,
        commentSnippet: params.commentSnippet,
      },
      link: params.taskUrl,
      taskId: params.taskId,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  async notifyCommentAdded(params: {
    recipientIds: string[];
    actorId: string;
    actorName: string;
    taskId: string;
    taskKey: string;
    projectId: string;
    workspaceId: string;
    commentSnippet: string;
    taskUrl: string;
  }) {
    await this.notify({
      recipientIds: params.recipientIds,
      actorId: params.actorId,
      type: NotificationType.COMMENT_ADDED,
      titleKey: 'commentAdded',
      titleParams: { actorName: params.actorName, taskKey: params.taskKey },
      bodyKey: 'commentAdded',
      bodyParams: { commentSnippet: params.commentSnippet },
      link: params.taskUrl,
      taskId: params.taskId,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  async notifySprintStarted(params: {
    recipientIds: string[];
    actorId: string;
    actorName: string;
    sprintName: string;
    projectId: string;
    projectName: string;
    workspaceId: string;
    sprintUrl: string;
  }) {
    await this.notify({
      recipientIds: params.recipientIds,
      actorId: params.actorId,
      type: NotificationType.SPRINT_STARTED,
      titleKey: 'sprintStarted',
      titleParams: { sprintName: params.sprintName },
      bodyKey: 'sprintStarted',
      bodyParams: {
        actorName: params.actorName,
        projectName: params.projectName,
      },
      link: params.sprintUrl,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  async notifySprintCompleted(params: {
    recipientIds: string[];
    actorId: string;
    actorName: string;
    sprintName: string;
    projectId: string;
    projectName: string;
    workspaceId: string;
    completedPoints: number;
    totalPoints: number;
    sprintUrl: string;
  }) {
    await this.notify({
      recipientIds: params.recipientIds,
      actorId: params.actorId,
      type: NotificationType.SPRINT_COMPLETED,
      titleKey: 'sprintCompleted',
      titleParams: { sprintName: params.sprintName },
      bodyKey: 'sprintCompleted',
      bodyParams: {
        completedPoints: params.completedPoints,
        totalPoints: params.totalPoints,
        projectName: params.projectName,
      },
      link: params.sprintUrl,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  async notifyWorkspaceInvite(params: {
    recipientId: string;
    actorId: string;
    actorName: string;
    workspaceId: string;
    workspaceName: string;
    role: string;
    inviteUrl: string;
  }) {
    await this.notify({
      recipientIds: [params.recipientId],
      actorId: params.actorId,
      type: NotificationType.WORKSPACE_INVITE,
      titleKey: 'workspaceInvite',
      titleParams: {
        actorName: params.actorName,
        workspaceName: params.workspaceName,
      },
      bodyKey: 'workspaceInvite',
      bodyParams: { role: params.role },
      link: params.inviteUrl,
      workspaceId: params.workspaceId,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  private countUnread(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientId: toObjectId(userId),
      isRead: false,
    });
  }
}
