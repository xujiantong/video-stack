export const PROVIDERS = ["jimeng"] as const;

export const ASSET_KINDS = ["image", "video", "audio"] as const;
export const ASSET_STATUSES = ["uploading", "ready", "rejected", "deleted"] as const;

export const SUPPORTED_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav"
] as const;

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_DURATION_MS = 60_000;
export const MAX_AUDIO_DURATION_MS = 5 * 60_000;
export const MAX_PROMPT_LENGTH = 4_000;
export const MAX_ASSET_REFS = 20;
export const HIGH_COST_THRESHOLD_CENTS = 2_000;
export const SECOND_CONFIRM_TOKEN_MIN_LENGTH = 16;

export const GENERATION_STATUSES = [
  "draft",
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled"
] as const;

export const GENERATION_MODES = ["text_to_video", "image_to_video", "first_last_frame", "reference_to_video", "text_to_image"] as const;
export const REFERENCE_MODES = ["none", "image", "audio", "image_audio", "first_last_frame"] as const;
export const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;
export const VIDEO_RESOLUTIONS = ["720p", "1080p"] as const;
export const VIDEO_DURATIONS_SECONDS = [5, 10, 15] as const;

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "UPLOAD_FILE_TOO_LARGE",
  "UPLOAD_UNSUPPORTED_TYPE",
  "UPLOAD_DURATION_TOO_LONG",
  "ASSET_NOT_READY",
  "CREDENTIAL_INVALID",
  "CREDENTIAL_TEST_FAILED",
  "MODEL_NOT_FOUND",
  "MODEL_UNSUPPORTED_ASSET",
  "MODEL_UNSUPPORTED_PARAMETER",
  "GENERATION_HIGH_COST_CONFIRM_REQUIRED",
  "GENERATION_SECOND_CONFIRM_INVALID",
  "GENERATION_TASK_NOT_CANCELABLE",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_FAILED",
  "INVALID_TASK",
  "INTERNAL_ERROR"
] as const;

export const RETRYABLE_ERROR_CODES = ["PROVIDER_RATE_LIMITED", "PROVIDER_TIMEOUT", "PROVIDER_FAILED"] as const;
