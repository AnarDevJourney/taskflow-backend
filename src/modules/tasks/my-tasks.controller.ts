import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { TasksQueryService } from './tasks-query.service';
import { QueryMyTasksDto } from './dto/query-my-tasks.dto';
import { WorkspacesService } from '@modules/workspaces/workspaces.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Tasks')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces/:workspaceId/my-tasks')
export class MyTasksController {
  constructor(
    private tasksQueryService: TasksQueryService,
    private workspacesService: WorkspacesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tasks assigned to the current user across every project in the workspace, paginated' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Paginated list of the current user\'s tasks with meta' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findMyTasks(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryMyTasksDto,
    @CurrentUser() user: UserDocument,
  ) {
    // validates membership, throws NotFound/Forbidden otherwise
    await this.workspacesService.findOne(workspaceId, user);

    return this.tasksQueryService.findMyTasks(
      workspaceId,
      String(user._id),
      query,
    );
  }
}
