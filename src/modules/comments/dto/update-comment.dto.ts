import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiProperty({ description: 'Updated comment body (1–5000 characters). Replaces the previous body entirely.', example: 'Updated: Fixed in commit def456', minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}
