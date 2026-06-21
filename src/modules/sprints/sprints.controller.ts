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
import { SprintsService } from './sprints.service';
import { SprintsReportService } from './sprints-report.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Sprints')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces/:workspaceId/projects/:projectId/sprints')
export class SprintsController {
  constructor(
    private sprintsService: SprintsService,
    private sprintsReportService: SprintsReportService,
  ) {}

  // ─── Sprint CRUD ─────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new sprint (project must have sprintMode enabled)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 201, description: 'Sprint created with PLANNED status' })
  @ApiResponse({ status: 400, description: 'Sprint mode not enabled, or end date is before start date' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace or project not found' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.create(workspaceId, projectId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all sprints for a project, sorted by start date descending' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Array of sprints' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Workspace or project not found' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.findAll(workspaceId, projectId, user);
  }

  @Get(':sprintId')
  @ApiOperation({ summary: 'Get a single sprint by ID' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'sprintId', description: 'MongoDB ObjectId of the sprint' })
  @ApiResponse({ status: 200, description: 'Sprint found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Sprint, project, or workspace not found' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.findOne(workspaceId, projectId, sprintId, user);
  }

  @Patch(':sprintId')
  @ApiOperation({ summary: 'Update a sprint\'s name, goal or dates (cannot edit completed sprints)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'sprintId', description: 'MongoDB ObjectId of the sprint' })
  @ApiResponse({ status: 200, description: 'Sprint updated' })
  @ApiResponse({ status: 400, description: 'Sprint is already completed, or end date before start date' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Sprint, project, or workspace not found' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Body() dto: UpdateSprintDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.update(
      workspaceId,
      projectId,
      sprintId,
      dto,
      user,
    );
  }

  @Delete(':sprintId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a sprint — tasks moved back to backlog (cannot delete an active sprint)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'sprintId', description: 'MongoDB ObjectId of the sprint' })
  @ApiResponse({ status: 200, description: 'Sprint deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete an active sprint — complete it first' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Sprint, project, or workspace not found' })
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.remove(workspaceId, projectId, sprintId, user);
  }

  // ─── Sprint Lifecycle ────────────────────────────────────────────

  @Post(':sprintId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a sprint (only one active sprint allowed per project at a time)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'sprintId', description: 'MongoDB ObjectId of the sprint' })
  @ApiResponse({ status: 200, description: 'Sprint status changed to ACTIVE' })
  @ApiResponse({ status: 400, description: 'Sprint is not in PLANNED status, or another sprint is already active' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Sprint, project, or workspace not found' })
  start(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.start(workspaceId, projectId, sprintId, user);
  }

  @Post(':sprintId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an active sprint — incomplete tasks moved to backlog or next sprint' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'sprintId', description: 'MongoDB ObjectId of the sprint' })
  @ApiResponse({ status: 200, description: 'Sprint completed — velocity snapshot saved' })
  @ApiResponse({ status: 400, description: 'Sprint is not active, or nextSprintId missing when action is next_sprint' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project or workspace member' })
  @ApiResponse({ status: 404, description: 'Sprint, project, or workspace not found' })
  complete(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Body() dto: CompleteSprintDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.complete(
      workspaceId,
      projectId,
      sprintId,
      dto,
      user,
    );
  }

  // ─── Reports ─────────────────────────────────────────────────────

  @Get('reports/velocity')
  @ApiOperation({ summary: 'Get velocity report — story points completed per sprint over the last N sprints' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of sprints to include (default 10)', example: 10 })
  @ApiResponse({ status: 200, description: 'Array of velocity data points per completed sprint' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getVelocity(
    @Param('projectId') projectId: string,
    @Query('limit') limit: string,
  ) {
    return this.sprintsReportService.getVelocity(
      projectId,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':sprintId/reports/burndown')
  @ApiOperation({ summary: 'Get burndown chart data for a sprint' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'sprintId', description: 'MongoDB ObjectId of the sprint' })
  @ApiResponse({ status: 200, description: 'Burndown data: ideal vs actual remaining points per day' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  getBurndown(@Param('sprintId') sprintId: string) {
    return this.sprintsReportService.getBurndown(sprintId);
  }
}
