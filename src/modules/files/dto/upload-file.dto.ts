import { IsMongoId, IsString } from 'class-validator';

export class UploadFileDto {
  // which task this attachment belongs to
  @IsMongoId()
  taskId: string;

  @IsMongoId()
  projectId: string;

  @IsMongoId()
  workspaceId: string;
}
