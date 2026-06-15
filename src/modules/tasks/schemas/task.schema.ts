import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Priority } from '../enums/priority.enum';
import { TaskLinkType } from '../enums/task-link-type.enum';

export type TaskDocument = Task & Document;

export class ChecklistItem {
  @Prop({ required: true })
  title: string;

  @Prop({ default: false })
  completed: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export class TaskLink {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Task' })
  taskId: Types.ObjectId;

  @Prop({ required: true, enum: TaskLinkType })
  type: TaskLinkType;
}

export class Attachment {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  key: string; // MinIO object key

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number; // bytes

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  uploadedBy: Types.ObjectId;

  @Prop({ default: Date.now })
  uploadedAt: Date;
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Project' })
  projectId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId;

  // human-readable ID e.g. TF-42
  @Prop({ required: true })
  taskNumber: number;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ default: null, type: String })
  description: string | null;

  @Prop({ required: true })
  status: string; // matches one of project.statuses[].name

  @Prop({ required: true, enum: Priority, default: Priority.MEDIUM })
  priority: Priority;

  @Prop({ default: null, type: Types.ObjectId, ref: 'User' })
  assigneeId: Types.ObjectId | null;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  reporterId: Types.ObjectId;

  @Prop({ default: null, type: Date })
  dueDate: Date | null;

  @Prop({ type: [String], default: [] })
  labels: string[];

  @Prop({ default: null, type: Number })
  storyPoints: number | null;

  // sort order within a kanban column
  @Prop({ default: 0 })
  order: number;

  @Prop({ default: null, type: Types.ObjectId, ref: 'Sprint' })
  sprintId: Types.ObjectId | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  watchers: Types.ObjectId[];

  @Prop({ type: [Attachment], default: [] })
  attachments: Attachment[];

  @Prop({ type: [ChecklistItem], default: [] })
  checklist: ChecklistItem[];

  @Prop({ type: [TaskLink], default: [] })
  links: TaskLink[];

  @Prop({ default: null, type: Date })
  archivedAt: Date | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// compound index for listing tasks in a project fast
TaskSchema.index({ projectId: 1, status: 1, order: 1 });

// index for filtering by assignee across projects
TaskSchema.index({ workspaceId: 1, assigneeId: 1 });

// index for sprint board
TaskSchema.index({ sprintId: 1, status: 1 });

// index for due date alerts
TaskSchema.index({ assigneeId: 1, dueDate: 1 });

// text index for search
TaskSchema.index({ title: 'text', description: 'text' });
