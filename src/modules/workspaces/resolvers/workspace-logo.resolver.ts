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
import { UserDocument } from '@modules/users/schemas/user.schema';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspacesService } from '../workspaces.service';

/**
 * Upload policy for a workspace logo. The workspace id comes from the route,
 * not the body, so there is no multipart field-ordering concern here.
 */
@Injectable()
export class WorkspaceLogoResolver implements UploadTargetResolver {
  readonly allowedMimeTypes = ALLOWED_AVATAR_MIME_TYPES;

  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly config: AppConfigService,
  ) {}

  get maxBytes(): number {
    return this.config.maxImageUploadBytes;
  }

  async resolve(req: Request, file: IncomingFile): Promise<UploadTarget> {
    const workspaceId = String(req.params.workspaceId);
    const user = req.user as UserDocument;

    // 404 if it does not exist, 403 if the user is not a member…
    const workspace = await this.workspacesService.findOne(workspaceId, user);
    // …and 403 again if they are a member without the rank to rebrand it
    this.workspacesService.assertRole(workspace, user, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    return {
      key: buildObjectKey(
        [PUBLIC_PREFIX, 'workspace-logos', workspaceId],
        file.originalname,
        file.mimetype,
      ),
      metadata: { 'workspace-id': workspaceId },
    };
  }
}
