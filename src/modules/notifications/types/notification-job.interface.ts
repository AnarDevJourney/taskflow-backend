import { NotificationType } from '../schemas/notification.schema';

// Payload of a JOB_CREATE_NOTIFICATION job. Everything is a plain string —
// jobs are JSON-serialised into Redis, so no ObjectId / Date instances here.
export interface CreateNotificationJob {
  // one event can target many people (watchers, project members, ...)
  recipientIds: string[];
  actorId?: string | null;
  type: NotificationType;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  link?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;

  // optional idempotency key — a notification with the same
  // (recipientId, dedupeKey) pair is written at most once. Used by the
  // due-soon / overdue scanner, which re-runs every 15 minutes.
  dedupeKey?: string | null;
}
