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
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserDocument } from '@modules/users/schemas/user.schema';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  // ─── Workspace CRUD ─────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: UserDocument) {
    return this.workspacesService.create(dto, user);
  }

  @Get()
  findMyWorkspaces(@CurrentUser() user: UserDocument) {
    return this.workspacesService.findMyWorkspaces(user);
  }

  @Get(':workspaceId')
  findOne(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.findOne(workspaceId, user);
  }

  @Patch(':workspaceId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.update(workspaceId, dto, user);
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.archive(workspaceId, user);
  }

  // ─── Members ────────────────────────────────────────────────────

  @Get(':workspaceId/members')
  getMembers(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.getMembers(workspaceId, user);
  }

  @Post(':workspaceId/members/invite')
  inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.inviteMember(workspaceId, dto, user);
  }

  @Patch(':workspaceId/members/:memberId/role')
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
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.removeMember(workspaceId, memberId, user);
  }

  @Delete(':workspaceId/members/leave')
  @HttpCode(HttpStatus.OK)
  leave(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.workspacesService.leave(workspaceId, user);
  }
}
