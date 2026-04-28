import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { apiErrorSchema, assetSchema, completeAssetUploadRequestSchema, createAssetUploadRequestSchema } from "@video-stack/shared";
import type { AssetService } from "../services/asset-service";

const uploadParamsSchema = z.object({
  storageKey: z.string().min(1)
});

export function createAssetRoutes(service: AssetService): FastifyPluginAsync {
  return async (app) => {
    app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) => {
      done(null, body);
    });
    app.addContentTypeParser(/^(image|audio|video)\//, { parseAs: "buffer" }, (_request, body, done) => {
      done(null, body);
    });

    app.post("/assets/presign", async (request, reply) => {
      try {
        const input = createAssetUploadRequestSchema.parse(request.body);
        const result = await service.createUpload(input);
        return reply.code(201).send(result);
      } catch (error) {
        return sendError(reply, error, "创建上传链接失败，请稍后重试。");
      }
    });

    app.post("/assets/complete", async (request, reply) => {
      try {
        const input = completeAssetUploadRequestSchema.parse(request.body);
        const asset = await service.completeUpload(input);
        return reply.code(201).send(assetSchema.parse(asset));
      } catch (error) {
        return sendError(reply, error, "提交上传结果失败，请重试。");
      }
    });

    app.get("/assets", async (request, reply) => {
      try {
        const query = z.object({ projectId: z.string().uuid() }).parse(request.query);
        return reply.send(await service.listAssets(query.projectId));
      } catch (error) {
        return sendError(reply, error, "读取素材失败，请刷新后重试。");
      }
    });

    app.put("/assets/uploads/:storageKey", async (request, reply) => {
      try {
        const { storageKey } = uploadParamsSchema.parse(request.params);
        const body = request.body;
        if (!Buffer.isBuffer(body)) {
          return reply.code(400).send({
            error: {
              code: "VALIDATION_ERROR",
              message: "无效的上传内容，请重新选择文件上传。"
            }
          });
        }
        const bytes = body;
        await service.acceptLocalUpload(decodeURIComponent(storageKey), bytes);
        return reply.code(200).send({ ok: true });
      } catch (error) {
        return sendError(reply, error, "上传失败，请重试。");
      }
    });
  };
}

function sendError(reply: FastifyReply, error: unknown, fallbackMessage: string) {
  const parsed = apiErrorSchema.safeParse(error);
  if (!parsed.success) {
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: fallbackMessage
      }
    });
  }

  const status = parsed.data.error.code === "FORBIDDEN" ? 403 : parsed.data.error.code === "NOT_FOUND" ? 404 : 400;
  return reply.code(status).send(parsed.data);
}
