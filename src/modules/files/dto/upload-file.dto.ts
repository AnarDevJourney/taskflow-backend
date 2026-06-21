import { IsMongoId, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  // which task this attachment belongs to
  @ApiProperty({ description: 'MongoDB ObjectId of the task this file belongs to', example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  taskId: string;

  @ApiProperty({ description: 'MongoDB ObjectId of the project', example: '507f1f77bcf86cd799439012' })
  @IsMongoId()
  projectId: string;

  @ApiProperty({ description: 'MongoDB ObjectId of the workspace', example: '507f1f77bcf86cd799439013' })
  @IsMongoId()
  workspaceId: string;
}
