import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { assets, generationTasks, projects, providerCredentials, users } from "./schema";

describe("database schema", () => {
  it("uses the architecture table names", () => {
    expect(getTableName(users)).toBe("users");
    expect(getTableName(projects)).toBe("projects");
    expect(getTableName(assets)).toBe("assets");
    expect(getTableName(providerCredentials)).toBe("provider_credentials");
    expect(getTableName(generationTasks)).toBe("generation_tasks");
  });

  it("keeps the initial migration executable and complete", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const migration = readFileSync(resolve(currentDir, "migrations/0001_initial.sql"), "utf8");

    for (const table of ["users", "projects", "assets", "provider_credentials", "generation_tasks"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    for (const column of ["created_at", "updated_at", "deleted_at", "status"]) {
      expect(migration).toContain(column);
    }
  });
});
