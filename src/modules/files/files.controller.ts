import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Throttle } from '@common/decorators/throttle.decorator';
import { UPLOAD_THROTTLE } from '@config/throttler.config';
import {
  StreamedFile,
  StreamedFileMeta,
  StreamingFileInterceptor,
} from '@common/upload';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { SignedUrlQueryDto } from './dto/signed-url-query.dto';
import { TaskAttachmentResolver } from './resolvers/task-attachment.resolver';

@ApiTags('Files')
@ApiCookieAuth('cookie-access-token')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ─── POST /files/upload ─────────────────────────────────────────
  @Throttle(UPLOAD_THROTTLE)
  @Post('upload')
  @UseInterceptors(StreamingFileInterceptor('file', TaskAttachmentResolver))
  @ApiOperation({
    summary:
      'Stream a file into object storage and attach it to a task (rate-limited: 20/hour)',
    description:
      'The file is piped straight from the multipart request into MinIO — it is never buffered in memory or written to disk. ' +
      'Append the text fields to the FormData **before** the file field: the request is parsed as it arrives, so fields that ' +
      'follow the file part are not available when the upload is validated.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', example: '507f1f77bcf86cd799439013' },
        projectId: { type: 'string', example: '507f1f77bcf86cd799439012' },
        taskId: { type: 'string', example: '507f1f77bcf86cd799439011' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['workspaceId', 'projectId', 'taskId', 'file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Attachment stored and linked to the task',
  })
  @ApiResponse({
    status: 400,
    description:
      'Unsupported MIME type, file too large, or malformed multipart body',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'No access to this project' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({
    status: 429,
    description: 'Upload rate limit exceeded (20 uploads/hour)',
  })
  @ApiResponse({
    status: 500,
    description: 'Object storage rejected the upload',
  })
  upload(
    @StreamedFileMeta() file: StreamedFile,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.filesService.attach(file, dto, user);
  }

  // ─── GET /files/signed-url?attachmentId=… ───────────────────────
  @Get('signed-url')
  @ApiOperation({
    summary: 'Get a temporary presigned URL for an attachment',
    description:
      'Downloads bypass the API entirely — the client fetches the object straight from MinIO with this URL.',
  })
  @ApiResponse({ status: 200, description: 'Returns { url, expiresIn }' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'No access to this attachment' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  getSignedUrl(
    @Query() query: SignedUrlQueryDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.filesService.getSignedUrl(
      query.attachmentId,
      user,
      query.download === 'true',
    );
  }

  // ─── DELETE /files/:attachmentId ────────────────────────────────
  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an attachment (uploader or workspace admin)',
  })
  @ApiParam({
    name: 'attachmentId',
    description: 'MongoDB ObjectId of the attachment',
  })
  @ApiResponse({
    status: 204,
    description: 'Removed from MinIO and from the task',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'Not the uploader and not a workspace admin',
  })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  remove(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.filesService.remove(attachmentId, user);
  }
}
