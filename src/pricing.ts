import { LOCAL_MODEL_PRICING, type LocalModelPricing } from "./pricing-data";

export interface ModelPricing {
  inputCostPerMToken: number;
  cachedInputCostPerMToken: number;
  outputCostPerMToken: number;
}

export interface ModelPricingOptions {
  longContext?: boolean;
}

export interface TokenUsageTotals {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

const MILLION = 1_000_000;
export const LONG_CONTEXT_INPUT_THRESHOLD = 272_000;

const PROVIDER_PREFIXES = ["openai/", "azure/", "openrouter/openai/"];
const MODEL_ALIASES = new Map<string, string>([["gpt-5-codex", "gpt-5"]]);

const LOCAL_PRICING_MAP = new Map<string, LocalModelPricing>(Object.entries(LOCAL_MODEL_PRICING));

export async function getModelPricing(model: string, options: ModelPricingOptions = {}): Promise<ModelPricing | null> {
  const candidates = createCandidates(model);
  for (const candidate of candidates) {
    const record = LOCAL_PRICING_MAP.get(candidate);
    if (record) {
      return normalizePricing(record, candidate, options);
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
  const snapshotBaseModel = stripSnapshotSuffix(normalizedModel);
  const modelVariants = new Set([model, normalizedModel, snapshotBaseModel]);

  for (const variant of modelVariants) {
    if (!variant) continue;
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

function stripSnapshotSuffix(model: string): string {
  return model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

function normalizePricing(
  record: LocalModelPricing,
  resolvedModel: string,
  options: ModelPricingOptions
): ModelPricing {
  const pricing = {
    inputCostPerMToken: record.inputCostPerMToken,
    cachedInputCostPerMToken: record.cachedInputCostPerMToken ?? record.inputCostPerMToken,
    outputCostPerMToken: record.outputCostPerMToken,
  };

  if (options.longContext && supportsLongContextPricing(resolvedModel)) {
    pricing.inputCostPerMToken *= 2;
    pricing.outputCostPerMToken *= 1.5;
  }

  return pricing;
}

function supportsLongContextPricing(model: string): boolean {
  const normalized = stripSnapshotSuffix(stripProviderPrefix(model));
  return normalized === "gpt-5.4";
}
