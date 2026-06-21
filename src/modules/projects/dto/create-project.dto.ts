import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project display name (2–100 characters)', example: 'Backend API', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Short uppercase key used in task IDs, e.g. "BE" produces BE-1, BE-2 (2–6 uppercase letters/numbers)', example: 'BE', minLength: 2, maxLength: 6 })
  @IsString()
  @MinLength(2)
  @MaxLength(6)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Key must be uppercase letters and numbers only',
  })
  key: string;

  @ApiPropertyOptional({ description: 'Optional project description (max 500 characters)', example: 'NestJS REST API for TaskFlow', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Enable sprint/scrum mode for this project', example: false })
  @IsOptional()
  @IsBoolean()
  sprintMode?: boolean;

  @ApiPropertyOptional({ description: 'Hex color for the project avatar (default: #3B82F6)', example: '#3B82F6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon identifier for the project', example: 'rocket' })
  @IsOptional()
  @IsString()
  icon?: string;
}
