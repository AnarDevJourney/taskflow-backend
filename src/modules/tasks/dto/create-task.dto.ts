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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '../enums/priority.enum';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title (1–200 characters)', example: 'Fix login redirect bug', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Optional markdown description', example: 'Steps to reproduce:\n1. Go to /login\n2. Submit form' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Target Kanban column — must match one of the project\'s configured status names', example: 'In Progress' })
  @IsString()
  status: string; // must match a project status name — validated in service

  @ApiPropertyOptional({ description: 'Task priority', enum: Priority, example: Priority.HIGH })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the assigned user', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Due date in ISO 8601 format', example: '2026-07-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Array of label strings', example: ['bug', 'frontend'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiPropertyOptional({ description: 'Story point estimate (min 0)', example: 3, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storyPoints?: number;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the sprint to add this task to', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsMongoId()
  sprintId?: string;
}
