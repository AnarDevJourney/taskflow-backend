import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsString,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderBulkTasksDto {
  @ApiProperty({
    description:
      'MongoDB ObjectIds of the tasks being moved together, in the relative order they should keep (min 1)',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  taskIds: string[];

  @ApiProperty({ description: 'Target Kanban column — must match a project status name', example: 'In Review' })
  @IsString()
  status: string; // target column

  @ApiProperty({ description: 'New 0-based position index within the target column, counting only tasks not in taskIds', example: 2, minimum: 0 })
  @IsNumber()
  @Min(0)
  order: number; // insertion index within the column, excluding the moved tasks
}
