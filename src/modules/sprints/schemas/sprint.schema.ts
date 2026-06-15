import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SprintDocument = Sprint & Document;

export enum SprintStatus {
  PLANNED = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class Sprint {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Project' })
  projectId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ type: String, default: null })
  goal: string | null;

  @Prop({ required: true, enum: SprintStatus, default: SprintStatus.PLANNED })
  status: SprintStatus;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  // story points snapshot taken when sprint is completed
  @Prop({ type: Number, default: null })
  totalPoints: number | null;

  @Prop({ type: Number, default: null })
  completedPoints: number | null;
}

export const SprintSchema = SchemaFactory.createForClass(Sprint);

SprintSchema.index({ projectId: 1, status: 1 });
SprintSchema.index({ projectId: 1, startDate: -1 });
