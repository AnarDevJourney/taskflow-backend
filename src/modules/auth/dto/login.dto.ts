import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'User email address', example: 'jane@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Account password (min 6 characters)', example: 'hunter2', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
