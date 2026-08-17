import { IsIn, IsISO8601, IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityAction } from '../enums/activity-action.enum';
import { ACTIVITY_MODULES, ActivityModule } from '../utils/activity-module.util';

export class QueryWorkspaceActivityDto {
  @ApiPropertyOptional({ description: 'Filter by the user who performed the action' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by module', enum: ACTIVITY_MODULES })
  @IsOptional()
  @IsIn(ACTIVITY_MODULES)
  module?: ActivityModule;

  @ApiPropertyOptional({ description: 'Filter by exact action', enum: ActivityAction })
  @IsOptional()
  @IsIn(Object.values(ActivityAction))
  action?: ActivityAction;

  @ApiPropertyOptional({ description: 'Start of date range (inclusive), ISO 8601' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End of date range (inclusive), ISO 8601' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number (default 1)', example: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ description: 'Results per page (default 10)', example: 10 })
  @IsOptional()
  @IsString()
  limit?: string;
}
