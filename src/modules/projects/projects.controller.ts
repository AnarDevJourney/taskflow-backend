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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateStatusConfigDto } from './dto/update-status-config.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';
import { WorkspaceRole } from '@modules/workspaces/enums/workspace-role.enum';

@ApiTags('Projects')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // ─── Project CRUD ────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new project in a workspace (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 201, description: 'Project created' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role — owner or admin required' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @ApiResponse({ status: 409, description: 'Project key is already used in this workspace' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.create(workspaceId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all active projects in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Array of projects' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.findAll(workspaceId, user);
  }

  @Get('archived')
  @ApiOperation({ summary: 'List archived projects in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Array of archived projects' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  findArchived(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.findArchivedProjects(workspaceId, user);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get a single project by ID' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project member or workspace admin' })
  @ApiResponse({ status: 404, description: 'Project or workspace not found' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.findOne(workspaceId, projectId, user);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project details (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or workspace not found' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.update(workspaceId, projectId, dto, user);
  }

  @Patch(':projectId/statuses')
  @ApiOperation({ summary: 'Replace the Kanban status configuration for a project (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Status config updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or workspace not found' })
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
  @ApiOperation({ summary: 'Archive a project (owner only, soft-delete)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project archived' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Only the project owner can archive' })
  @ApiResponse({ status: 404, description: 'Project or workspace not found' })
  archive(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.archive(workspaceId, projectId, user);
  }

  @Patch(':projectId/restore')
  @ApiOperation({ summary: 'Restore an archived project (owner only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project restored' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Only the project owner can restore' })
  @ApiResponse({ status: 404, description: 'Archived project not found' })
  restore(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.restore(workspaceId, projectId, user);
  }

  // ─── Members ────────────────────────────────────────────────────

  @Get(':projectId/members')
  @ApiOperation({ summary: 'List all members of a project' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Array of project members with user details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a project member or workspace admin' })
  @ApiResponse({ status: 404, description: 'Project or workspace not found' })
  getMembers(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.getMembers(workspaceId, projectId, user);
  }

  @Post(':projectId/members/:memberId')
  @ApiOperation({ summary: 'Add a workspace member to a project (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'memberId', description: 'MongoDB ObjectId of the user to add' })
  @ApiResponse({ status: 201, description: 'Member added to project' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role or user is not a workspace member' })
  @ApiResponse({ status: 404, description: 'Project or workspace not found' })
  @ApiResponse({ status: 409, description: 'User is already a project member' })
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
  @ApiOperation({ summary: 'Remove a member from a project (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({ name: 'memberId', description: 'MongoDB ObjectId of the user to remove' })
  @ApiResponse({ status: 200, description: 'Member removed from project' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Cannot remove the project owner or insufficient role' })
  @ApiResponse({ status: 404, description: 'Project, workspace, or member not found' })
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
