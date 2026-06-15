import { IsNumber, IsString, Min } from 'class-validator';

export class ReorderTaskDto {
  @IsString()
  status: string; // target column

  @IsNumber()
  @Min(0)
  order: number; // new position within the column
}
