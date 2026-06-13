import {
  EModelEndpoint,
  resolveCapability,
  enrichModelsWithCapabilityResolver,
  stripUnsupportedByCapability,
  detectCapabilityChange,
  type CapabilityOverride,
  type TModelCapability,
  type TModelInfo,
  type StripTarget,
} from 'librechat-data-provider';
import { logger } from '@librechat/data-schemas';
import type { TConfig } from 'librechat-data-provider';

export function defaultCapability(): TModelCapability {
  return resolveCapability({
    endpoint: EModelEndpoint.custom,
    model: '',
  });
}

export function detectOpenAICapability(
  model: string,
  configOverride?: CapabilityOverride,
): TModelCapability {
  return resolveCapability({
    endpoint: EModelEndpoint.openAI,
    model,
    configOverride,
  });
}

export function detectAnthropicCapability(
  model: string,
  configOverride?: CapabilityOverride,
): TModelCapability {
  return resolveCapability({
    endpoint: EModelEndpoint.anthropic,
    model,
    configOverride,
  });
}

export function detectGoogleCapability(
  model: string,
  configOverride?: CapabilityOverride,
): TModelCapability {
  return resolveCapability({
    endpoint: EModelEndpoint.google,
    model,
    configOverride,
  });
}

export function detectBedrockCapability(
  model: string,
  configOverride?: CapabilityOverride,
): TModelCapability {
  return resolveCapability({
    endpoint: EModelEndpoint.bedrock,
    model,
    configOverride,
  });
}

export function detectCustomCapability(
  model: string,
  baseURL?: string,
  configOverride?: CapabilityOverride,
): TModelCapability {
  return resolveCapability({
    endpoint: EModelEndpoint.custom,
    model,
    baseURL,
    configOverride,
  });
}

export function extractCapabilitiesFromEndpointConfig(
  endpointConfig?: Partial<TConfig> | null,
): CapabilityOverride | undefined {
  if (!endpointConfig) {
    return undefined;
  }
  const caps = endpointConfig.capabilities;
  if (!caps || !Array.isArray(caps)) {
    return undefined;
  }
  const overrides: CapabilityOverride = {};
  for (const key of caps) {
    const normalized = key.toLowerCase();
    (overrides as Record<string, boolean>)[normalized] = true;
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

export function extractModelCapabilitiesFromEndpointConfig(
  endpointConfig?: Partial<TConfig> | null,
): Record<string, CapabilityOverride> | undefined {
  if (!endpointConfig) {
    return undefined;
  }
  const modelConfig = (endpointConfig as unknown as { models?: Record<string, { capabilities?: string[] } | undefined> }).models;
  if (!modelConfig || typeof modelConfig !== 'object') {
    return undefined;
  }
  const result: Record<string, CapabilityOverride> = {};
  for (const [modelName, cfg] of Object.entries(modelConfig)) {
    const caps = cfg?.capabilities;
    if (!caps || !Array.isArray(caps)) {
      continue;
    }
    const overrides: CapabilityOverride = {};
    for (const key of caps) {
      const normalized = key.toLowerCase();
      (overrides as Record<string, boolean>)[normalized] = true;
    }
    if (Object.keys(overrides).length > 0) {
      result[modelName] = overrides;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function enrichModelsWithCapabilities(
  models: string[],
  endpoint: string,
  baseURL?: string,
  endpointConfig?: Partial<TConfig> | null,
): TModelInfo[] {
  const endpointOverride = extractCapabilitiesFromEndpointConfig(endpointConfig);
  const modelOverrides = extractModelCapabilitiesFromEndpointConfig(endpointConfig);
  const allOverrides: Record<string, CapabilityOverride> = { ...modelOverrides };
  if (endpointOverride) {
    for (const m of models) {
      if (!allOverrides[m]) {
        allOverrides[m] = endpointOverride;
      } else {
        allOverrides[m] = { ...endpointOverride, ...allOverrides[m] };
      }
    }
  }
  return enrichModelsWithCapabilityResolver(models, endpoint, allOverrides, baseURL);
}

export function resolveAndStripUnsupported(
  target: StripTarget,
  options: {
    endpoint: string;
    model: string;
    baseURL?: string;
    endpointConfig?: Partial<TConfig> | null;
  },
): { stripped: StripTarget; capability: TModelCapability } {
  const configOverride = extractCapabilitiesFromEndpointConfig(options.endpointConfig);
  const capability = resolveCapability({
    endpoint: options.endpoint,
    model: options.model,
    baseURL: options.baseURL,
    configOverride,
  });
  logger.debug(
    `[capability] Resolved capability for ${options.endpoint}/${options.model}: vision=${capability.vision}, ` +
      `tool_calling=${capability.tool_calling}, reasoning_effort=${capability.reasoning_effort}, ` +
      `thinking=${capability.thinking}, json_mode=${capability.json_mode}`,
  );
  const stripped = stripUnsupportedByCapability(target, capability);
  return { stripped, capability };
}

export { stripUnsupportedByCapability, detectCapabilityChange };
