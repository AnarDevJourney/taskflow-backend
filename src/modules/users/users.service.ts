import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MinioService } from '@common/storage/minio.service';
import { StreamedFile } from '@common/upload';
import { User, UserDocument } from './schemas/user.schema';

export interface AvatarResponse {
  avatarUrl: string | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly minio: MinioService,
  ) {}

  // ─── Set avatar ─────────────────────────────────────────────────
  // The image is already in MinIO by the time this runs — same streaming path
  // as task attachments, only the key prefix and the size ceiling differ.
  async setAvatar(
    file: StreamedFile,
    user: UserDocument,
  ): Promise<AvatarResponse> {
    const userId = user._id;
    const avatarUrl = this.minio.publicUrl(file.key);

    let previous: UserDocument | null = null;
    try {
      previous = await this.userModel
        .findByIdAndUpdate(
          userId,
          { avatarUrl, avatarKey: file.key },
          { new: false, projection: { avatarKey: 1 } },
        )
        .select('+avatarKey')
        .exec();

      if (!previous) throw new NotFoundException('User not found');
    } catch (err) {
      await this.minio.removeQuietly(file.key); // rollback
      throw err;
    }

    // Best-effort cleanup of the replaced image — losing it leaves an orphan,
    // not a broken profile, so it must not fail the request.
    if (previous.avatarKey && previous.avatarKey !== file.key) {
      await this.minio.removeQuietly(previous.avatarKey);
    }

    return { avatarUrl };
  }

  // ─── Remove avatar ──────────────────────────────────────────────
  async removeAvatar(user: UserDocument): Promise<void> {
    const userId = user._id;

    const current = await this.userModel
      .findById(userId)
      .select('+avatarKey')
      .lean()
      .exec();

    if (!current) throw new NotFoundException('User not found');
    if (!current.avatarKey) return;

    await this.userModel.updateOne(
      { _id: userId },
      { avatarUrl: null, avatarKey: null },
    );

    await this.minio.removeQuietly(current.avatarKey);
  }
}
