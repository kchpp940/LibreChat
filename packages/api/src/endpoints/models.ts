import axios from 'axios';
import crypto from 'crypto';
import { logger } from '@librechat/data-schemas';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  Time,
  CacheKeys,
  KnownEndpoints,
  EModelEndpoint,
  defaultModels,
  Providers,
} from 'librechat-data-provider';
import type { TModelInfo } from 'librechat-data-provider';
import type { IUser } from '@librechat/data-schemas';
import { enrichModelsWithCapabilities } from './capabilities';
import {
  processModelData,
  extractBaseURL,
  isUserProvided,
  resolveHeaders,
  deriveBaseURL,
  logAxiosError,
  inputSchema,
} from '~/utils';
import { standardCache, tokenConfigCache } from '~/cache';

export interface FetchModelsParams {
  /** User ID for API requests */
  user?: string;
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API */
  baseURL?: string;
  /** Endpoint name (defaults to 'openAI') */
  name?: string;
  /** Whether directEndpoint was configured */
  direct?: boolean;
  /** Whether to fetch from Azure */
  azure?: boolean;
  /** Whether to send user ID as query parameter */
  userIdQuery?: boolean;
  /** Whether to create token configuration from API response */
  createTokenConfig?: boolean;
  /** Cache key for token configuration (uses name if omitted) */
  tokenKey?: string;
  /** Optional headers for the request */
  headers?: Record<string, string> | null;
  /** Optional user object for header resolution */
  userObject?: Partial<IUser>;
  /** Skip MODEL_QUERIES cache (e.g., for user-provided keys) */
  skipCache?: boolean;
}

/**
 * Fetches Ollama models from the specified base API path.
 * @param baseURL - The Ollama server URL
 * @param options - Optional configuration
 * @returns Promise resolving to array of model names
 */
async function fetchOllamaModels(
  baseURL: string,
  options: { headers?: Record<string, string> | null; user?: Partial<IUser> } = {},
): Promise<string[]> {
  if (!baseURL) {
    return [];
  }

  const ollamaEndpoint = deriveBaseURL(baseURL);

  const resolvedHeaders = resolveHeaders({
    headers: options.headers ?? undefined,
    user: options.user,
  });

  const response = await axios.get<{ models: Array<{ name: string }> }>(
    `${ollamaEndpoint}/api/tags`,
    {
      headers: resolvedHeaders,
      timeout: 5000,
    },
  );

  return response.data.models.map((tag) => tag.name);
}

/**
 * Splits a string by commas and trims each resulting value.
 * @param input - The input string to split.
 * @returns An array of trimmed values.
 */
export function splitAndTrim(input: string | null | undefined): string[] {
  if (!input || typeof input !== 'string') {
    return [];
  }
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Fetches models from the specified base API path or Azure, based on the provided configuration.
 *
 * @param params - The parameters for fetching the models.
 * @returns A promise that resolves to an array of model identifiers.
 */
export async function fetchModels({
  user,
  apiKey,
  baseURL: _baseURL,
  name = EModelEndpoint.openAI,
  direct = false,
  azure = false,
  userIdQuery = false,
  createTokenConfig = true,
  tokenKey,
  headers,
  userObject,
  skipCache = false,
}: FetchModelsParams): Promise<string[] | TModelInfo[]> {
  let models: string[] = [];
  const baseURL = direct ? extractBaseURL(_baseURL ?? '') : _baseURL;

  if (!baseURL && !azure) {
    return models;
  }

  if (!apiKey) {
    return models;
  }

  const hasUserScopedHeaders = !!headers && Object.keys(headers).length > 0 && !!userObject;
  const shouldCache = !skipCache && !(userIdQuery && user) && !hasUserScopedHeaders;
  const cacheKey = shouldCache ? modelsCacheKey(baseURL ?? '', apiKey) : '';
  const modelsCache = shouldCache ? standardCache(CacheKeys.MODEL_QUERIES) : null;
  if (modelsCache && cacheKey) {
    const cachedModels = await modelsCache.get(cacheKey);
    if (cachedModels) {
      return cachedModels as string[];
    }
  }

  if (name && name.toLowerCase().startsWith(KnownEndpoints.ollama)) {
    let ollamaModels: string[] | null = null;
    try {
      ollamaModels = await fetchOllamaModels(baseURL ?? '', { headers, user: userObject });
    } catch (ollamaError) {
      logAxiosError({
        message:
          'Failed to fetch models from Ollama API. Attempting to fetch via OpenAI-compatible endpoint.',
        error: ollamaError as Error,
      });
    }
    if (ollamaModels !== null) {
      if (modelsCache && cacheKey && ollamaModels.length > 0) {
        await modelsCache.set(cacheKey, ollamaModels, Time.TWO_MINUTES);
      }
      if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
        return ollamaModels;
      }
      return enrichModelsWithCapabilities(ollamaModels, (name ?? EModelEndpoint.custom) as EModelEndpoint, baseURL ?? undefined);
    }
  }

  try {
    const resolvedHeaders = resolveHeaders({
      headers: headers ?? undefined,
      user: userObject,
    });

    const options: {
      headers: Record<string, string>;
      timeout: number;
      httpsAgent?: HttpsProxyAgent<string>;
    } = {
      headers: {
        ...resolvedHeaders,
      },
      timeout: 5000,
    };

    if (name === EModelEndpoint.anthropic) {
      options.headers = {
        'x-api-key': apiKey,
        'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
      };
    } else {
      const hasAuthHeader = Object.keys(options.headers).some(
        (k) => k.toLowerCase() === 'authorization',
      );
      if (!hasAuthHeader) {
        options.headers.Authorization = `Bearer ${apiKey}`;
      }
    }

    if (process.env.PROXY) {
      options.httpsAgent = new HttpsProxyAgent(process.env.PROXY);
    }

    if (process.env.OPENAI_ORGANIZATION && baseURL?.includes('openai')) {
      options.headers['OpenAI-Organization'] = process.env.OPENAI_ORGANIZATION;
    }

    const url = new URL(`${(baseURL ?? '').replace(/\/+$/, '')}${azure ? '' : '/models'}`);
    if (user && userIdQuery) {
      url.searchParams.append('user', user);
    }
    const res = await axios.get(url.toString(), options);

    const input = res.data;

    const validationResult = inputSchema.safeParse(input);
    if (validationResult.success && createTokenConfig) {
      const endpointTokenConfig = processModelData(input);
      await tokenConfigCache().set(tokenKey ?? name, endpointTokenConfig);
    }
    models = input.data.map((item: { id: string }) => item.id);
  } catch (error) {
    const logMessage = `Failed to fetch models from ${azure ? 'Azure ' : ''}${name} API`;
    logAxiosError({ message: logMessage, error: error as Error });
  }

  if (modelsCache && cacheKey && models.length > 0) {
    await modelsCache.set(cacheKey, models, Time.TWO_MINUTES);
  }

  if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
    return models;
  }

  const enrichedEndpoints = [
    EModelEndpoint.openAI,
    EModelEndpoint.azureOpenAI,
    EModelEndpoint.assistants,
    EModelEndpoint.azureAssistants,
    EModelEndpoint.anthropic,
    EModelEndpoint.google,
    EModelEndpoint.bedrock,
    EModelEndpoint.custom,
  ];

  if (enrichedEndpoints.includes((name ?? EModelEndpoint.custom) as EModelEndpoint)) {
    return enrichModelsWithCapabilities(models, (name ?? EModelEndpoint.custom) as EModelEndpoint, baseURL ?? undefined);
  }

  return models;
}

function modelsCacheKey(baseURL: string, apiKey: string): string {
  return crypto.createHash('sha256').update(`${baseURL}:${apiKey}`).digest('hex').slice(0, 32);
}

/** Options for fetching OpenAI models */
export interface GetOpenAIModelsOptions {
  /** User ID for API requests */
  user?: string;
  /** Whether to fetch from Azure */
  azure?: boolean;
  /** Whether to fetch models for the Assistants endpoint */
  assistants?: boolean;
  /** OpenAI API key (if not using environment variable) */
  openAIApiKey?: string;
  /** Skip MODEL_QUERIES cache (e.g., for user-provided keys) */
  skipCache?: boolean;
}

function resolveOpenAIApiKey(opts: GetOpenAIModelsOptions): string | undefined {
  return opts.openAIApiKey || process.env.OPENAI_API_KEY;
}

/**
 * Fetches models from OpenAI or Azure based on the provided options.
 * @param opts - Options for fetching models
 * @param _models - Fallback models array
 * @returns Promise resolving to array of model IDs
 */
export async function fetchOpenAIModels(
  opts: GetOpenAIModelsOptions,
  _models: string[] = [],
): Promise<string[] | TModelInfo[]> {
  let models: string[] = _models.slice() ?? [];
  const apiKey = resolveOpenAIApiKey(opts);
  const openaiBaseURL = 'https://api.openai.com/v1';
  let baseURL = openaiBaseURL;
  let reverseProxyUrl = process.env.OPENAI_REVERSE_PROXY;

  if (opts.assistants && process.env.ASSISTANTS_BASE_URL) {
    reverseProxyUrl = process.env.ASSISTANTS_BASE_URL;
  } else if (opts.azure) {
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return models;
    }
    const endpoint = opts.assistants ? EModelEndpoint.azureAssistants : EModelEndpoint.azureOpenAI;
    return enrichModelsWithCapabilities(models, endpoint);
  }

  if (reverseProxyUrl) {
    baseURL = extractBaseURL(reverseProxyUrl) ?? openaiBaseURL;
  }

  if (baseURL || opts.azure) {
    const fetchedModels = await fetchModels({
      apiKey: apiKey ?? '',
      baseURL,
      azure: opts.azure,
      user: opts.user,
      name: EModelEndpoint.openAI,
      skipCache: opts.skipCache,
    });
    if (Array.isArray(fetchedModels) && fetchedModels.length > 0 && typeof fetchedModels[0] === 'object') {
      if (_models.length === 0) {
        return fetchedModels;
      }
      const modelNames = (fetchedModels as TModelInfo[]).map((m) => m.model);
      const regex = /(text-davinci-003|gpt-|o\d+|chat-latest)/;
      const excludeRegex = /audio|realtime/;
      const filteredNames = modelNames.filter((model) => regex.test(model) && !excludeRegex.test(model));
      const instructModels = filteredNames.filter((model) => model.includes('instruct'));
      const otherModels = filteredNames.filter((model) => !model.includes('instruct'));
      const orderedNames = otherModels.concat(instructModels);
      return (fetchedModels as TModelInfo[]).filter((m) => orderedNames.includes(m.model));
    }
    models = fetchedModels as string[];
  }

  if (models.length === 0) {
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return _models;
    }
    const endpoint = opts.assistants
      ? EModelEndpoint.assistants
      : opts.azure
        ? EModelEndpoint.azureOpenAI
        : EModelEndpoint.openAI;
    return enrichModelsWithCapabilities(_models, endpoint);
  }

  if (baseURL === openaiBaseURL) {
    const regex = /(text-davinci-003|gpt-|o\d+|chat-latest)/;
    const excludeRegex = /audio|realtime/;
    models = models.filter((model) => regex.test(model) && !excludeRegex.test(model));
    const instructModels = models.filter((model) => model.includes('instruct'));
    const otherModels = models.filter((model) => !model.includes('instruct'));
    models = otherModels.concat(instructModels);
  }

  if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
    return models;
  }

  const endpoint = opts.assistants
    ? EModelEndpoint.assistants
    : opts.azure
      ? EModelEndpoint.azureOpenAI
      : EModelEndpoint.openAI;
  return enrichModelsWithCapabilities(models, endpoint);
}

/**
 * Loads the default models for OpenAI or Azure.
 * @param opts - Options for getting models
 * @returns Promise resolving to array of model IDs
 */
export async function getOpenAIModels(
  opts: GetOpenAIModelsOptions = {},
): Promise<string[] | TModelInfo[]> {
  let models = defaultModels[EModelEndpoint.openAI];

  if (opts.assistants) {
    models = defaultModels[EModelEndpoint.assistants];
  } else if (opts.azure) {
    models = defaultModels[EModelEndpoint.azureAssistants];
  }

  let key: string;
  if (opts.assistants) {
    key = 'ASSISTANTS_MODELS';
  } else if (opts.azure) {
    key = 'AZURE_OPENAI_MODELS';
  } else {
    key = 'OPENAI_MODELS';
  }

  if (process.env[key]) {
    const trimmed = splitAndTrim(process.env[key]);
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return trimmed;
    }
    const endpoint = opts.assistants
      ? EModelEndpoint.assistants
      : opts.azure
        ? EModelEndpoint.azureOpenAI
        : EModelEndpoint.openAI;
    return enrichModelsWithCapabilities(trimmed, endpoint);
  }

  if (isUserProvided(resolveOpenAIApiKey(opts))) {
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return models;
    }
    const endpoint = opts.assistants
      ? EModelEndpoint.assistants
      : opts.azure
        ? EModelEndpoint.azureOpenAI
        : EModelEndpoint.openAI;
    return enrichModelsWithCapabilities(models, endpoint);
  }

  return await fetchOpenAIModels(opts, models);
}

/**
 * Fetches models from the Anthropic API.
 * @param opts - Options for fetching models
 * @param _models - Fallback models array
 * @returns Promise resolving to array of model IDs
 */
export async function fetchAnthropicModels(
  opts: { user?: string; skipCache?: boolean } = {},
  _models: string[] = [],
): Promise<string[] | TModelInfo[]> {
  let models: string[] = _models.slice() ?? [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const anthropicBaseURL = 'https://api.anthropic.com/v1';
  let baseURL = anthropicBaseURL;
  const reverseProxyUrl = process.env.ANTHROPIC_REVERSE_PROXY;

  if (reverseProxyUrl) {
    baseURL = extractBaseURL(reverseProxyUrl) ?? anthropicBaseURL;
  }

  if (!apiKey) {
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return models;
    }
    return enrichModelsWithCapabilities(models, EModelEndpoint.anthropic);
  }

  if (baseURL) {
    const fetchedModels = await fetchModels({
      apiKey,
      baseURL,
      user: opts.user,
      name: EModelEndpoint.anthropic,
      tokenKey: EModelEndpoint.anthropic,
      skipCache: opts.skipCache,
    });
    if (Array.isArray(fetchedModels) && fetchedModels.length > 0 && typeof fetchedModels[0] === 'object') {
      return fetchedModels;
    }
    models = fetchedModels as string[];
  }

  if (models.length === 0) {
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return _models;
    }
    return enrichModelsWithCapabilities(_models, EModelEndpoint.anthropic);
  }

  if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
    return models;
  }

  return enrichModelsWithCapabilities(models, EModelEndpoint.anthropic);
}

/**
 * Gets Anthropic models from environment or API.
 * @param opts - Options for fetching models
 * @returns Promise resolving to array of model IDs
 */
export async function getAnthropicModels(
  opts: { user?: string; vertexModels?: string[] } = {},
): Promise<string[] | TModelInfo[]> {
  const models = defaultModels[EModelEndpoint.anthropic];

  if (opts.vertexModels && opts.vertexModels.length > 0) {
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return opts.vertexModels;
    }
    return enrichModelsWithCapabilities(opts.vertexModels, EModelEndpoint.anthropic);
  }

  if (process.env.ANTHROPIC_MODELS) {
    const trimmed = splitAndTrim(process.env.ANTHROPIC_MODELS);
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return trimmed;
    }
    return enrichModelsWithCapabilities(trimmed, EModelEndpoint.anthropic);
  }

  if (isUserProvided(process.env.ANTHROPIC_API_KEY)) {
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return models;
    }
    return enrichModelsWithCapabilities(models, EModelEndpoint.anthropic);
  }

  try {
    return await fetchAnthropicModels(opts, models);
  } catch (error) {
    logger.error('Error fetching Anthropic models:', error);
    if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
      return models;
    }
    return enrichModelsWithCapabilities(models, EModelEndpoint.anthropic);
  }
}

/**
 * Gets Google models from environment or defaults.
 * @returns Array of model IDs
 */
export function getGoogleModels(): string[] | TModelInfo[] {
  let models = defaultModels[EModelEndpoint.google];
  if (process.env.GOOGLE_MODELS) {
    models = splitAndTrim(process.env.GOOGLE_MODELS);
  }
  if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
    return models;
  }
  return enrichModelsWithCapabilities(models, EModelEndpoint.google);
}

/**
 * Gets Bedrock models from environment or defaults.
 * @returns Array of model IDs
 */
export function getBedrockModels(): string[] | TModelInfo[] {
  let models = defaultModels[EModelEndpoint.bedrock];
  if (process.env.BEDROCK_AWS_MODELS) {
    models = splitAndTrim(process.env.BEDROCK_AWS_MODELS);
  }
  if (process.env.MODELS_CAPABILITIES_DISABLED === 'true') {
    return models;
  }
  return enrichModelsWithCapabilities(models, EModelEndpoint.bedrock);
}


