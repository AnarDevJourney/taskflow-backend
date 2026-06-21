import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '../enums/priority.enum';

export class QueryTasksDto {
  // ─── Pagination ─────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @ApiPropertyOptional({ description: 'Results per page', example: 25, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  limit?: number;

  // ─── Filters ────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Filter by status column name', example: 'In Progress' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: Priority, example: Priority.HIGH })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Filter by assignee MongoDB ObjectId', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Filter by reporter MongoDB ObjectId', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsMongoId()
  reporterId?: string;

  @ApiPropertyOptional({ description: 'Filter by sprint MongoDB ObjectId', example: '507f1f77bcf86cd799439013' })
  @IsOptional()
  @IsMongoId()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'Filter by one or more labels (comma-separated in query string)', example: ['bug', 'frontend'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  labels?: string[];

  @ApiPropertyOptional({ description: 'Due-date range start (ISO 8601, inclusive)', example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Due-date range end (ISO 8601, inclusive)', example: '2026-07-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  // ─── Sort ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Field to sort by', enum: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'order'], example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'order';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  // ─── Search ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Full-text search query on task titles', example: 'login redirect' })
  @IsOptional()
  @IsString()
  search?: string;
}
