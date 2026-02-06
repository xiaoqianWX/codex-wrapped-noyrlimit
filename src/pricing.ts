import { LOCAL_MODEL_PRICING, type LocalModelPricing } from "./pricing-data";

export interface ModelPricing {
  inputCostPerMToken: number;
  cachedInputCostPerMToken: number;
  outputCostPerMToken: number;
}

export interface TokenUsageTotals {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

const MILLION = 1_000_000;

const PROVIDER_PREFIXES = ["openai/", "azure/", "openrouter/openai/"];
const MODEL_ALIASES = new Map<string, string>([["gpt-5-codex", "gpt-5"]]);

const LOCAL_PRICING_MAP = new Map<string, LocalModelPricing>(Object.entries(LOCAL_MODEL_PRICING));

export async function getModelPricing(model: string): Promise<ModelPricing | null> {
  const candidates = createCandidates(model);
  for (const candidate of candidates) {
    const record = LOCAL_PRICING_MAP.get(candidate);
    if (record) {
      return normalizePricing(record);
    }
  }

  return null;
}

export function calculateCostUSD(usage: TokenUsageTotals, pricing: ModelPricing): number {
  const cachedInput = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const nonCachedInput = Math.max(usage.inputTokens - cachedInput, 0);

  const inputCost = (nonCachedInput / MILLION) * pricing.inputCostPerMToken;
  const cachedCost = (cachedInput / MILLION) * pricing.cachedInputCostPerMToken;
  const outputCost = (usage.outputTokens / MILLION) * pricing.outputCostPerMToken;

  return inputCost + cachedCost + outputCost;
}

function createCandidates(model: string): string[] {
  const candidates = new Set<string>();
  const normalizedModel = stripProviderPrefix(model);
  const modelVariants = new Set([model, normalizedModel]);

  for (const variant of modelVariants) {
    candidates.add(variant);

    const alias = MODEL_ALIASES.get(variant);
    if (alias) {
      candidates.add(alias);
    }

    for (const prefix of PROVIDER_PREFIXES) {
      candidates.add(`${prefix}${variant}`);
      if (alias) {
        candidates.add(`${prefix}${alias}`);
      }
    }
  }

  return Array.from(candidates);
}

function stripProviderPrefix(model: string): string {
  for (const prefix of PROVIDER_PREFIXES) {
    if (model.startsWith(prefix)) {
      return model.slice(prefix.length);
    }
  }
  return model;
}

function normalizePricing(record: LocalModelPricing): ModelPricing {
  return {
    inputCostPerMToken: record.inputCostPerMToken,
    cachedInputCostPerMToken: record.cachedInputCostPerMToken ?? record.inputCostPerMToken,
    outputCostPerMToken: record.outputCostPerMToken,
  };
}
