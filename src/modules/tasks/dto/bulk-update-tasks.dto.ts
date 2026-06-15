import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { Priority } from '../enums/priority.enum';

export class BulkUpdateTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  taskIds: string[];

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
  @IsArray()
  @IsString({ each: true })
  labels?: string[];
}
