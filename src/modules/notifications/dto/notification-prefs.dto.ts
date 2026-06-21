import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationPrefsDto {
  @ApiPropertyOptional({ description: 'Receive in-app notification when a task is assigned to you', example: true })
  @IsOptional()
  @IsBoolean()
  taskAssigned?: boolean;

  @ApiPropertyOptional({ description: 'Receive notification when a task assigned to you is due soon', example: true })
  @IsOptional()
  @IsBoolean()
  taskDueSoon?: boolean;

  @ApiPropertyOptional({ description: 'Receive notification when a task assigned to you becomes overdue', example: true })
  @IsOptional()
  @IsBoolean()
  taskOverdue?: boolean;

  @ApiPropertyOptional({ description: 'Receive notification when a comment is added to a task you are watching', example: true })
  @IsOptional()
  @IsBoolean()
  commentAdded?: boolean;

  @ApiPropertyOptional({ description: 'Receive notification when you are @mentioned in a comment', example: true })
  @IsOptional()
  @IsBoolean()
  commentMention?: boolean;

  @ApiPropertyOptional({ description: 'Receive notification for sprint start/completion events', example: false })
  @IsOptional()
  @IsBoolean()
  sprintEvents?: boolean;

  @ApiPropertyOptional({ description: 'Enable email delivery for all enabled notification types', example: false })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Receive a daily digest email summarising your unread notifications', example: false })
  @IsOptional()
  @IsBoolean()
  emailDailyDigest?: boolean;
}
