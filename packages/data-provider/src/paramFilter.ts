import { SettingDefinition } from './generate';
import {
  EModelEndpoint,
  Providers,
  BedrockProviders,
  openAISettings,
  anthropicSettings,
  googleSettings,
  bedrockSettings,
  openRouterSettings,
} from './types';
import { ResolvedEndpointType, resolveEndpointType } from './parsers';

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

export interface ResolvedParamFilter {
  resolvedType: ResolvedEndpointType;
  allowedKeys: Set<string>;
  knownClientKeys: Set<string>;
  droppedKeys: Set<string>;
  customKeys: Set<string>;
  keySources: Map<string, ParamKeySource[]>;
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
  ...BASE_OPENAI_KEYS,
  'guardrailIdentifier',
  'guardrailVersion',
  'guardrailConfig',
  'additionalModelRequestFields',
  'additionalModelResponseFieldPaths',
]);

function extractKeysFromSettings(settings: unknown): Set<string> {
  const keys = new Set<string>();
  if (!settings || typeof settings !== 'object') {
    return keys;
  }
  const obj = settings as Record<string, unknown>;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object' && 'key' in item) {
        keys.add((item as { key: string }).key);
      }
    }
    return keys;
  }
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && 'key' in item) {
          keys.add((item as { key: string }).key);
        }
      }
    } else if (value && typeof value === 'object' && 'key' in (value as object)) {
      keys.add((value as { key: string }).key);
    }
  }
  return keys;
}

const SETTINGS_BY_TYPE: Record<ResolvedEndpointType, unknown> = {
  [ResolvedEndpointType.OPENAI]: openAISettings,
  [ResolvedEndpointType.ANTHROPIC]: anthropicSettings,
  [ResolvedEndpointType.GOOGLE]: googleSettings,
  [ResolvedEndpointType.BEDROCK]: bedrockSettings,
  [ResolvedEndpointType.OPENROUTER]: openRouterSettings,
};

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

export function getSettingsParamKeys(
  resolvedType: ResolvedEndpointType | null | undefined,
): Set<string> {
  if (!resolvedType) {
    return extractKeysFromSettings(SETTINGS_BY_TYPE[ResolvedEndpointType.OPENAI]);
  }
  return extractKeysFromSettings(SETTINGS_BY_TYPE[resolvedType]);
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

export function resolveParamFilter(config: ParamFilterConfig): ResolvedParamFilter {
  const {
    resolvedType: explicitType,
    defaultParamsEndpoint,
    paramDefinitions,
    addParams,
    dropParams,
  } = config;

  const resolvedType = explicitType ?? resolveEndpointType(defaultParamsEndpoint ?? null);

  const allowedKeys = new Set<string>();
  const keySources = new Map<string, ParamKeySource[]>();
  const knownClientKeys = getClientParamKeys(resolvedType);
  const customKeys = new Set<string>();

  const addKey = (key: string, source: ParamKeySource) => {
    allowedKeys.add(key);
    const sources = keySources.get(key) ?? [];
    sources.push(source);
    keySources.set(key, sources);
  };

  const schemaKeys = getBaseParamKeys(resolvedType);
  for (const key of schemaKeys) {
    addKey(key, 'schema');
  }

  const settingsKeys = getSettingsParamKeys(resolvedType);
  for (const key of settingsKeys) {
    addKey(key, 'paramSettings');
  }

  const definitionKeys = extractParamDefinitionKeys(paramDefinitions);
  for (const key of definitionKeys) {
    addKey(key, 'paramDefinitions');
    customKeys.add(key);
  }

  if (addParams && typeof addParams === 'object') {
    for (const key of Object.keys(addParams)) {
      addKey(key, 'addParams');
      customKeys.add(key);
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
    resolvedType: resolvedType ?? ResolvedEndpointType.OPENAI,
    allowedKeys,
    knownClientKeys,
    droppedKeys,
    customKeys,
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

export function mergeExtraSchemaFields<T extends Record<string, unknown>>(
  parsed: T,
  raw: Record<string, unknown>,
  filter: ResolvedParamFilter,
): T {
  const result = { ...parsed } as Record<string, unknown>;
  for (const key of filter.customKeys) {
    if (filter.droppedKeys.has(key)) {
      continue;
    }
    if (key in raw && !(key in result)) {
      result[key] = raw[key];
    }
  }
  if (filter.addParams && typeof filter.addParams === 'object') {
    for (const [key, value] of Object.entries(filter.addParams)) {
      if (filter.droppedKeys.has(key)) {
        continue;
      }
      result[key] = value;
    }
  }
  return result as T;
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

export { ResolvedEndpointType };
