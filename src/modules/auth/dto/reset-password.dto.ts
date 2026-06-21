import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address of the account to reset', example: 'jane@acme.com' })
  @IsEmail()
  email: string;
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
