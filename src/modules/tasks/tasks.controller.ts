import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { TasksService } from './tasks.service';
import { TasksQueryService } from './tasks-query.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { ReorderBulkTasksDto } from './dto/reorder-bulk-tasks.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Tasks')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces/:workspaceId/projects/:projectId/tasks')
export class TasksController {
  constructor(
    private tasksService: TasksService,
    private tasksQueryService: TasksQueryService,
  ) {}

  // ─── Task CRUD ───────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new task in a project' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 201, description: 'Task created' })
  @ApiResponse({ status: 400, description: 'Invalid status — does not match any project status column' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace or project not found' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.create(workspaceId, projectId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks in a project with optional filtering, sorting and pagination' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Paginated list of tasks with meta' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Workspace or project not found' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: QueryTasksDto,
    @CurrentUser() user: UserDocument,
  ) {
    // validates membership via projectsService (inside tasksQueryService)
    return this.tasksQueryService.findAll(workspaceId, projectId, query, user);
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Get a single task by ID' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 200, description: 'Task found with populated assignee, reporter and watchers' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.findOne(workspaceId, projectId, taskId, user);
  }

  // NOTE: must be registered before `:taskId`-based PATCH routes below, or
  // Nest will swallow 'reorder-bulk' as a :taskId param match.
  @Patch('reorder-bulk')
  @ApiOperation({ summary: 'Move multiple tasks to a new position/column at once (multi-select drag-and-drop)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Returns count of updated tasks' })
  @ApiResponse({ status: 400, description: 'Invalid target status' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'No matching tasks found' })
  reorderBulk(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: ReorderBulkTasksDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.reorderBulk(workspaceId, projectId, dto, user);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Update a task\'s fields' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 200, description: 'Task updated — activity and notifications fired for relevant field changes' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.update(workspaceId, projectId, taskId, dto, user);
  }

  @Patch(':taskId/reorder')
  @ApiOperation({ summary: 'Move a task to a new position or column (drag-and-drop)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 200, description: 'Task reordered' })
  @ApiResponse({ status: 400, description: 'Invalid target status' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  reorder(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ReorderTaskDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.reorder(workspaceId, projectId, taskId, dto, user);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a task (soft-delete — reporter, admin or owner only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 200, description: 'Task archived' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Only the reporter, admin, or owner can delete tasks' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.remove(workspaceId, projectId, taskId, user);
  }

  // ─── Bulk ────────────────────────────────────────────────────────

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-update multiple tasks at once (status, priority, assignee, labels)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Returns count of updated tasks' })
  @ApiResponse({ status: 400, description: 'Invalid status or no task IDs provided' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace or project not found' })
  bulkUpdate(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: BulkUpdateTasksDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.bulkUpdate(workspaceId, projectId, dto, user);
  }

  // ─── Watchers ────────────────────────────────────────────────────

  @Post(':taskId/watch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to a task to receive comment/change notifications' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 200, description: 'Watcher added (idempotent — safe to call if already watching)' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  addWatcher(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.addWatcher(workspaceId, projectId, taskId, user);
  }

  @Delete(':taskId/watch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from task notifications' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 200, description: 'Watcher removed' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  removeWatcher(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.removeWatcher(
      workspaceId,
      projectId,
      taskId,
      user,
    );
  }

  // ─── Checklist ───────────────────────────────────────────────────

  @Post(':taskId/checklist')
  @ApiOperation({ summary: 'Add a checklist item to a task' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiResponse({ status: 201, description: 'Checklist item added' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  addChecklistItem(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body('title') title: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.addChecklistItem(
      workspaceId,
      projectId,
      taskId,
      title,
      user,
    );
  }

  @Patch(':taskId/checklist/:itemIndex')
  @ApiOperation({ summary: 'Toggle a checklist item\'s completed state' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'taskId', description: 'MongoDB ObjectId of the task' })
  @ApiParam({ name: 'itemIndex', description: '0-based index of the checklist item to toggle' })
  @ApiResponse({ status: 200, description: 'Checklist item toggled' })
  @ApiResponse({ status: 400, description: 'Item index out of range' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Task, project, or workspace not found' })
  toggleChecklistItem(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('itemIndex') itemIndex: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.toggleChecklistItem(
      workspaceId,
      projectId,
      taskId,
      parseInt(itemIndex),
      user,
    );
  }
}
