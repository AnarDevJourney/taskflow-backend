import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}
