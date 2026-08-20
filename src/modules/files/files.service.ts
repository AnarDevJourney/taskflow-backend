import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MinioService } from '@common/storage/minio.service';
import { AppConfigService } from '@config/config.service';
import { sanitizeFilename, StreamedFile } from '@common/upload';
import { toObjectId } from '@common/utils/object-id';
import { ActivityService } from '@modules/activity/activity.service';
import { ActivityAction } from '@modules/activity/enums/activity-action.enum';
import { ProjectsService } from '@modules/projects/projects.service';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';
import {
  Attachment,
  Task,
  TaskDocument,
} from '@modules/tasks/schemas/task.schema';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { UploadFileDto } from './dto/upload-file.dto';
import { AttachmentResponse } from './files.types';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly minio: MinioService,
    private readonly config: AppConfigService,
    private readonly projectsService: ProjectsService,
    private readonly workspacesService: WorkspacesService,
    private readonly activityService: ActivityService,
  ) {}

  // ─── Upload ─────────────────────────────────────────────────────
  // By the time this runs the bytes are already in MinIO: the interceptor's
  // resolver validated the request and streamed the body straight through.
  // All that is left is the metadata write — and undoing the upload if it fails.
  async attach(
    file: StreamedFile,
    dto: UploadFileDto,
    user: UserDocument,
  ): Promise<AttachmentResponse> {
    const uploaderId = user._id;

    const attachment = {
      _id: new Types.ObjectId(),
      filename: sanitizeFilename(file.originalname),
      originalName: file.originalname,
      key: file.key,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: uploaderId,
      uploadedAt: new Date(),
    };

    try {
      const updated = await this.taskModel.findOneAndUpdate(
        {
          _id: toObjectId(dto.taskId),
          projectId: toObjectId(dto.projectId),
          workspaceId: toObjectId(dto.workspaceId),
          archivedAt: null,
        },
        { $push: { attachments: attachment } },
        { new: true, projection: { _id: 1 } },
      );

      // The task was validated before the upload started, so reaching this
      // means it was archived or deleted mid-flight.
      if (!updated) throw new NotFoundException('Task not found');
    } catch (err) {
      // Rollback: metadata never landed, so the object must not survive.
      await this.minio.removeQuietly(file.key);
      throw err;
    }

    await this.activityService.log({
      taskId: dto.taskId,
      projectId: dto.projectId,
      workspaceId: dto.workspaceId,
      actorId: uploaderId,
      action: ActivityAction.ATTACHMENT_ADDED,
      newValue: attachment.filename,
      meta: attachment.key,
    });

    this.logger.log(
      `Attachment stored: ${attachment.key} (${file.size} bytes)`,
    );

    return this.toResponse(attachment);
  }

  // ─── Signed URL ─────────────────────────────────────────────────
  async getSignedUrl(
    attachmentId: string,
    user: UserDocument,
    forceDownload = false,
  ): Promise<{ url: string; expiresIn: number }> {
    const { attachment } = await this.findAttachmentForUser(attachmentId, user);

    const url = await this.minio.presignedGetUrl(
      attachment.key,
      this.config.presignedUrlExpiry,
      forceDownload ? attachment.filename : undefined,
    );

    return { url, expiresIn: this.config.presignedUrlExpiry };
  }

  // ─── Delete ─────────────────────────────────────────────────────
  async remove(attachmentId: string, user: UserDocument): Promise<void> {
    const { task, attachment } = await this.findAttachmentForUser(
      attachmentId,
      user,
    );

    await this.assertCanDelete(task, attachment, user);

    // Storage first: if this fails the metadata still points at a real object,
    // which is recoverable. The reverse order would leave an unreferenced blob.
    await this.minio.removeObject(attachment.key);

    await this.taskModel.updateOne(
      { _id: task._id },
      { $pull: { attachments: { _id: attachment._id } } },
    );

    await this.activityService.log({
      taskId: task._id,
      projectId: task.projectId,
      workspaceId: task.workspaceId,
      actorId: user._id,
      action: ActivityAction.ATTACHMENT_REMOVED,
      oldValue: attachment.filename,
      meta: attachment.key,
    });
  }

  // ─── Internals ──────────────────────────────────────────────────

  /** Locates an attachment by its own id and asserts read access to it. */
  private async findAttachmentForUser(
    attachmentId: string,
    user: UserDocument,
  ): Promise<{
    task: TaskDocument;
    attachment: Attachment & { _id: Types.ObjectId };
  }> {
    const attachmentObjectId = toObjectId(attachmentId);

    const task = await this.taskModel.findOne({
      'attachments._id': attachmentObjectId,
      archivedAt: null,
    });

    if (!task) throw new NotFoundException('Attachment not found');

    const attachment = task.attachments.find(
      (a) =>
        (a as Attachment & { _id: Types.ObjectId })._id.toString() ===
        attachmentObjectId.toString(),
    ) as (Attachment & { _id: Types.ObjectId }) | undefined;

    if (!attachment) throw new NotFoundException('Attachment not found');

    // throws 403 when the user cannot see the project the task lives in
    await this.projectsService.findOne(
      task.workspaceId.toString(),
      task.projectId.toString(),
      user,
    );

    return { task, attachment };
  }

  /** Uploader, or a workspace owner/admin cleaning up after someone else. */
  private async assertCanDelete(
    task: TaskDocument,
    attachment: Attachment,
    user: UserDocument,
  ): Promise<void> {
    const userId = user._id.toString();
    if (attachment.uploadedBy.toString() === userId) return;

    const workspace = await this.workspacesService.findOne(
      task.workspaceId.toString(),
      user,
    );
    const role = this.workspacesService.getMemberRole(workspace, user);

    if (role !== WorkspaceRole.OWNER && role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException(
        'Only the uploader or a workspace admin can delete this attachment',
      );
    }
  }

  private toResponse(
    attachment: Attachment & { _id: Types.ObjectId },
  ): AttachmentResponse {
    return {
      id: attachment._id.toString(),
      filename: attachment.filename,
      // pre-dates the originalName field — see the NOTE on the schema
      originalName: attachment.originalName ?? attachment.filename,
      key: attachment.key,
      mimeType: attachment.mimeType,
      size: attachment.size,
      uploadedBy: attachment.uploadedBy.toString(),
      uploadedAt: attachment.uploadedAt,
    };
  }
}
