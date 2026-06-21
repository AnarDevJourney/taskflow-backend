import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSprintDto {
  @ApiPropertyOptional({ description: 'New sprint name (2–100 characters)', example: 'Sprint 4 (revised)', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated sprint goal (max 500 characters)', example: 'Ship notifications + file uploads', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @ApiPropertyOptional({ description: 'New start date (ISO 8601)', example: '2026-07-03T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'New end date (ISO 8601) — must be after startDate', example: '2026-07-16T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
