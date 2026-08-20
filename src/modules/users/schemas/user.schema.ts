import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  // Direct, non-expiring URL under the bucket's public/ prefix — avatars are
  // rendered by <img> all over the UI, so a presigned URL per render would
  // mean an extra round trip and a link that dies after an hour.
  @Prop({ default: null })
  avatarUrl: string;

  // Object key backing avatarUrl. Kept so the previous avatar can be deleted
  // when a new one replaces it; never sent to clients.
  @Prop({ default: null, select: false, type: String })
  avatarKey: string | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: null })
  lastLoginAt: Date;

  @Prop({ default: null, select: false })
  passwordResetToken: string;

  @Prop({ default: null })
  passwordResetExpiresAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
