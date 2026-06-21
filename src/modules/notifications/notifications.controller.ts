import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Notifications')
@ApiCookieAuth('cookie-access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user, newest first, paginated' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page (default 20)', example: 20 })
  @ApiQuery({ name: 'unreadOnly', required: false, description: 'Pass "true" to return only unread notifications', example: 'false' })
  @ApiResponse({ status: 200, description: 'Paginated notifications list' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @ApiOperation({ summary: 'Get the number of unread notifications for the current user' })
  @ApiResponse({ status: 200, description: 'Returns { count: number }' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getUnreadCount(@CurrentUser() user: UserDocument) {
    return this.notificationsService.getUnreadCount(
      (user._id as any).toString(),
    );
  }

  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'notificationId', description: 'MongoDB ObjectId of the notification' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @ApiOperation({ summary: 'Mark all notifications for the current user as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  markAllAsRead(@CurrentUser() user: UserDocument) {
    return this.notificationsService.markAllAsRead(
      (user._id as any).toString(),
    );
  }
}
