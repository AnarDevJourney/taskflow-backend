import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Task' })
  taskId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Project' })
  projectId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  body: string;

  // parsed @mentions — array of user IDs extracted from body
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  mentions: Types.ObjectId[];

  @Prop({ type: Date, default: null })
  editedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ taskId: 1, createdAt: 1 });
CommentSchema.index({ authorId: 1 });
