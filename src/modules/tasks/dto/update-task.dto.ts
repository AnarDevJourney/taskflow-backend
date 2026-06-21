import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '../enums/priority.enum';

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'New title (1–200 characters)', example: 'Fix login redirect bug — v2', minLength: 1, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Updated markdown description', example: 'Updated steps after investigation' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'New Kanban column — must match a project status name', example: 'Done' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'New priority', enum: Priority, example: Priority.CRITICAL })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the new assignee, or null to unassign', example: '507f1f77bcf86cd799439011', nullable: true })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'New due date (ISO 8601), or null to clear', example: '2026-08-01T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ description: 'Replacement label array', example: ['bug', 'backend'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiPropertyOptional({ description: 'New story points, or null to clear', example: 5, nullable: true, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storyPoints?: number | null;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the sprint to move to, or null to remove from sprint', example: '507f1f77bcf86cd799439012', nullable: true })
  @IsOptional()
  @IsMongoId()
  sprintId?: string | null;
}
