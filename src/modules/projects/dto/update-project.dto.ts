import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'New project display name (2–100 characters)', example: 'Backend API v2', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated project description (max 500 characters)', example: 'Rewritten in NestJS', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Toggle sprint/scrum mode', example: true })
  @IsOptional()
  @IsBoolean()
  sprintMode?: boolean;

  @ApiPropertyOptional({ description: 'New hex color for the project avatar', example: '#10B981' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'New icon identifier', example: 'lightning' })
  @IsOptional()
  @IsString()
  icon?: string;
}
