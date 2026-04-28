export type EstimateInput = {
  promptText: string;
  assetUrls: string[];
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

export type SubmitGenerationInput = EstimateInput & {
  secretKey: string;
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
  getStatus(providerTaskId: string): Promise<ProviderTaskStatus>;
  cancel(providerTaskId: string): Promise<void>;
  downloadResult(providerTaskId: string, resultUrl: string): Promise<Uint8Array>;
};
