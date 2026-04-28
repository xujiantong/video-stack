import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { modelRoutes } from "./models";

describe("model routes", () => {
  it("returns enabled model capabilities for the parameter toolbar", async () => {
    const app = Fastify();
    await app.register(modelRoutes, { prefix: "/api" });

    const response = await app.inject({ method: "GET", url: "/api/models" });

    expect(response.statusCode).toBe(200);
    expect(response.json<unknown[]>()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "seedance-pro",
          supportedModes: expect.arrayContaining(["reference_to_video"]),
          supportedRatios: expect.arrayContaining(["16:9"]),
          supportedResolutions: expect.arrayContaining(["1080p"]),
          supportedDurations: expect.arrayContaining([15])
        })
      ])
    );
  });
});
