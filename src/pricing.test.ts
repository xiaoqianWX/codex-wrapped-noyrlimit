import { describe, expect, test } from "bun:test";
import { calculateCostUSD, getModelPricing } from "./pricing";

describe("pricing", () => {
  test("calculates known GPT-5.4 base pricing", async () => {
    const pricing = await getModelPricing("gpt-5.4");

    expect(pricing).not.toBeNull();
    expect(pricing).toEqual({
      inputCostPerMToken: 2.5,
      cachedInputCostPerMToken: 0.25,
      outputCostPerMToken: 15,
    });

    const cost = calculateCostUSD(
      {
        inputTokens: 1_000_000,
        cachedInputTokens: 200_000,
        outputTokens: 500_000,
      },
      pricing!
    );

    expect(cost).toBeCloseTo(9.55, 8);
  });

  test("applies GPT-5.4 long-context pricing to snapshot model ids", async () => {
    const pricing = await getModelPricing("openai/gpt-5.4-2026-03-01", { longContext: true });

    expect(pricing).toEqual({
      inputCostPerMToken: 5,
      cachedInputCostPerMToken: 0.25,
      outputCostPerMToken: 22.5,
    });
  });
});
