import { IsEnum, IsMongoId, IsOptional } from 'class-validator';

// what to do with incomplete tasks when completing the sprint
export enum IncompleteTaskAction {
  MOVE_TO_BACKLOG = 'backlog',
  MOVE_TO_NEXT_SPRINT = 'next_sprint',
}

export class CompleteSprintDto {
  @IsEnum(IncompleteTaskAction)
  incompleteTaskAction: IncompleteTaskAction;

  // required if incompleteTaskAction === 'next_sprint'
  @IsOptional()
  @IsMongoId()
  nextSprintId?: string;
}
