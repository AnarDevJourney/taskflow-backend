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
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateStatusConfigDto } from './dto/update-status-config.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';

@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // ─── Project CRUD ────────────────────────────────────────────────

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.create(workspaceId, dto, user);
  }

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.findAll(workspaceId, user);
  }

  @Get(':projectId')
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.findOne(workspaceId, projectId, user);
  }

  @Patch(':projectId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.update(workspaceId, projectId, dto, user);
  }

  @Patch(':projectId/statuses')
  updateStatuses(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateStatusConfigDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.updateStatuses(
      workspaceId,
      projectId,
      dto,
      user,
    );
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.archive(workspaceId, projectId, user);
  }

  // ─── Members ────────────────────────────────────────────────────

  @Get(':projectId/members')
  getMembers(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.getMembers(workspaceId, projectId, user);
  }

  @Post(':projectId/members/:memberId')
  addMember(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.addMember(
      workspaceId,
      projectId,
      memberId,
      WorkspaceRole.MEMBER,
      user,
    );
  }

  @Delete(':projectId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.removeMember(
      workspaceId,
      projectId,
      memberId,
      user,
    );
  }
}
