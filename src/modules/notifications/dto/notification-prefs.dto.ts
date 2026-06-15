import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  taskAssigned?: boolean;

  @IsOptional()
  @IsBoolean()
  taskDueSoon?: boolean;

  @IsOptional()
  @IsBoolean()
  taskOverdue?: boolean;

  @IsOptional()
  @IsBoolean()
  commentAdded?: boolean;

  @IsOptional()
  @IsBoolean()
  commentMention?: boolean;

  @IsOptional()
  @IsBoolean()
  sprintEvents?: boolean;

  // email channel toggles
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailDailyDigest?: boolean;
}
