import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '../enums/priority.enum';

export class BulkUpdateTasksDto {
  @ApiProperty({ description: 'Array of MongoDB ObjectIds of tasks to update (min 1)', example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  taskIds: string[];

  @ApiPropertyOptional({ description: 'New status column for all selected tasks', example: 'Done' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'New priority for all selected tasks', enum: Priority, example: Priority.HIGH })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the new assignee for all selected tasks', example: '507f1f77bcf86cd799439013' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Replacement labels for all selected tasks', example: ['reviewed', 'blocked'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];
}
