import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export class UpdateMemberRoleDto {
  @ApiProperty({ description: 'New role for the member', enum: WorkspaceRole, example: WorkspaceRole.ADMIN })
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}
