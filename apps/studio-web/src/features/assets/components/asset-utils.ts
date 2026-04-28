import { supportedUploadMimeTypeSchema, type CreateAssetUploadRequest } from "@video-stack/shared";

export const projectId = "00000000-0000-4000-8000-000000000001";

export function toSizeLabel(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

export function toFileType(mimeType: string): "image" | "audio" | "video" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "video";
}

export function toSupportedUploadMimeType(file: File): CreateAssetUploadRequest["mimeType"] {
  const parsed = supportedUploadMimeTypeSchema.safeParse(file.type);
  if (!parsed.success) throw new Error("文件类型不支持，请上传 PNG、JPEG、WebP、MP4、MOV、MP3 或 WAV。");
  return parsed.data;
}
