import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
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
import { UsersService } from './users.service';
import { AvatarResolver } from './resolvers/avatar.resolver';
import { UserDocument } from './schemas/user.schema';

@ApiTags('Users')
@ApiCookieAuth('cookie-access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── POST /users/me/avatar ──────────────────────────────────────
  @Throttle(UPLOAD_THROTTLE)
  @Post('me/avatar')
  @UseInterceptors(StreamingFileInterceptor('file', AvatarResolver))
  @ApiOperation({
    summary: "Upload the current user's avatar (rate-limited: 20/hour)",
    description:
      "Streamed straight into MinIO under the bucket's public prefix, so the returned URL can be used directly in <img src>. Replacing an avatar deletes the previous image.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Returns { avatarUrl }' })
  @ApiResponse({
    status: 400,
    description:
      'Not a JPEG/PNG/WebP image, or larger than MAX_IMAGE_UPLOAD_MB',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 429, description: 'Upload rate limit exceeded' })
  setAvatar(
    @StreamedFileMeta() file: StreamedFile,
    @CurrentUser() user: UserDocument,
  ) {
    return this.usersService.setAvatar(file, user);
  }

  // ─── DELETE /users/me/avatar ────────────────────────────────────
  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove the current user's avatar" })
  @ApiResponse({ status: 204, description: 'Avatar cleared' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  removeAvatar(@CurrentUser() user: UserDocument) {
    return this.usersService.removeAvatar(user);
  }
}
