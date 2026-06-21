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
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@ApiTags('Workspaces')
@ApiCookieAuth('cookie-access-token')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  // ─── Workspace CRUD ─────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 409, description: 'Slug is already taken' })
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: UserDocument) {
    return this.workspacesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces the current user is a member of' })
  @ApiResponse({ status: 200, description: 'Array of workspaces' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  findMyWorkspaces(@CurrentUser() user: UserDocument) {
    return this.workspacesService.findMyWorkspaces(user);
  }

  @Get(':workspaceId')
  @ApiOperation({ summary: 'Get a single workspace by ID' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Workspace found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.findOne(workspaceId, user);
  }

  @Patch(':workspaceId')
  @ApiOperation({ summary: 'Update workspace name or description (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Workspace updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role — owner or admin required' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.update(workspaceId, dto, user);
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a workspace (owner only, soft-delete)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Workspace archived' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Only the owner can archive a workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  archive(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.archive(workspaceId, user);
  }

  // ─── Members ────────────────────────────────────────────────────

  @Get(':workspaceId/members')
  @ApiOperation({ summary: 'List all members of a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Array of workspace members with user details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  getMembers(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.getMembers(workspaceId, user);
  }

  @Post(':workspaceId/members/invite')
  @ApiOperation({ summary: 'Invite a new member by email (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 201, description: 'Invite email sent — returns invite token' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role — owner or admin required' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.inviteMember(workspaceId, dto, user);
  }

  @Patch(':workspaceId/members/:memberId/role')
  @ApiOperation({ summary: 'Change a member\'s role (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'memberId', description: 'MongoDB ObjectId of the user whose role to change' })
  @ApiResponse({ status: 200, description: 'Member role updated' })
  @ApiResponse({ status: 400, description: 'Cannot change your own role' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Workspace or member not found' })
  updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.updateMemberRole(
      workspaceId,
      memberId,
      dto,
      user,
    );
  }

  @Delete(':workspaceId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from a workspace (owner/admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiParam({ name: 'memberId', description: 'MongoDB ObjectId of the user to remove' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 400, description: 'Cannot remove yourself or invalid request' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Cannot remove the workspace owner or insufficient role' })
  @ApiResponse({ status: 404, description: 'Workspace or member not found' })
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.removeMember(workspaceId, memberId, user);
  }

  @Delete(':workspaceId/members/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a workspace (owner must transfer ownership first)' })
  @ApiParam({ name: 'workspaceId', description: 'MongoDB ObjectId of the workspace' })
  @ApiResponse({ status: 200, description: 'Left the workspace' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Owner cannot leave without transferring ownership' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  leave(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.leave(workspaceId, user);
  }
}
