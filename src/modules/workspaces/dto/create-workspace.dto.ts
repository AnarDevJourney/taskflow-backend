import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ description: 'Workspace display name (2–100 characters)', example: 'Acme Corp', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'URL-safe slug — lowercase letters, numbers and hyphens only (2–32 characters)', example: 'acme-corp', minLength: 2, maxLength: 32 })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers and hyphens',
  })
  slug: string;

  @ApiPropertyOptional({ description: 'Optional description (max 500 characters)', example: 'Our main engineering workspace', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
