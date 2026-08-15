import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '../enums/priority.enum';

export class QueryMyTasksDto {
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

  @ApiPropertyOptional({ description: 'Filter to a single project MongoDB ObjectId', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  projectId?: string;

  // ─── Sort ───────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Field to sort by', enum: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'taskNumber'], example: 'dueDate' })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'taskNumber';

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], example: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  // ─── Search ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Full-text search query on task titles', example: 'login redirect' })
  @IsOptional()
  @IsString()
  search?: string;
}
