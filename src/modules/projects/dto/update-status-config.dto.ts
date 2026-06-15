import { Type } from 'class-transformer';
import {
  IsArray,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StatusConfigItemDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsHexColor()
  color: string;

  @IsNumber()
  @Min(0)
  order: number;

  @IsNumber()
  @Min(1)
  wipLimit: number;
}

export class UpdateStatusConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusConfigItemDto)
  statuses: StatusConfigItemDto[];
}
