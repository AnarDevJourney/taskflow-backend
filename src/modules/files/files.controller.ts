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
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { Throttle } from '@common/decorators/throttle.decorator';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  // POST /files/upload — multipart/form-data
  @Throttle({ upload: { ttl: 3_600_000, limit: 20 } })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.filesService.upload(file, dto, user);
  }

  // GET /files/signed-url?key=workspaceId/projectId/taskId/filename
  @Get('signed-url')
  getSignedUrl(@Query('key') key: string) {
    return this.filesService.getSignedUrl(key);
  }

  // DELETE /files/:taskId?key=workspaceId/projectId/taskId/filename
  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('taskId') taskId: string,
    @Query('key') key: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.filesService.remove(taskId, key, user);
  }
}
