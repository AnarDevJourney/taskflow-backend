/** Wire shape of an attachment. `id` is the subdocument's own ObjectId. */
export interface AttachmentResponse {
  id: string;
  filename: string;
  originalName: string;
  key: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
}
