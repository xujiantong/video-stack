import { describe, expect, it } from "vitest";
import { modelCapabilitySchema, modelSupportsParameters } from "./models";

const baseCapability = {
  id: "seedance-demo",
  provider: "jimeng",
  displayName: "Seedance Demo",
  supportedModes: ["text_to_video", "reference_to_video"],
  supportedReferenceModes: ["none", "image"],
  supportedAspectRatios: ["16:9", "9:16"],
  supportedResolutions: ["720p", "1080p"],
  supportedDurationsSeconds: [5, 10, 15],
  supportsAudioReference: false,
  pricing: {
    baseCostCents: 300,
    perSecondCents: 20,
    perAssetCents: 120,
    currency: "CNY"
  }
} as const;

describe("model schemas", () => {
  it("validates model capability records without requiring unconfirmed official IDs", () => {
    const result = modelCapabilitySchema.safeParse(baseCapability);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("model capability parse failed");
    expect(result.data.maxPromptLength).toBe(4000);
  });

  it("checks model compatibility against parameters and asset refs", () => {
    const parsed = modelCapabilitySchema.parse(baseCapability);

    expect(
      modelSupportsParameters({
        capability: parsed,
        parameters: {
          modelId: "seedance-demo",
          mode: "text_to_video",
          referenceMode: "none",
          aspectRatio: "16:9",
          resolution: "1080p",
          durationSeconds: 10
        },
        assetRefs: []
      })
    ).toBe(true);

    expect(
      modelSupportsParameters({
        capability: parsed,
        parameters: {
          modelId: "seedance-demo",
          mode: "reference_to_video",
          referenceMode: "audio",
          aspectRatio: "16:9",
          resolution: "1080p",
          durationSeconds: 10
        },
        assetRefs: [
          {
            id: "00000000-0000-4000-8000-000000000103",
            kind: "audio",
            label: "旁白音色"
          }
        ]
      })
    ).toBe(false);
  });
});
