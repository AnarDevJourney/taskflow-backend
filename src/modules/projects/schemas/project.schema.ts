import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';

export type ProjectDocument = Project & Document;

// each column on the kanban board
export class StatusConfig {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  color: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: null })
  wipLimit: number;
}

@Schema({ _id: true })
export class ProjectMember {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: WorkspaceRole })
  role: WorkspaceRole;

  @Prop({ default: Date.now })
  joinedAt: Date;
}

export const ProjectMemberSchema = SchemaFactory.createForClass(ProjectMember);

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  // short uppercase prefix for task IDs e.g. "TF" → TF-1, TF-2
  @Prop({ required: true, uppercase: true, trim: true, maxlength: 6 })
  key: string;

  @Prop({ default: null })
  description: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId: Types.ObjectId;

  @Prop({ type: [ProjectMemberSchema], default: [] })
  members: ProjectMember[];

  // customizable kanban columns
  @Prop({
    type: [StatusConfig],
    default: [
      { name: 'To Do', color: '#6B7280', order: 0, wipLimit: null },
      { name: 'In Progress', color: '#3B82F6', order: 1, wipLimit: null },
      { name: 'In Review', color: '#F59E0B', order: 2, wipLimit: null },
      { name: 'Done', color: '#10B981', order: 3, wipLimit: null },
    ],
  })
  statuses: StatusConfig[];

  @Prop({ default: false })
  sprintMode: boolean;

  @Prop({ default: '#3B82F6' })
  color: string;

  @Prop({ default: null })
  icon: string;

  // task auto-increment counter e.g. TF-1, TF-2, TF-3
  @Prop({ default: 0 })
  taskCounter: number;

  @Prop({ default: null })
  archivedAt: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

ProjectSchema.index({ workspaceId: 1, archivedAt: 1 });
ProjectSchema.index({ workspaceId: 1, key: 1 }, { unique: true });
ProjectSchema.index({ 'members.userId': 1 });
