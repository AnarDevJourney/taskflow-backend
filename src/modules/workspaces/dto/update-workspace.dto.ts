import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'New workspace display name (2–100 characters)', example: 'Acme Corp Redesign', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description (max 500 characters)', example: 'Renamed for the Q3 rebranding', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
