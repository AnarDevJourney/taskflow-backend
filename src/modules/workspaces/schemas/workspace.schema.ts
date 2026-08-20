import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export type WorkspaceDocument = Workspace & Document;

@Schema({ _id: true })
export class WorkspaceMember {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: WorkspaceRole })
  role: WorkspaceRole;

  @Prop({ default: Date.now })
  joinedAt: Date;
}

export const WorkspaceMemberSchema = SchemaFactory.createForClass(WorkspaceMember);

@Schema({ timestamps: true })
export class Workspace {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ default: null })
  description: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId: Types.ObjectId;

  @Prop({ type: [WorkspaceMemberSchema], default: [] })
  members: WorkspaceMember[];

  // Direct, non-expiring URL under the bucket's public/ prefix — see the
  // same note on User.avatarUrl.
  @Prop({ default: null })
  logoUrl: string;

  // Object key backing logoUrl, kept so a replaced logo can be deleted.
  @Prop({ default: null, select: false, type: String })
  logoKey: string | null;

  @Prop({ default: null })
  archivedAt: Date;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);

// index to find all workspaces a user belongs to
WorkspaceSchema.index({ 'members.userId': 1 });
