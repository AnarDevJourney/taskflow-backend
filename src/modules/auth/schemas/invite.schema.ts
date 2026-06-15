import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';

export type InviteDocument = Invite & Document;

@Schema({ timestamps: true })
export class Invite {
  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, enum: WorkspaceRole })
  role: WorkspaceRole;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  invitedBy: Types.ObjectId;

  // MongoDB TTL index — auto-deletes document after this date
  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);
