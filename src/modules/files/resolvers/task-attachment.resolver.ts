import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Request } from 'express';
import { AppConfigService } from '@config/config.service';
import { ProjectsService } from '@modules/projects/projects.service';
import { Task, TaskDocument } from '@modules/tasks/schemas/task.schema';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { toObjectId } from '@common/utils/object-id';
import {
  ALLOWED_MIME_TYPES,
  buildObjectKey,
  IncomingFile,
  UploadTarget,
  UploadTargetResolver,
  validateMultipartFields,
} from '@common/upload';
import { UploadFileDto } from '../dto/upload-file.dto';

/**
 * Upload policy for task attachments.
 *
 * Everything here runs while the file part is still unread, which is what
 * gives the endpoint its ordering guarantee: bad IDs, a missing task, a user
 * without access or a disallowed MIME type all fail before MinIO is touched.
 */
@Injectable()
export class TaskAttachmentResolver implements UploadTargetResolver {
  readonly allowedMimeTypes = ALLOWED_MIME_TYPES;

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly projectsService: ProjectsService,
    private readonly config: AppConfigService,
  ) {}

  get maxBytes(): number {
    return this.config.maxUploadBytes;
  }

  async resolve(req: Request, file: IncomingFile): Promise<UploadTarget> {
    // 3. validate workspace / project / task IDs
    const dto = validateMultipartFields(req.body, UploadFileDto, [
      'workspaceId',
      'projectId',
      'taskId',
    ]);

    const user = req.user as UserDocument;

    // permission — throws 404 if the project is gone, 403 if the user is not
    // a member of it (workspace membership is checked on the way through)
    const project = await this.projectsService.findOne(
      dto.workspaceId,
      dto.projectId,
      user,
    );

    // 4. validate the task exists inside that project
    const exists = await this.taskModel.exists({
      _id: toObjectId(dto.taskId),
      projectId: project._id,
      archivedAt: null,
    });
    if (!exists) throw new NotFoundException('Task not found');

    // 7. build object key —
    //    workspaceId/projectId/taskId/YYYY-MM-DD/timestamp_uuid.ext
    return {
      key: buildObjectKey(
        [dto.workspaceId, dto.projectId, dto.taskId],
        file.originalname,
        file.mimetype,
      ),
      metadata: {
        'uploaded-by': user._id.toString(),
        'task-id': dto.taskId,
      },
    };
  }
}
