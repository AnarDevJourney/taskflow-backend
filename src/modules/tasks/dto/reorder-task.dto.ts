import { IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderTaskDto {
  @ApiProperty({ description: 'Target Kanban column — must match a project status name', example: 'In Review' })
  @IsString()
  status: string; // target column

  @ApiProperty({ description: 'New 0-based position index within the target column', example: 2, minimum: 0 })
  @IsNumber()
  @Min(0)
  order: number; // new position within the column
}
