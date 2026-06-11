import type { ZodError, ZodSchema } from 'zod';
import { z } from 'zod';
import { generateDynamicSchema, SettingDefinition } from './generate';
import {
  EModelEndpoint,
  Providers,
  BedrockProviders,
  openAISettings,
  anthropicSettings,
  googleSettings,
} from './types';
import { ResolvedEndpointType, resolveParamEndpointType } from './parsers';
import { paramSettings } from './parameterSettings';

type ParamKeySource =
  | 'schema'
  | 'paramSettings'
  | 'paramDefinitions'
  | 'addParams'
  | 'dropParams';

export interface ParamFilterConfig {
  resolvedType?: ResolvedEndpointType | null;
  defaultParamsEndpoint?: string | null;
  paramDefinitions?: Partial<SettingDefinition>[] | null;
  addParams?: Record<string, unknown> | null;
  dropParams?: string[] | null;
}

export interface ParamPolicy {
  resolvedType: ResolvedEndpointType;
  schemaKeys: Set<string>;
  settingsKeys: Set<string>;
  definitionKeys: Set<string>;
  addKeys: Set<string>;
  droppedKeys: Set<string>;
  customKeys: Set<string>;
  allowedKeys: Set<string>;
  clientKeys: Set<string>;
  keySources: Map<string, ParamKeySource[]>;
}

export interface SanitizeResult<T = Record<string, unknown>> {
  verifiedParams: T;
  parseErrors?: ZodError;
  policy: ParamPolicy;
}

export const BASE_OPENAI_KEYS = new Set([
  'chatProjectId',
  'model',
  'modelName',
  'modelLabel',
  'chatGptLabel',
  'promptPrefix',
  'temperature',
  'top_p',
  'topP',
  'presence_penalty',
  'presencePenalty',
  'frequency_penalty',
  'frequencyPenalty',
  'resendFiles',
  'artifacts',
  'imageDetail',
  'stop',
  'stopSequences',
  'iconURL',
  'greeting',
  'spec',
  'maxContextTokens',
  'max_tokens',
  'maxTokens',
  'maxCompletionTokens',
  'reasoning_effort',
  'reasoningEffort',
  'reasoning_summary',
  'reasoningSummary',
  'reasoning',
  'verbosity',
  'useResponsesApi',
  'web_search',
  'disableStreaming',
  'fileTokenLimit',
  'promptCache',
  'n',
  'logitBias',
  'logprobs',
  'topLogprobs',
  'user',
  'timeout',
  'stream',
  'streaming',
  'streamUsage',
  'seed',
  'response_format',
  'parallel_tool_calls',
  'strict',
  'prediction',
  'promptIndex',
  'text',
  'truncation',
  'include',
  'previous_response_id',
  'service_tier',
  'zdrEnabled',
  'supportsStrictToolCalling',
  'configuration',
  'tools',
  'tool_choice',
  'functions',
  'function_call',
  'stream_options',
  'modalities',
  'audio',
  '__includeRawResponse',
  'maxConcurrency',
  'maxRetries',
  'verbose',
]);

export const BASE_ANTHROPIC_KEYS = new Set([
  'chatProjectId',
  'model',
  'modelLabel',
  'promptPrefix',
  'temperature',
  'maxOutputTokens',
  'maxTokens',
  'topP',
  'top_p',
  'topK',
  'top_k',
  'resendFiles',
  'promptCache',
  'thinking',
  'thinkingBudget',
  'effort',
  'thinkingDisplay',
  'artifacts',
  'iconURL',
  'greeting',
  'spec',
  'maxContextTokens',
  'fileTokenLimit',
  'stopSequences',
  'stop',
  'web_search',
  'disableStreaming',
  'anthropicVersion',
  'anthropicApiUrl',
  'defaultHeaders',
  'maxRetries',
  'timeout',
  'apiKey',
  'stream',
  'streaming',
  'streamUsage',
]);

export const BASE_GOOGLE_KEYS = new Set([
  'chatProjectId',
  'model',
  'modelName',
  'modelLabel',
  'promptPrefix',
  'examples',
  'temperature',
  'maxOutputTokens',
  'maxReasoningTokens',
  'artifacts',
  'topP',
  'top_p',
  'topK',
  'top_k',
  'thinking',
  'thinkingBudget',
  'thinkingLevel',
  'web_search',
  'fileTokenLimit',
  'iconURL',
  'greeting',
  'spec',
  'maxContextTokens',
  'stopSequences',
  'stop',
  'seed',
  'presencePenalty',
  'presence_penalty',
  'frequencyPenalty',
  'frequency_penalty',
  'logprobs',
  'topLogprobs',
  'safetySettings',
  'responseModalities',
  'convertSystemMessageToHumanContent',
  'speechConfig',
  'streamUsage',
  'apiKey',
  'baseUrl',
  'endpoint',
  'location',
  'authOptions',
  'customHeaders',
  'includeThoughts',
  'thinkingConfig',
  'disableStreaming',
]);

export const BASE_BEDROCK_KEYS = new Set([
  ...Array.from(BASE_OPENAI_KEYS),
  'guardrailIdentifier',
  'guardrailVersion',
  'guardrailConfig',
  'additionalModelRequestFields',
  'additionalModelResponseFieldPaths',
  'region',
  'system',
  'maxTokens',
]);

const BASE_KEYS_BY_TYPE: Record<ResolvedEndpointType, Set<string>> = {
  [ResolvedEndpointType.OPENAI]: BASE_OPENAI_KEYS,
  [ResolvedEndpointType.ANTHROPIC]: BASE_ANTHROPIC_KEYS,
  [ResolvedEndpointType.GOOGLE]: BASE_GOOGLE_KEYS,
  [ResolvedEndpointType.BEDROCK]: BASE_BEDROCK_KEYS,
  [ResolvedEndpointType.OPENROUTER]: BASE_OPENAI_KEYS,
};

const CLIENT_KEYS_BY_TYPE: Record<ResolvedEndpointType, Set<string>> = {
  [ResolvedEndpointType.OPENAI]: new Set([
    'model',
    'modelName',
    'temperature',
    'topP',
    'top_p',
    'frequencyPenalty',
    'frequency_penalty',
    'presencePenalty',
    'presence_penalty',
    'n',
    'logitBias',
    'stop',
    'stopSequences',
    'user',
    'timeout',
    'stream',
    'streaming',
    'maxTokens',
    'max_tokens',
    'maxCompletionTokens',
    'logprobs',
    'topLogprobs',
    'apiKey',
    'organization',
    'audio',
    'modalities',
    'reasoning',
    'reasoning_effort',
    'zdrEnabled',
    'service_tier',
    'supportsStrictToolCalling',
    'useResponsesApi',
    'configuration',
    'tools',
    'tool_choice',
    'functions',
    'function_call',
    'response_format',
    'seed',
    'stream_options',
    'parallel_tool_calls',
    'strict',
    'prediction',
    'promptIndex',
    'text',
    'truncation',
    'include',
    'previous_response_id',
    '__includeRawResponse',
    'maxConcurrency',
    'maxRetries',
    'verbose',
    'streamUsage',
    'disableStreaming',
    'verbosity',
    'promptCache',
  ]),
  [ResolvedEndpointType.ANTHROPIC]: new Set([
    'model',
    'temperature',
    'topP',
    'topK',
    'maxTokens',
    'maxOutputTokens',
    'stopSequences',
    'stop',
    'stream',
    'apiKey',
    'maxRetries',
    'timeout',
    'anthropicVersion',
    'anthropicApiUrl',
    'defaultHeaders',
    'thinking',
    'thinkingBudget',
    'effort',
    'thinkingDisplay',
    'streaming',
    'streamUsage',
    'disableStreaming',
    'verbosity',
    'promptCache',
  ]),
  [ResolvedEndpointType.GOOGLE]: new Set([
    'model',
    'modelName',
    'temperature',
    'maxOutputTokens',
    'maxReasoningTokens',
    'topP',
    'topK',
    'seed',
    'presencePenalty',
    'frequencyPenalty',
    'stopSequences',
    'stop',
    'logprobs',
    'topLogprobs',
    'safetySettings',
    'responseModalities',
    'convertSystemMessageToHumanContent',
    'speechConfig',
    'streamUsage',
    'apiKey',
    'baseUrl',
    'endpoint',
    'location',
    'authOptions',
    'customHeaders',
    'thinkingConfig',
    'thinkingBudget',
    'thinkingLevel',
    'thinking',
    'includeThoughts',
    'streaming',
    'disableStreaming',
  ]),
  [ResolvedEndpointType.BEDROCK]: new Set([
    'model',
    'modelName',
    'temperature',
    'topP',
    'top_p',
    'frequencyPenalty',
    'frequency_penalty',
    'presencePenalty',
    'presence_penalty',
    'n',
    'logitBias',
    'stop',
    'stopSequences',
    'user',
    'timeout',
    'stream',
    'streaming',
    'maxTokens',
    'max_tokens',
    'maxCompletionTokens',
    'logprobs',
    'topLogprobs',
    'apiKey',
    'audio',
    'modalities',
    'reasoning',
    'reasoning_effort',
    'tools',
    'tool_choice',
    'response_format',
    'seed',
    'stream_options',
    'parallel_tool_calls',
    'guardrailIdentifier',
    'guardrailVersion',
    'guardrailConfig',
    'streamUsage',
    'disableStreaming',
    'verbosity',
    'promptCache',
  ]),
  [ResolvedEndpointType.OPENROUTER]: new Set([
    'model',
    'modelName',
    'temperature',
    'topP',
    'top_p',
    'frequencyPenalty',
    'frequency_penalty',
    'presencePenalty',
    'presence_penalty',
    'n',
    'logitBias',
    'stop',
    'stopSequences',
    'user',
    'timeout',
    'stream',
    'streaming',
    'maxTokens',
    'max_tokens',
    'maxCompletionTokens',
    'logprobs',
    'topLogprobs',
    'apiKey',
    'audio',
    'modalities',
    'reasoning',
    'reasoning_effort',
    'tools',
    'tool_choice',
    'functions',
    'function_call',
    'response_format',
    'seed',
    'stream_options',
    'parallel_tool_calls',
    'promptCache',
    'streamUsage',
    'disableStreaming',
    'verbosity',
    'include_reasoning',
  ]),
};

const PARAM_SETTINGS_KEY: Record<ResolvedEndpointType, string> = {
  [ResolvedEndpointType.OPENAI]: EModelEndpoint.openAI,
  [ResolvedEndpointType.ANTHROPIC]: EModelEndpoint.anthropic,
  [ResolvedEndpointType.GOOGLE]: EModelEndpoint.google,
  [ResolvedEndpointType.OPENROUTER]: Providers.OPENROUTER,
  [ResolvedEndpointType.BEDROCK]: EModelEndpoint.bedrock,
};

export function extractSettingsKeys(
  resolvedType: ResolvedEndpointType | null | undefined,
  defaultParamsEndpoint?: string | null,
): Set<string> {
  const keys = new Set<string>();
  if (!resolvedType) {
    return keys;
  }

  let settingsKey: string | undefined = PARAM_SETTINGS_KEY[resolvedType];

  if (
    defaultParamsEndpoint &&
    Object.prototype.hasOwnProperty.call(paramSettings, defaultParamsEndpoint)
  ) {
    settingsKey = defaultParamsEndpoint;
  }

  if (resolvedType === ResolvedEndpointType.BEDROCK && defaultParamsEndpoint) {
    const bedrockKey = defaultParamsEndpoint.startsWith(EModelEndpoint.bedrock)
      ? defaultParamsEndpoint
      : `${EModelEndpoint.bedrock}-${defaultParamsEndpoint}`;
    if (Object.prototype.hasOwnProperty.call(paramSettings, bedrockKey)) {
      settingsKey = bedrockKey;
    }
  }

  const settings = settingsKey ? paramSettings[settingsKey] : undefined;
  if (settings && Array.isArray(settings)) {
    for (const def of settings) {
      if (def && def.key) {
        keys.add(def.key);
      }
    }
  }

  return keys;
}

export function getBaseParamKeys(
  resolvedType: ResolvedEndpointType | null | undefined,
): Set<string> {
  if (!resolvedType) {
    return new Set(BASE_OPENAI_KEYS);
  }
  return new Set(BASE_KEYS_BY_TYPE[resolvedType] ?? BASE_OPENAI_KEYS);
}

export function getClientParamKeys(
  resolvedType: ResolvedEndpointType | null | undefined,
): Set<string> {
  if (!resolvedType) {
    return new Set(CLIENT_KEYS_BY_TYPE[ResolvedEndpointType.OPENAI]);
  }
  return new Set(CLIENT_KEYS_BY_TYPE[resolvedType] ?? CLIENT_KEYS_BY_TYPE[ResolvedEndpointType.OPENAI]);
}

export function extractParamDefinitionKeys(
  paramDefinitions?: Partial<SettingDefinition>[] | null,
): Set<string> {
  const keys = new Set<string>();
  if (!paramDefinitions || !Array.isArray(paramDefinitions)) {
    return keys;
  }
  for (const def of paramDefinitions) {
    if (def && def.key) {
      keys.add(def.key);
    }
  }
  return keys;
}

export function resolveParamPolicy(config: ParamFilterConfig): ParamPolicy {
  const {
    resolvedType: explicitType,
    defaultParamsEndpoint,
    paramDefinitions,
    addParams,
    dropParams,
  } = config;

  const resolvedType = explicitType ?? resolveParamEndpointType(defaultParamsEndpoint ?? null) ?? ResolvedEndpointType.OPENAI;

  const schemaKeys = getBaseParamKeys(resolvedType);
  const settingsKeys = extractSettingsKeys(resolvedType, defaultParamsEndpoint);
  const definitionKeys = extractParamDefinitionKeys(paramDefinitions);
  const clientKeys = getClientParamKeys(resolvedType);

  const allowedKeys = new Set<string>();
  const keySources = new Map<string, ParamKeySource[]>();
  const customKeys = new Set<string>();
  const addKeys = new Set<string>();

  const addKey = (key: string, source: ParamKeySource) => {
    allowedKeys.add(key);
    const sources = keySources.get(key) ?? [];
    sources.push(source);
    keySources.set(key, sources);
  };

  schemaKeys.forEach((key) => {
    addKey(key, 'schema');
  });

  settingsKeys.forEach((key) => {
    if (!schemaKeys.has(key)) {
      addKey(key, 'paramSettings');
      customKeys.add(key);
    } else {
      const sources = keySources.get(key) ?? [];
      sources.push('paramSettings');
      keySources.set(key, sources);
    }
  });

  definitionKeys.forEach((key) => {
    if (!allowedKeys.has(key)) {
      customKeys.add(key);
    }
    addKey(key, 'paramDefinitions');
  });

  if (addParams && typeof addParams === 'object') {
    for (const key of Object.keys(addParams)) {
      addKeys.add(key);
      if (!allowedKeys.has(key)) {
        customKeys.add(key);
      }
      addKey(key, 'addParams');
    }
  }

  const droppedKeys = new Set<string>();
  if (dropParams && Array.isArray(dropParams)) {
    for (const key of dropParams) {
      droppedKeys.add(key);
      allowedKeys.delete(key);
      const sources = keySources.get(key) ?? [];
      sources.push('dropParams');
      keySources.set(key, sources);
    }
  }

  return {
    resolvedType,
    schemaKeys,
    settingsKeys,
    definitionKeys,
    addKeys,
    droppedKeys,
    customKeys,
    allowedKeys,
    clientKeys,
    keySources,
  };
}

export function filterObjectByAllowedKeys<T extends Record<string, unknown>>(
  obj: T,
  allowedKeys: Set<string>,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (allowedKeys.has(key)) {
      result[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return result as Partial<T>;
}

export function isCustomBedrockKey(defaultParamsEndpoint?: string | null): boolean {
  if (!defaultParamsEndpoint) {
    return false;
  }
  return defaultParamsEndpoint.startsWith(`${EModelEndpoint.bedrock}-`);
}

export function resolveBedrockProviderFromKey(
  defaultParamsEndpoint: string,
): BedrockProviders | undefined {
  if (!defaultParamsEndpoint.startsWith(`${EModelEndpoint.bedrock}-`)) {
    return undefined;
  }
  return defaultParamsEndpoint.slice(`${EModelEndpoint.bedrock}-`.length) as BedrockProviders;
}

export function sanitizeModelParams<T extends Record<string, unknown>>({
  rawParams,
  schema,
  filterConfig,
}: {
  rawParams: T;
  schema: ZodSchema<T>;
  filterConfig: ParamFilterConfig;
}): SanitizeResult<T> {
  const policy = resolveParamPolicy(filterConfig);

  const mergedRaw: Record<string, unknown> = {};
  if (filterConfig.addParams && typeof filterConfig.addParams === 'object') {
    for (const [key, value] of Object.entries(filterConfig.addParams)) {
      mergedRaw[key] = value;
    }
  }
  for (const [key, value] of Object.entries(rawParams)) {
    mergedRaw[key] = value;
  }

  const schemaParams: Record<string, unknown> = {};
  const customParams: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(mergedRaw)) {
    if (policy.droppedKeys.has(key)) {
      continue;
    }
    if (!policy.allowedKeys.has(key)) {
      continue;
    }

    if (policy.schemaKeys.has(key)) {
      schemaParams[key] = value;
    } else {
      customParams[key] = value;
    }
  }

  let parseErrors: ZodError | undefined;
  let parsedSchemaParams: T;
  try {
    parsedSchemaParams = schema.parse(schemaParams) as T;
  } catch (error) {
    parseErrors = error as ZodError;
    parsedSchemaParams = schemaParams as T;
  }

  const settingsPlusDefs: SettingDefinition[] = [];
  const settingsKey = PARAM_SETTINGS_KEY[policy.resolvedType];
  const settingsConfig = settingsKey ? paramSettings[settingsKey] : undefined;
  if (settingsConfig && Array.isArray(settingsConfig)) {
    for (const def of settingsConfig) {
      if (def && def.key && !policy.schemaKeys.has(def.key)) {
        settingsPlusDefs.push(def as SettingDefinition);
      }
    }
  }
  if (filterConfig.paramDefinitions && Array.isArray(filterConfig.paramDefinitions)) {
    for (const def of filterConfig.paramDefinitions) {
      if (def && def.key) {
        settingsPlusDefs.push(def as SettingDefinition);
      }
    }
  }

  if (settingsPlusDefs.length > 0) {
    const customSchema = generateDynamicSchema(settingsPlusDefs);

    const customKeysToValidate: Record<string, unknown> = {};
    for (const def of settingsPlusDefs) {
      if (!def || !def.key) {
        continue;
      }
      if (policy.droppedKeys.has(def.key)) {
        continue;
      }
      if (def.key in customParams) {
        customKeysToValidate[def.key] = customParams[def.key];
      } else if (def.default !== undefined) {
        customKeysToValidate[def.key] = def.default;
      }
    }

    try {
      const validatedCustom = customSchema.parse(customKeysToValidate) as Record<string, unknown>;
      for (const [key, value] of Object.entries(validatedCustom)) {
        customParams[key] = value;
      }
    } catch (error) {
      const customErrors = error as ZodError;
      if (!parseErrors) {
        parseErrors = new z.ZodError([]);
      }
      parseErrors.issues.push(...customErrors.issues);
    }
  }

  const verifiedParams = {
    ...parsedSchemaParams,
    ...customParams,
  } as T;

  return {
    verifiedParams,
    parseErrors,
    policy,
  };
}

export { ResolvedEndpointType };
