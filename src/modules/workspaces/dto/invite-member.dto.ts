import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export class InviteMemberDto {
  @ApiProperty({ description: 'Email address of the person to invite', example: 'newdev@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Role to grant — owner, admin, member, viewer, or guest', enum: WorkspaceRole, example: WorkspaceRole.MEMBER })
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}
