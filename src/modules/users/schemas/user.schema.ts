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

  @Prop({ default: null })
  avatarUrl: string;

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
