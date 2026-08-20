import { IsBooleanString, IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignedUrlQueryDto {
  @ApiProperty({
    description: 'MongoDB ObjectId of the attachment',
    example: '507f1f77bcf86cd799439014',
  })
  @IsMongoId()
  attachmentId: string;

  @ApiPropertyOptional({
    description:
      'When "true" the signed URL forces a download (Content-Disposition: attachment) instead of inline display',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  download?: string;
}
