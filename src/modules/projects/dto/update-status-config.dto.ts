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
import { ApiProperty } from '@nestjs/swagger';

export class StatusConfigItemDto {
  @ApiProperty({ description: 'Status column name (max 50 characters)', example: 'In Progress', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Hex color for the status column label', example: '#F59E0B' })
  @IsHexColor()
  color: string;

  @ApiProperty({ description: 'Display order of this column (0-indexed)', example: 1, minimum: 0 })
  @IsNumber()
  @Min(0)
  order: number;

  @ApiProperty({ description: 'Work-in-progress limit — max tasks allowed in this column (min 1)', example: 5, minimum: 1 })
  @IsNumber()
  @Min(1)
  wipLimit: number;
}

export class UpdateStatusConfigDto {
  @ApiProperty({ description: 'Ordered array of Kanban status column definitions — replaces the existing config', type: [StatusConfigItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusConfigItemDto)
  statuses: StatusConfigItemDto[];
}
