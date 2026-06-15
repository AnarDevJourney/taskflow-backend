import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as Minio from 'minio';
import { AppConfigService } from '@config/config.service';
import { Task, TaskDocument } from '@modules/tasks/schemas/task.schema';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { toObjectId } from '@common/utils/object-id';
import { UploadFileDto } from './dto/upload-file.dto';

// allowed mime types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
];

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private minioClient: Minio.Client;
  private bucket: string;

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private config: AppConfigService,
  ) {
    this.bucket = this.config.minioBucket;

    this.minioClient = new Minio.Client({
      endPoint: this.config.minioEndpoint,
      port: this.config.minioPort,
      useSSL: this.config.isProduction,
      accessKey: this.config.minioAccessKey,
      secretKey: this.config.minioSecretKey,
    });
  }

  // ─── Ensure bucket exists on startup ────────────────────────────
  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
        this.logger.log(`MinIO bucket created: ${this.bucket}`);
      } else {
        this.logger.log(`MinIO bucket ready: ${this.bucket}`);
      }
    } catch (err) {
      this.logger.error('MinIO connection failed:', err);
    }
  }

  // ─── Upload ─────────────────────────────────────────────────────
  async upload(
    file: Express.Multer.File,
    dto: UploadFileDto,
    user: UserDocument,
  ) {
    // validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type not allowed: ${file.mimetype}`);
    }

    // validate file size
    const maxBytes = this.config.maxUploadBytes;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Max size is ${maxBytes / 1024 / 1024}MB`,
      );
    }

    const task = await this.taskModel.findOne({
      _id: toObjectId(dto.taskId),
      projectId: toObjectId(dto.projectId),
      archivedAt: null,
    });

    if (!task) throw new NotFoundException('Task not found');

    // build unique object key: workspaceId/projectId/taskId/timestamp-filename
    const key = `${dto.workspaceId}/${dto.projectId}/${dto.taskId}/${Date.now()}-${file.originalname}`;

    // upload to MinIO
    await this.minioClient.putObject(this.bucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    // push attachment record onto task
    const attachment = {
      filename: file.originalname,
      key,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: user._id as Types.ObjectId,
      uploadedAt: new Date(),
    };

    await this.taskModel.findByIdAndUpdate(task._id, {
      $push: { attachments: attachment },
    });

    this.logger.log(`File uploaded: ${key}`);

    return {
      filename: file.originalname,
      key,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: attachment.uploadedAt,
    };
  }

  // ─── Get signed URL ──────────────────────────────────────────────
  // returns a temporary URL valid for 1 hour
  async getSignedUrl(key: string): Promise<{ url: string }> {
    try {
      const url = await this.minioClient.presignedGetObject(
        this.bucket,
        key,
        60 * 60, // 1 hour in seconds
      );
      return { url };
    } catch {
      throw new NotFoundException('File not found');
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────
  async remove(taskId: string, attachmentKey: string, user: UserDocument) {
    const task = await this.taskModel.findOne({
      _id: toObjectId(taskId),
      archivedAt: null,
    });

    if (!task) throw new NotFoundException('Task not found');

    const attachment = task.attachments.find((a) => a.key === attachmentKey);

    if (!attachment) throw new NotFoundException('Attachment not found');

    // only uploader or admin can delete
    const userId = (user._id as Types.ObjectId).toString();
    const isUploader = attachment.uploadedBy.toString() === userId;

    if (!isUploader) {
      throw new BadRequestException('You can only delete your own attachments');
    }

    // remove from MinIO
    await this.minioClient.removeObject(this.bucket, attachmentKey);

    // remove from task attachments array
    await this.taskModel.findByIdAndUpdate(task._id, {
      $pull: { attachments: { key: attachmentKey } },
    });

    return { message: 'Attachment deleted' };
  }
}
