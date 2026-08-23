import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Dashboard')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces/:workspaceId/dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Every dashboard statistic for a workspace in one response — KPI cards, status/priority distributions, my tasks, recent activity, upcoming deadlines and sprint progress',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'MongoDB ObjectId of the workspace',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description:
      'MongoDB ObjectId of a project in this workspace. When given, every number in the response is narrowed to that project instead of the whole workspace.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Dashboard overview. KPIs, both chart distributions, the deadline list, sprint progress and recent activity are workspace-wide (or project-wide when `projectId` is given); `myTasks` and `kpis.unreadNotifications` are scoped to the caller.',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace or project not found' })
  getOverview(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
    @Query('projectId') projectId?: string,
  ) {
    return this.dashboardService.getOverview(workspaceId, user, projectId);
  }
}
