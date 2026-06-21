import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// what to do with incomplete tasks when completing the sprint
export enum IncompleteTaskAction {
  MOVE_TO_BACKLOG = 'backlog',
  MOVE_TO_NEXT_SPRINT = 'next_sprint',
}

export class CompleteSprintDto {
  @ApiProperty({ description: 'What to do with tasks that are not in the Done column when the sprint ends', enum: IncompleteTaskAction, example: IncompleteTaskAction.MOVE_TO_BACKLOG })
  @IsEnum(IncompleteTaskAction)
  incompleteTaskAction: IncompleteTaskAction;

  @ApiPropertyOptional({ description: 'MongoDB ObjectId of the next sprint — required when incompleteTaskAction is "next_sprint"', example: '507f1f77bcf86cd799439014' })
  // required if incompleteTaskAction === 'next_sprint'
  @IsOptional()
  @IsMongoId()
  nextSprintId?: string;
}
