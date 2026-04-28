import {
  apiErrorSchema,
  assetSchema,
  completeAssetUploadRequestSchema,
  createAssetUploadRequestSchema,
  createAssetUploadResponseSchema,
  type Asset,
  type CompleteAssetUploadRequest,
  type CreateAssetUploadRequest,
  type CreateAssetUploadResponse
} from "@video-stack/shared";

const assetsEndpoint = "/api/assets";

export async function presignAssetUpload(input: CreateAssetUploadRequest): Promise<CreateAssetUploadResponse> {
  const payload = createAssetUploadRequestSchema.parse(input);
  const response = await fetch(`${assetsEndpoint}/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  await assertOk(response, "创建上传链接失败，请稍后重试。");
  return createAssetUploadResponseSchema.parse(await response.json());
}

export async function uploadAssetBytes(uploadUrl: string, uploadHeaders: Record<string, string>, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: uploadHeaders,
    body: file
  });
  await assertOk(response, "上传失败，请检查网络后重试。");
}

export async function completeAssetUpload(input: CompleteAssetUploadRequest): Promise<Asset> {
  const payload = completeAssetUploadRequestSchema.parse(input);
  const response = await fetch(`${assetsEndpoint}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  await assertOk(response, "提交上传结果失败，请重试。");
  return assetSchema.parse(await response.json());
}

export async function listAssets(projectId: string): Promise<Asset[]> {
  const response = await fetch(`${assetsEndpoint}?${new URLSearchParams({ projectId })}`);
  await assertOk(response, "读取素材失败，请刷新后重试。");
  return assetSchema.array().parse(await response.json());
}

async function assertOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;
  const body = await readJson(response);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new Error(parsed.data.error.message);
  }
  throw new Error(fallbackMessage);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

