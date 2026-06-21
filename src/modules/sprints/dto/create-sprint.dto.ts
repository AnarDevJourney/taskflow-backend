import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSprintDto {
  @ApiProperty({ description: 'Sprint name (2–100 characters)', example: 'Sprint 4', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Sprint goal description (max 500 characters)', example: 'Ship the notification system', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @ApiProperty({ description: 'Sprint start date (ISO 8601)', example: '2026-07-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Sprint end date (ISO 8601) — must be after startDate', example: '2026-07-14T23:59:59.999Z' })
  @IsDateString()
  endDate: string;
}
