import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ActivityAction } from '../enums/activity-action.enum';
import { ACTIVITY_MODULES, ActivityModule } from '../utils/activity-module.util';

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

  // stored (not derived at query time) so filtering by module is a plain
  // indexed equality match instead of an `action: { $in: [...] }` expansion.
  // Set automatically from `action` by ActivityService.log() via
  // getActivityModule() — callers never pass this explicitly. Keep
  // activity-module.util.ts's ACTION_MODULE_MAP in sync when adding a new
  // ActivityAction, or new actions will fail this enum check.
  @Prop({ required: true, enum: ACTIVITY_MODULES })
  module: ActivityModule;

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

  // request metadata — captured once at write time from requestContext
  // (populated per-request by RequestContextMiddleware), same as `module`.
  // null for activity logged outside an HTTP request (there is none today,
  // but nothing enforces there never will be).
  @Prop({ type: String, default: null })
  ip: string | null;

  // parsed from the raw User-Agent header via ua-parser-js — kept as three
  // separate plain strings (not the raw UA) so they're directly filterable/
  // displayable without re-parsing on every read
  @Prop({ type: String, default: null })
  browser: string | null;

  @Prop({ type: String, default: null })
  os: string | null;

  @Prop({ type: String, default: null })
  device: string | null;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

// most common query — get all activity for a task in chronological order
ActivityLogSchema.index({ taskId: 1, createdAt: -1 });

// for workspace-level audit trail
ActivityLogSchema.index({ workspaceId: 1, actorId: 1, createdAt: -1 });

// Activity Log page — filtering by module (and the workspace-wide feed in general)
ActivityLogSchema.index({ workspaceId: 1, module: 1, createdAt: -1 });
