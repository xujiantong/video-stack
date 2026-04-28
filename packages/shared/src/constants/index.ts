export const SUPPORTED_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "video/mp4"] as const;
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_DURATION_MS = 60_000;
export const HIGH_COST_THRESHOLD_CENTS = 2_000;

export const GENERATION_STATUSES = [
  "draft",
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled"
] as const;
