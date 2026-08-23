import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { QueryWorkspaceActivityDto } from './dto/query-workspace-activity.dto';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

// Separate from ActivityController (task/project scoped) — this is the
// workspace-wide feed behind the Activity Log page, with user/module/
// action/date-range filters. Kept in its own controller since its base
// path (`workspaces/:workspaceId`) doesn't nest under a project or task.
@ApiTags('Activity')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces/:workspaceId/activity')
export class WorkspaceActivityController {
  constructor(
    private activityService: ActivityService,
    private workspacesService: WorkspacesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the activity log for an entire workspace, newest first, paginated, filterable by user/module/action/date-range' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Paginated workspace activity log with actor/task/project details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findWorkspaceActivity(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryWorkspaceActivityDto,
    @CurrentUser() user: UserDocument,
  ) {
    // validates membership, throws NotFound/Forbidden otherwise
    await this.workspacesService.findOne(workspaceId, user);

    return this.activityService.findByWorkspace(workspaceId, query);
  }

  @Get(':logId')
  @ApiOperation({
    summary:
      'Get a single workspace activity log entry by id — powers the dashboard Recent Activity widget deep-linking straight to one entry regardless of the Activity Log page\'s current filters/page',
  })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'logId', description: 'MongoDB ObjectId of the activity log entry' })
  @ApiResponse({ status: 200, description: 'The activity log entry, with actor/task/project details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace or log entry not found' })
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('logId') logId: string,
    @CurrentUser() user: UserDocument,
  ) {
    await this.workspacesService.findOne(workspaceId, user);

    return this.activityService.findOneForWorkspace(workspaceId, logId);
  }
}
