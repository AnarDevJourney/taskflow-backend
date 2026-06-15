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
import { SprintsService } from './sprints.service';
import { SprintsReportService } from './sprints-report.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@Controller('workspaces/:workspaceId/projects/:projectId/sprints')
export class SprintsController {
  constructor(
    private sprintsService: SprintsService,
    private sprintsReportService: SprintsReportService,
  ) {}

  // ─── Sprint CRUD ─────────────────────────────────────────────────

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.create(workspaceId, projectId, dto, user);
  }

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.findAll(workspaceId, projectId, user);
  }

  @Get(':sprintId')
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sprintsService.findOne(workspaceId, projectId, sprintId, user);
  }

  @Patch(':sprintId')
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
  getBurndown(@Param('sprintId') sprintId: string) {
    return this.sprintsReportService.getBurndown(sprintId);
  }
}
