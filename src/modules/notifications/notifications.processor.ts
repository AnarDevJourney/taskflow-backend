import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { User, UserDocument } from '@modules/users/schemas/user.schema';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsScheduler } from './notifications.scheduler';
import { toObjectId } from '@common/utils/object-id';
import {
  JOB_CREATE_NOTIFICATION,
  JOB_SCAN_DUE_TASKS,
  NOTIFICATIONS_QUEUE,
} from './notifications.constants';
import { CreateNotificationJob } from './types/notification-job.interface';

// mongo duplicate-key error — expected whenever two scanner runs race on the
// same dedupeKey, never a reason to fail the job
const DUPLICATE_KEY = 11000;

/**
 * The consumer side of the notification pipeline: creates the Mongo
 * documents and pushes them to the recipients' websockets.
 *
 * Runs off the HTTP request path — the request that triggered the event has
 * already been answered by the time this executes.
 */
@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private gateway: NotificationsGateway,
    private scheduler: NotificationsScheduler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOB_CREATE_NOTIFICATION:
        return this.handleCreate(job.data as CreateNotificationJob);
      case JOB_SCAN_DUE_TASKS:
        return this.scheduler.scanDueTasks();
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }

  // ─── Create + push ───────────────────────────────────────────────
  private async handleCreate(data: CreateNotificationJob) {
    const recipientIds = await this.filterAlreadyNotified(data);
    if (recipientIds.length === 0) return { created: 0 };

    const actorId = data.actorId ? toObjectId(data.actorId) : null;

    const docs = recipientIds.map((recipientId) => ({
      recipientId: toObjectId(recipientId),
      actorId,
      type: data.type,
      titleKey: data.titleKey,
      titleParams: data.titleParams ?? {},
      bodyKey: data.bodyKey,
      bodyParams: data.bodyParams ?? {},
      link: data.link ?? null,
      taskId: data.taskId ? toObjectId(data.taskId) : null,
      projectId: data.projectId ? toObjectId(data.projectId) : null,
      workspaceId: data.workspaceId ? toObjectId(data.workspaceId) : null,
      dedupeKey: data.dedupeKey ?? null,
    }));

    const created = await this.insertTolerant(docs);
    if (created.length === 0) return { created: 0 };

    // the panel and the toast both render the actor's name/avatar, so send
    // the populated shape the REST endpoint returns instead of a bare id
    const actor = actorId
      ? await this.userModel
          .findById(actorId)
          .select('name email avatarUrl')
          .lean()
      : null;

    await Promise.all(
      created.map(async (doc) => {
        const recipientId = doc.recipientId.toString();
        const unreadCount = await this.notificationModel.countDocuments({
          recipientId: doc.recipientId,
          isRead: false,
        });

        this.gateway.pushNotification(
          recipientId,
          { ...doc.toObject(), actorId: actor },
          unreadCount,
        );
      }),
    );

    return { created: created.length };
  }

  // skips recipients that already have this dedupeKey (the due-soon /
  // overdue scanner re-runs every 15 minutes over the same tasks)
  private async filterAlreadyNotified(
    data: CreateNotificationJob,
  ): Promise<string[]> {
    if (!data.dedupeKey) return data.recipientIds;

    const existing = await this.notificationModel
      .find({
        dedupeKey: data.dedupeKey,
        recipientId: {
          $in: data.recipientIds.map((id) => toObjectId(id)),
        },
      })
      .select('recipientId')
      .lean();

    const seen = new Set(
      existing.map((n) => (n.recipientId as Types.ObjectId).toString()),
    );

    return data.recipientIds.filter((id) => !seen.has(id));
  }

  // insertMany that tolerates the unique-index collision two concurrent
  // scanner runs can produce, and returns only what was actually written
  private async insertTolerant(
    docs: Record<string, unknown>[],
  ): Promise<NotificationDocument[]> {
    try {
      return await this.notificationModel.insertMany(docs, { ordered: false });
    } catch (err) {
      const error = err as {
        code?: number;
        writeErrors?: { err?: { code?: number } }[];
        insertedDocs?: NotificationDocument[];
      };

      const onlyDuplicates =
        error.code === DUPLICATE_KEY ||
        error.writeErrors?.every((w) => w.err?.code === DUPLICATE_KEY);

      if (!onlyDuplicates) throw err;

      return error.insertedDocs ?? [];
    }
  }

  // ─── Worker events ───────────────────────────────────────────────
  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Job ${job?.name}#${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
    );
  }
}
