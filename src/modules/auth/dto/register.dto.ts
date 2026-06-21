import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Display name (2–50 characters)', example: 'Jane Smith', minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Password (8–64 characters)', example: 'Str0ng!Pass', minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ description: 'Invite token from the registration email link', example: 'a3f9c12d...' })
  @IsString()
  token: string; // invite token from the email link
}
