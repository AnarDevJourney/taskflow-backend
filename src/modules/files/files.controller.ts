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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { Throttle } from '@common/decorators/throttle.decorator';

@ApiTags('Files')
@ApiCookieAuth('cookie-access-token')
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  // POST /files/upload — multipart/form-data
  @Throttle({ upload: { ttl: 3_600_000, limit: 20 } })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file attachment and attach it to a task (rate-limited: 20/hour)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Multipart upload — file field plus task/project/workspace IDs as form fields',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'File to upload (max 50 MB by default)' },
        taskId: { type: 'string', description: 'MongoDB ObjectId of the task to attach to', example: '507f1f77bcf86cd799439011' },
        projectId: { type: 'string', description: 'MongoDB ObjectId of the project', example: '507f1f77bcf86cd799439012' },
        workspaceId: { type: 'string', description: 'MongoDB ObjectId of the workspace', example: '507f1f77bcf86cd799439013' },
      },
      required: ['file', 'taskId', 'projectId', 'workspaceId'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded to MinIO — attachment record added to task' })
  @ApiResponse({ status: 400, description: 'Unsupported MIME type or file exceeds size limit' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 429, description: 'Upload rate limit exceeded (20 uploads/hour)' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.filesService.upload(file, dto, user);
  }

  // GET /files/signed-url?key=workspaceId/projectId/taskId/filename
  @Get('signed-url')
  @ApiOperation({ summary: 'Get a temporary pre-signed MinIO URL to download a file (valid 1 hour)' })
  @ApiQuery({ name: 'key', description: 'Object storage key in the format workspaceId/projectId/taskId/timestamp-filename', example: '507f1.../507f1.../507f1.../1719000000000-report.pdf' })
  @ApiResponse({ status: 200, description: 'Returns { url: string } — URL is valid for 1 hour' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'File not found in storage' })
  getSignedUrl(@Query('key') key: string) {
    return this.filesService.getSignedUrl(key);
  }

  // DELETE /files/:taskId?key=workspaceId/projectId/taskId/filename
  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file attachment from a task (uploader only)' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task the file is attached to' })
  @ApiQuery({ name: 'key', description: 'Object storage key of the file to delete', example: '507f1.../507f1.../507f1.../1719000000000-report.pdf' })
  @ApiResponse({ status: 200, description: 'File removed from MinIO and from the task attachments array' })
  @ApiResponse({ status: 400, description: 'Can only delete your own attachments' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Task or attachment not found' })
  remove(
    @Param('taskId') taskId: string,
    @Query('key') key: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.filesService.remove(taskId, key, user);
  }
}
