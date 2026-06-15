import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: UserDocument,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('unreadOnly') unreadOnly: string,
  ) {
    return this.notificationsService.findForUser(
      (user._id as any).toString(),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: UserDocument) {
    return this.notificationsService.getUnreadCount(
      (user._id as any).toString(),
    );
  }

  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.notificationsService.markAsRead(
      notificationId,
      (user._id as any).toString(),
    );
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() user: UserDocument) {
    return this.notificationsService.markAllAsRead(
      (user._id as any).toString(),
    );
  }
}
