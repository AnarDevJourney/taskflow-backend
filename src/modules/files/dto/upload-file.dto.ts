import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Text fields of the multipart upload body.
 *
 * These are read twice on purpose: once by the upload resolver, before a byte
 * of the file is streamed anywhere, and once by the global ValidationPipe when
 * the parsed request reaches the controller.
 */
export class UploadFileDto {
  @ApiProperty({
    description: 'MongoDB ObjectId of the workspace',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  workspaceId: string;

  @ApiProperty({
    description: 'MongoDB ObjectId of the project',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  projectId: string;

  @ApiProperty({
    description: 'MongoDB ObjectId of the task this file belongs to',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  taskId: string;
}
