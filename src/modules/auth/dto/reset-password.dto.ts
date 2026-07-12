import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUPPORTED_EMAIL_LANGUAGES = ['en', 'ru', 'az'] as const;

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address of the account to reset', example: 'jane@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'UI language the user is currently using — the reset email is sent in this language',
    enum: SUPPORTED_EMAIL_LANGUAGES,
    example: 'en',
  })
  @IsOptional()
  @IsIn(SUPPORTED_EMAIL_LANGUAGES)
  lang?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from the reset email link', example: 'b7e2a1c0...' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password (min 8 characters)', example: 'NewStr0ng!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
