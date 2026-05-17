export type EstimateInput = {
  promptText: string;
  assetUrls: string[];
  assets?: ProviderInputAsset[];
};

export type ProviderInputAsset = {
  bytes?: Uint8Array;
  kind?: "audio" | "image" | "video";
  mimeType?: string;
  url?: string;
};

export type JimengCredential = {
  apiKey?: string;
  secretKey: string;
};

export type JimengGenerationParameters = {
  modelId?: string;
  mode?: string;
  referenceMode?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
};

export type ProviderErrorCode =
  | "CREDENTIAL_INVALID"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_FAILED"
  | "INVALID_TASK";

export type EstimateResult = {
  estimatedCostCents: number;
  estimatedSeconds: number;
};

export type SubmitGenerationInput = EstimateInput &
  JimengCredential & {
    parameters?: JimengGenerationParameters | null;
};

export type SubmitGenerationResult = {
  providerTaskId: string;
};

export type ProviderTaskStatus = {
  status: "running" | "succeeded" | "failed" | "canceled";
  resultUrl?: string;
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
  actualCostCents?: number;
};

export class ProviderAdapterError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly providerRequestId?: string;

  constructor(input: { code: ProviderErrorCode; message: string; retryable: boolean; providerRequestId?: string | undefined }) {
    super(input.message);
    this.name = "ProviderAdapterError";
    this.code = input.code;
    this.retryable = input.retryable;
    if (input.providerRequestId) this.providerRequestId = input.providerRequestId;
  }
}

export type VideoProviderAdapter = {
  provider: "jimeng";
  estimate(input: EstimateInput): Promise<EstimateResult>;
  submit(input: SubmitGenerationInput): Promise<SubmitGenerationResult>;
  getStatus(providerTaskId: string, credential: JimengCredential): Promise<ProviderTaskStatus>;
  cancel(providerTaskId: string, credential?: JimengCredential): Promise<void>;
  downloadResult(providerTaskId: string, resultUrl: string): Promise<Uint8Array>;
};
