import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("credential crypto", () => {
  it("decrypts encrypted secrets with the original key", () => {
    const key = randomBytes(32);
    const payload = encryptSecret("jimeng-secret", key);

    expect(decryptSecret(payload, key)).toBe("jimeng-secret");
    expect(payload.encryptedSecret).not.toContain("jimeng-secret");
  });
});
