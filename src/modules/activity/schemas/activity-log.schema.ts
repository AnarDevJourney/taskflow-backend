import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ActivityAction } from '../enums/activity-action.enum';

export type ActivityLogDocument = ActivityLog & Document;

@Schema({
  timestamps: { createdAt: true, updatedAt: false }, // immutable — no updates ever
})
export class ActivityLog {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Task' })
  taskId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Project' })
  projectId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  actorId: Types.ObjectId;

  @Prop({ required: true, enum: ActivityAction })
  action: ActivityAction;

  // which field changed — null for created/deleted actions
  @Prop({ type: String, default: null })
  field: string | null;

  // before/after values — stored as strings for simplicity
  @Prop({ default: null, type: Object })
  oldValue: any;

  @Prop({ default: null, type: Object })
  newValue: any;

  // for comment actions — stores comment body snippet
  @Prop({ type: String, default: null })
  meta: string | null;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

// most common query — get all activity for a task in chronological order
ActivityLogSchema.index({ taskId: 1, createdAt: -1 });

// for workspace-level audit trail
ActivityLogSchema.index({ workspaceId: 1, actorId: 1, createdAt: -1 });
