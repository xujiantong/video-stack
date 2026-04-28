export type EstimateInput = {
  promptText: string;
  assetUrls: string[];
};

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
  errorCode?: string;
  errorMessage?: string;
};

export type VideoProviderAdapter = {
  provider: "jimeng";
  estimate(input: EstimateInput): Promise<EstimateResult>;
  submit(input: SubmitGenerationInput): Promise<SubmitGenerationResult>;
  getStatus(providerTaskId: string): Promise<ProviderTaskStatus>;
  cancel(providerTaskId: string): Promise<void>;
};
