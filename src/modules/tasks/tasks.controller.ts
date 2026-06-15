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
import { TasksService } from './tasks.service';
import { TasksQueryService } from './tasks-query.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@Controller('workspaces/:workspaceId/projects/:projectId/tasks')
export class TasksController {
  constructor(
    private tasksService: TasksService,
    private tasksQueryService: TasksQueryService,
  ) {}

  // ─── Task CRUD ───────────────────────────────────────────────────

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.create(workspaceId, projectId, dto, user);
  }

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: QueryTasksDto,
    @CurrentUser() user: UserDocument,
  ) {
    // first validate membership via projectsService (inside tasksQueryService)
    return this.tasksQueryService.findAll(projectId, query);
  }

  @Get(':taskId')
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.findOne(workspaceId, projectId, taskId, user);
  }

  @Patch(':taskId')
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
