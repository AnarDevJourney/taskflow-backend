import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Activity')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces/:workspaceId/projects/:projectId')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  // GET activity for a specific task
  @Get('tasks/:taskId/activity')
  @ApiOperation({ summary: 'Get the activity log for a specific task, newest first, paginated' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page (default 30)', example: 30 })
  @ApiResponse({ status: 200, description: 'Paginated activity log with actor details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getTaskActivity(
    @Param('taskId') taskId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() _user: UserDocument,
  ) {
    return this.activityService.findByTask(
      taskId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 30,
    );
  }

  // GET activity for an entire project
  @Get('activity')
  @ApiOperation({ summary: 'Get the activity log for an entire project, newest first, paginated' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page (default 30)', example: 30 })
  @ApiResponse({ status: 200, description: 'Paginated project activity log with actor details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getProjectActivity(
    @Param('projectId') projectId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() _user: UserDocument,
  ) {
    return this.activityService.findByProject(
      projectId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 30,
    );
  }
}
