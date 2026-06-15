import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from './email.service';
import { toObjectId } from '@common/utils/object-id';
import {
  buildPaginationMeta,
  getPaginationParams,
  PaginatedResult,
} from '@common/utils/pagination';

export interface CreateNotificationParams {
  recipientId: string | Types.ObjectId;
  actorId?: string | Types.ObjectId | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  taskId?: string | Types.ObjectId;
  projectId?: string | Types.ObjectId;
  workspaceId?: string | Types.ObjectId;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private gateway: NotificationsGateway,
    private emailService: EmailService,
  ) {}

  // ─── Create & push ───────────────────────────────────────────────
  // fire-and-forget — called by other services, never throws
  async notify(params: CreateNotificationParams): Promise<void> {
    try {
      const notification = await this.notificationModel.create({
        recipientId: this.toObjId(params.recipientId),
        actorId: params.actorId ? this.toObjId(params.actorId) : null,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link ?? null,
        taskId: params.taskId ? this.toObjId(params.taskId) : null,
        projectId: params.projectId ? this.toObjId(params.projectId) : null,
        workspaceId: params.workspaceId
          ? this.toObjId(params.workspaceId)
          : null,
      });

      // push real-time if user is online
      this.gateway.pushToUser(params.recipientId.toString(), notification);
    } catch (err) {
      console.error('[NotificationsService] Failed to notify:', err);
    }
  }

  // ─── Bulk notify ─────────────────────────────────────────────────
  // notify multiple recipients at once e.g. all task watchers
  async notifyMany(
    recipientIds: (string | Types.ObjectId)[],
    params: Omit<CreateNotificationParams, 'recipientId'>,
  ): Promise<void> {
    await Promise.all(
      recipientIds.map((recipientId) =>
        this.notify({ ...params, recipientId }),
      ),
    );
  }

  // ─── Get notifications for current user ──────────────────────────
  async findForUser(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<PaginatedResult<NotificationDocument>> {
    const filter: Record<string, any> = {
      recipientId: toObjectId(userId),
    };

    if (unreadOnly) filter.isRead = false;

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

  // ─── Unread count ────────────────────────────────────────────────
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationModel.countDocuments({
      recipientId: toObjectId(userId),
      isRead: false,
    });
    return { count };
  }

  // ─── Mark as read ────────────────────────────────────────────────
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationModel.findOneAndUpdate(
      {
        _id: toObjectId(notificationId),
        recipientId: toObjectId(userId),
      },
      { isRead: true, readAt: new Date() },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { recipientId: toObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  // ─── Pre-built notification triggers ────────────────────────────
  // called by TasksService when a task is assigned
  async notifyTaskAssigned(params: {
    recipientId: string;
    actorId: string;
    actorName: string;
    taskId: string;
    taskKey: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    workspaceId: string;
    taskUrl: string;
  }) {
    await this.notify({
      recipientId: params.recipientId,
      actorId: params.actorId,
      type: NotificationType.TASK_ASSIGNED,
      title: `${params.actorName} assigned you a task`,
      body: `${params.taskKey} — ${params.taskTitle}`,
      link: params.taskUrl,
      taskId: params.taskId,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  // called by CommentsService when a comment mentions users
  async notifyCommentMention(params: {
    recipientIds: string[];
    actorId: string;
    actorName: string;
    taskId: string;
    taskKey: string;
    taskTitle: string;
    projectId: string;
    workspaceId: string;
    commentSnippet: string;
    taskUrl: string;
  }) {
    await this.notifyMany(params.recipientIds, {
      actorId: params.actorId,
      type: NotificationType.COMMENT_MENTION,
      title: `${params.actorName} mentioned you`,
      body: `In ${params.taskKey}: "${params.commentSnippet}"`,
      link: params.taskUrl,
      taskId: params.taskId,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  // called by CommentsService for task watchers
  async notifyCommentAdded(params: {
    recipientIds: string[];
    actorId: string;
    actorName: string;
    taskId: string;
    taskKey: string;
    taskTitle: string;
    projectId: string;
    workspaceId: string;
    commentSnippet: string;
    taskUrl: string;
  }) {
    await this.notifyMany(params.recipientIds, {
      actorId: params.actorId,
      type: NotificationType.COMMENT_ADDED,
      title: `${params.actorName} commented on ${params.taskKey}`,
      body: params.commentSnippet,
      link: params.taskUrl,
      taskId: params.taskId,
      projectId: params.projectId,
      workspaceId: params.workspaceId,
    });
  }

  // ─── Helper ──────────────────────────────────────────────────────
  private toObjId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return toObjectId(id);
  }
}
