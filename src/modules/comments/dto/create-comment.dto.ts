import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment body (1–5000 characters). Mention users with @[userId] syntax.', example: 'Fixed in commit abc123. CC @[507f1f77bcf86cd799439011]', minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}
