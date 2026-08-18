import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  TASK_STATUS_CHANGED = 'task_status_changed',
  COMMENT_ADDED = 'comment_added',
  COMMENT_MENTION = 'comment_mention',
  SPRINT_STARTED = 'sprint_started',
  SPRINT_COMPLETED = 'sprint_completed',
  WORKSPACE_INVITE = 'workspace_invite',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  // who receives this notification
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  recipientId: Types.ObjectId;

  // who triggered it (null for system notifications like due-date alerts)
  @Prop({ default: null, type: Types.ObjectId, ref: 'User' })
  actorId: Types.ObjectId | null;

  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  // i18n message keys (see frontend's `notifications.messages.*` locale
  // entries) instead of literal English text — the client interpolates
  // `titleParams`/`bodyParams` into the key for the user's current language.
  // Not always 1:1 with `type` — e.g. TASK_ASSIGNED uses `taskAssignedSelf`
  // when the recipient assigned the task to themself.
  @Prop({ required: true })
  titleKey: string;

  @Prop({ type: Object, default: {} })
  titleParams: Record<string, string | number>;

  @Prop({ required: true })
  bodyKey: string;

  @Prop({ type: Object, default: {} })
  bodyParams: Record<string, string | number>;

  // deep link — frontend navigates here on click
  @Prop({ type: String, default: null })
  link: string | null;

  // related entities for context
  @Prop({ default: null, type: Types.ObjectId, ref: 'Task' })
  taskId: Types.ObjectId | null;

  @Prop({ default: null, type: Types.ObjectId, ref: 'Project' })
  projectId: Types.ObjectId | null;

  @Prop({ default: null, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId | null;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  // idempotency key for notifications produced by the recurring scanner
  // (due-soon / overdue). Null for regular event-driven notifications.
  @Prop({ type: String, default: null })
  dedupeKey: string | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

// guarantees the due-soon / overdue scanner can re-run every 15 minutes
// without ever writing the same notification twice — the worker inserts
// unordered and swallows the resulting duplicate-key errors
NotificationSchema.index(
  { recipientId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
  },
);
