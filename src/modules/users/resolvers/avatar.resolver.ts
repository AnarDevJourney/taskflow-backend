import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '@config/config.service';
import { PUBLIC_PREFIX } from '@common/storage/storage.constants';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  buildObjectKey,
  IncomingFile,
  UploadTarget,
  UploadTargetResolver,
} from '@common/upload';
import { UserDocument } from '../schemas/user.schema';

/**
 * Upload policy for the current user's avatar. Permission is implicit — the
 * route only ever writes to the authenticated user's own key prefix.
 */
@Injectable()
export class AvatarResolver implements UploadTargetResolver {
  readonly allowedMimeTypes = ALLOWED_AVATAR_MIME_TYPES;

  constructor(private readonly config: AppConfigService) {}

  get maxBytes(): number {
    return this.config.maxImageUploadBytes;
  }

  resolve(req: Request, file: IncomingFile): Promise<UploadTarget> {
    const user = req.user as UserDocument;
    const userId = user._id.toString();

    return Promise.resolve({
      key: buildObjectKey(
        [PUBLIC_PREFIX, 'avatars', userId],
        file.originalname,
        file.mimetype,
      ),
      metadata: { 'uploaded-by': userId },
    });
  }
}
