import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ASSET_KINDS, ASSET_STATUSES, GENERATION_STATUSES, PROVIDERS, type AssetMention } from "@video-stack/shared";

export const providerEnum = pgEnum("studio_provider", PROVIDERS);
export const userStatus = pgEnum("user_status", ["active", "disabled", "deleted"]);
export const projectStatus = pgEnum("project_status", ["active", "archived", "deleted"]);
export const assetKind = pgEnum("asset_kind", ASSET_KINDS);
export const assetStatus = pgEnum("asset_status", ASSET_STATUSES);
export const credentialStatus = pgEnum("credential_status", ["active", "revoked", "deleted"]);
export const generationStatus = pgEnum("generation_status", GENERATION_STATUSES);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    status: userStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    statusIdx: index("users_status_idx").on(table.status)
  })
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    status: projectStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    userIdx: index("projects_user_id_idx").on(table.userId),
    statusIdx: index("projects_status_idx").on(table.status)
  })
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: assetKind("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    name: text("name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationMs: integer("duration_ms"),
    tosBucket: text("tos_bucket"),
    tosKey: text("tos_key").notNull(),
    status: assetStatus("status").notNull().default("uploading"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    projectIdx: index("assets_project_id_idx").on(table.projectId),
    userIdx: index("assets_user_id_idx").on(table.userId),
    statusIdx: index("assets_status_idx").on(table.status)
  })
);

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: providerEnum("provider").notNull(),
    displayName: text("display_name").notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    maskedLabel: text("masked_label").notNull(),
    status: credentialStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    userIdx: index("provider_credentials_user_id_idx").on(table.userId),
    statusIdx: index("provider_credentials_status_idx").on(table.status)
  })
);

export const generationTasks = pgTable(
  "generation_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: providerEnum("provider").notNull(),
    promptDoc: jsonb("prompt_doc").$type<Record<string, unknown>>().notNull(),
    promptText: text("prompt_text").notNull(),
    assetRefs: jsonb("asset_refs").$type<AssetMention[]>().notNull(),
    status: generationStatus("status").notNull().default("draft"),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    requiresSecondConfirm: boolean("requires_second_confirm").notNull().default(false),
    providerTaskId: text("provider_task_id"),
    resultAssetId: uuid("result_asset_id").references(() => assets.id),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    deletedAt: timestamp("deleted_at")
  },
  (table) => ({
    projectIdx: index("generation_tasks_project_id_idx").on(table.projectId),
    userIdx: index("generation_tasks_user_id_idx").on(table.userId),
    statusIdx: index("generation_tasks_status_idx").on(table.status)
  })
);
