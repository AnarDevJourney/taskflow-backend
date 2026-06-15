import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@Controller('workspaces/:workspaceId/projects/:projectId')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  // GET activity for a specific task
  @Get('tasks/:taskId/activity')
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
