import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invite token from the email link', example: 'a3f9c12d...' })
  @IsString()
  token: string;
}
