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

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

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
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
