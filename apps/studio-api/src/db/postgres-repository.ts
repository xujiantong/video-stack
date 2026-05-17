import { Pool } from "pg";
import type { AssetMention, ErrorCode, GenerationParameters } from "@video-stack/shared";
import type {
  AssetRecord,
  GenerationTaskRecord,
  ProjectRecord,
  ProviderCredentialRecord,
  StudioRepository,
  UserRecord
} from "./repositories";

type DbRow = Record<string, unknown>;

export function createPostgresStudioRepository(databaseUrl: string): StudioRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async createUser(input) {
      const row = await one(
        pool.query(
          `INSERT INTO users (id, email, status)
           VALUES (COALESCE($1, gen_random_uuid()), $2, $3)
           ON CONFLICT (id) DO UPDATE
           SET email = EXCLUDED.email, status = EXCLUDED.status, updated_at = now(), deleted_at = NULL
           RETURNING *`,
          [input.id ?? null, input.email, input.status ?? "active"]
        )
      );
      return toUser(row);
    },
    async createProject(input) {
      const row = await one(
        pool.query(
          `INSERT INTO projects (id, user_id, name, status)
           VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4)
           ON CONFLICT (id) DO UPDATE
           SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, status = EXCLUDED.status, updated_at = now(), deleted_at = NULL
           RETURNING *`,
          [input.id ?? null, input.userId, input.name, input.status ?? "active"]
        )
      );
      return toProject(row);
    },
    async createAsset(input) {
      const row = await one(
        pool.query(
          `INSERT INTO assets (id, project_id, user_id, kind, mime_type, name, size_bytes, duration_ms, tos_bucket, tos_key, status)
           VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            input.id ?? null,
            input.projectId,
            input.userId,
            input.kind,
            input.mimeType,
            input.name,
            input.sizeBytes,
            input.durationMs ?? null,
            input.tosBucket ?? null,
            input.tosKey,
            input.status ?? "uploading"
          ]
        )
      );
      return toAsset(row);
    },
    async getAsset(assetId) {
      return toAsset(await one(pool.query("SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL AND status <> 'deleted'", [assetId])));
    },
    async listAssets(projectId) {
      const result = await pool.query(
        `SELECT * FROM assets
         WHERE project_id = $1 AND deleted_at IS NULL AND status <> 'deleted'
         ORDER BY created_at DESC`,
        [projectId]
      );
      return result.rows.map(toAsset);
    },
    async markAssetReady(assetId) {
      return toAsset(await updateOne(pool.query("UPDATE assets SET status = 'ready', updated_at = now() WHERE id = $1 RETURNING *", [assetId])));
    },
    async markAssetRejected(assetId) {
      return toAsset(await updateOne(pool.query("UPDATE assets SET status = 'rejected', updated_at = now() WHERE id = $1 RETURNING *", [assetId])));
    },
    async createProviderCredential(input) {
      const row = await one(
        pool.query(
          `INSERT INTO provider_credentials (id, user_id, provider, display_name, encrypted_secret, iv, auth_tag, masked_label, status)
           VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE
           SET user_id = EXCLUDED.user_id,
               provider = EXCLUDED.provider,
               display_name = EXCLUDED.display_name,
               encrypted_secret = EXCLUDED.encrypted_secret,
               iv = EXCLUDED.iv,
               auth_tag = EXCLUDED.auth_tag,
               masked_label = EXCLUDED.masked_label,
               status = EXCLUDED.status,
               updated_at = now(),
               deleted_at = NULL
           RETURNING *`,
          [
            input.id ?? null,
            input.userId,
            input.provider,
            input.displayName,
            input.encryptedSecret,
            input.iv,
            input.authTag,
            input.maskedLabel,
            input.status ?? "active"
          ]
        )
      );
      return toCredential(row);
    },
    async listProviderCredentials(userId) {
      const result = await pool.query(
        `SELECT * FROM provider_credentials
         WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows.map(toCredential);
    },
    async getProviderCredential(credentialId) {
      return toCredential(
        await one(pool.query("SELECT * FROM provider_credentials WHERE id = $1 AND status = 'active' AND deleted_at IS NULL", [credentialId]))
      );
    },
    async revokeProviderCredential(credentialId) {
      return toCredential(
        await updateOne(
          pool.query("UPDATE provider_credentials SET status = 'deleted', updated_at = now(), deleted_at = now() WHERE id = $1 RETURNING *", [
            credentialId
          ])
        )
      );
    },
    async createGenerationTask(input) {
      const row = await one(
        pool.query(
          `INSERT INTO generation_tasks (
             id, project_id, user_id, provider, prompt_doc, prompt_text, parameters, asset_refs,
             status, estimated_cost_cents, actual_cost_cents, requires_second_confirm
           )
           VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            input.id ?? null,
            input.projectId,
            input.userId,
            input.provider,
            JSON.stringify(input.promptDoc),
            input.promptText,
            input.parameters ? JSON.stringify(input.parameters) : null,
            JSON.stringify(input.assetRefs),
            input.status ?? "draft",
            input.estimatedCostCents,
            input.actualCostCents ?? null,
            input.requiresSecondConfirm ?? false
          ]
        )
      );
      return toGenerationTask(row);
    },
    async getGenerationTask(taskId) {
      return toGenerationTask(await one(pool.query("SELECT * FROM generation_tasks WHERE id = $1 AND deleted_at IS NULL", [taskId])));
    },
    async listGenerationTasks(projectId) {
      const result = await pool.query(
        `SELECT * FROM generation_tasks
         WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [projectId]
      );
      return result.rows.map(toGenerationTask);
    },
    async cancelGenerationTask(taskId) {
      const current = await this.getGenerationTask(taskId);
      if (current.status !== "queued" && current.status !== "running") throw new Error("GENERATION_TASK_NOT_CANCELABLE");
      return toGenerationTask(
        await updateOne(
          pool.query("UPDATE generation_tasks SET status = 'canceled', updated_at = now(), finished_at = now() WHERE id = $1 RETURNING *", [
            taskId
          ])
        )
      );
    },
    async softDeleteGenerationTask(taskId) {
      return toGenerationTask(
        await updateOne(pool.query("UPDATE generation_tasks SET updated_at = now(), deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *", [taskId]))
      );
    },
    async softDeleteAsset(assetId) {
      return toAsset(
        await updateOne(pool.query("UPDATE assets SET status = 'deleted', updated_at = now(), deleted_at = now() WHERE id = $1 RETURNING *", [assetId]))
      );
    },
    async markGenerationTaskRunning(taskId) {
      return toGenerationTask(
        await updateOne(
          pool.query(
            `UPDATE generation_tasks
             SET status = 'running', error_code = NULL, error_message = NULL, updated_at = now(), started_at = COALESCE(started_at, now())
             WHERE id = $1 RETURNING *`,
            [taskId]
          )
        )
      );
    },
    async saveGenerationProviderTaskId(taskId, providerTaskId) {
      return toGenerationTask(
        await updateOne(pool.query("UPDATE generation_tasks SET provider_task_id = $2, updated_at = now() WHERE id = $1 RETURNING *", [taskId, providerTaskId]))
      );
    },
    async markGenerationTaskFailed(taskId, errorCode, errorMessage) {
      return toGenerationTask(
        await updateOne(
          pool.query(
            `UPDATE generation_tasks
             SET status = 'failed', error_code = $2, error_message = $3, updated_at = now(), finished_at = now()
             WHERE id = $1 RETURNING *`,
            [taskId, errorCode, errorMessage]
          )
        )
      );
    },
    async markGenerationTaskSucceeded(taskId, resultAssetId, actualCostCents) {
      return toGenerationTask(
        await updateOne(
          pool.query(
            `UPDATE generation_tasks
             SET status = 'succeeded',
                 actual_cost_cents = $3,
                 result_asset_id = $2,
                 error_code = NULL,
                 error_message = NULL,
                 updated_at = now(),
                 finished_at = now()
             WHERE id = $1 RETURNING *`,
            [taskId, resultAssetId, actualCostCents]
          )
        )
      );
    },
    async close() {
      await pool.end();
    }
  };
}

async function one(query: Promise<{ rows: DbRow[] }>): Promise<DbRow> {
  const result = await query;
  const row = result.rows[0];
  if (!row) throw new Error("记录不存在");
  return row;
}

async function updateOne(query: Promise<{ rows: DbRow[] }>): Promise<DbRow> {
  return one(query);
}

function toUser(row: DbRow): UserRecord {
  return {
    id: stringValue(row.id),
    email: stringValue(row.email),
    status: row.status as UserRecord["status"],
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: nullableDate(row.deleted_at)
  };
}

function toProject(row: DbRow): ProjectRecord {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    name: stringValue(row.name),
    status: row.status as ProjectRecord["status"],
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: nullableDate(row.deleted_at)
  };
}

function toAsset(row: DbRow): AssetRecord {
  return {
    id: stringValue(row.id),
    projectId: stringValue(row.project_id),
    userId: stringValue(row.user_id),
    kind: row.kind as AssetRecord["kind"],
    mimeType: stringValue(row.mime_type),
    name: stringValue(row.name),
    sizeBytes: numberValue(row.size_bytes),
    durationMs: nullableNumber(row.duration_ms),
    tosBucket: nullableString(row.tos_bucket),
    tosKey: stringValue(row.tos_key),
    status: row.status as AssetRecord["status"],
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: nullableDate(row.deleted_at)
  };
}

function toCredential(row: DbRow): ProviderCredentialRecord {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    provider: row.provider as ProviderCredentialRecord["provider"],
    displayName: stringValue(row.display_name),
    encryptedSecret: stringValue(row.encrypted_secret),
    iv: stringValue(row.iv),
    authTag: stringValue(row.auth_tag),
    maskedLabel: stringValue(row.masked_label),
    status: row.status as ProviderCredentialRecord["status"],
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    deletedAt: nullableDate(row.deleted_at)
  };
}

function toGenerationTask(row: DbRow): GenerationTaskRecord {
  return {
    id: stringValue(row.id),
    projectId: stringValue(row.project_id),
    userId: stringValue(row.user_id),
    provider: row.provider as GenerationTaskRecord["provider"],
    promptDoc: jsonValue<Record<string, unknown>>(row.prompt_doc),
    promptText: stringValue(row.prompt_text),
    parameters: nullableJsonValue<GenerationParameters>(row.parameters),
    assetRefs: jsonValue<AssetMention[]>(row.asset_refs),
    status: row.status as GenerationTaskRecord["status"],
    estimatedCostCents: numberValue(row.estimated_cost_cents),
    actualCostCents: nullableNumber(row.actual_cost_cents),
    requiresSecondConfirm: Boolean(row.requires_second_confirm),
    providerTaskId: nullableString(row.provider_task_id),
    resultAssetId: nullableString(row.result_asset_id),
    errorCode: nullableString(row.error_code),
    errorMessage: nullableString(row.error_message),
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
    startedAt: nullableDate(row.started_at),
    finishedAt: nullableDate(row.finished_at),
    deletedAt: nullableDate(row.deleted_at)
  };
}

function stringValue(value: unknown): string {
  if (typeof value !== "string") throw new Error("数据库字段类型错误");
  return value;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : stringValue(value);
}

function numberValue(value: unknown): number {
  if (typeof value !== "number") throw new Error("数据库字段类型错误");
  return value;
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : numberValue(value);
}

function dateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  throw new Error("数据库字段类型错误");
}

function nullableDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : dateValue(value);
}

function jsonValue<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
}

function nullableJsonValue<T>(value: unknown): T | null {
  return value === null || value === undefined ? null : jsonValue<T>(value);
}
