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
import { Priority } from '../enums/priority.enum';

export class QueryTasksDto {
  // ─── Pagination ─────────────────────────────────────────────────
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  limit?: number;

  // ─── Filters ────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @IsOptional()
  @IsMongoId()
  reporterId?: string;

  @IsOptional()
  @IsMongoId()
  sprintId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  labels?: string[];

  // due date range
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  // ─── Sort ───────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'order';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  // ─── Search ─────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  search?: string;
}
