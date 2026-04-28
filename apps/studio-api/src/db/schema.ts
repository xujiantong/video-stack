import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const generationStatus = pgEnum("generation_status", [
  "draft",
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled"
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const credentials = pgTable("credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  displayName: text("display_name").notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(),
  mimeType: text("mime_type").notNull(),
  name: text("name").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const generationTasks = pgTable("generation_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  promptDoc: jsonb("prompt_doc").notNull(),
  promptText: text("prompt_text").notNull(),
  assetRefs: jsonb("asset_refs").notNull(),
  status: generationStatus("status").notNull().default("draft"),
  estimatedCostCents: integer("estimated_cost_cents").notNull(),
  actualCostCents: integer("actual_cost_cents"),
  requiresSecondConfirm: boolean("requires_second_confirm").notNull().default(false),
  providerTaskId: text("provider_task_id"),
  resultAssetId: uuid("result_asset_id"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at")
});
