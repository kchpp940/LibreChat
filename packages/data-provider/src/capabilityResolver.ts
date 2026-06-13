import { EModelEndpoint } from './schemas';
import type { TModelCapability } from './schemas';

export type CapabilityOverride = Partial<TModelCapability>;

export const baseCapability: TModelCapability = {
  vision: false,
  file_upload: false,
  file_search: false,
  audio_input: false,
  video_input: false,
  tool_calling: false,
  web_search: false,
  code_interpreter: false,
  mcp: false,
  skills: false,
  agents: false,
  subagents: false,
  json_mode: false,
  structured_output: false,
  streaming: true,
  thinking: false,
  artifacts: false,
  reasoning_effort: false,
  supports_temperature: true,
  supports_top_p: true,
  supports_top_k: false,
  supports_frequency_penalty: false,
  supports_presence_penalty: false,
  supports_stop: false,
  supports_max_tokens: true,
  anthropic_thinking: false,
  anthropic_effort: false,
  google_thinking: false,
  prompt_caching: false,
  image_detail: false,
  resend_files: true,
  prompt_prefix: true,
};

export const providerDefaults: Record<string, Partial<TModelCapability>> = {
  [EModelEndpoint.openAI]: {
    tool_calling: true,
    json_mode: true,
    structured_output: true,
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    supports_frequency_penalty: true,
    supports_presence_penalty: true,
    supports_stop: true,
    supports_max_tokens: true,
    resend_files: true,
    prompt_prefix: true,
  },
  [EModelEndpoint.azureOpenAI]: {
    tool_calling: true,
    json_mode: true,
    structured_output: true,
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    supports_frequency_penalty: true,
    supports_presence_penalty: true,
    supports_stop: true,
    supports_max_tokens: true,
    resend_files: true,
    prompt_prefix: true,
  },
  [EModelEndpoint.assistants]: {
    tool_calling: true,
    code_interpreter: true,
    file_search: true,
    mcp: true,
    agents: true,
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    resend_files: true,
  },
  [EModelEndpoint.azureAssistants]: {
    tool_calling: true,
    code_interpreter: true,
    file_search: true,
    mcp: true,
    agents: true,
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    resend_files: true,
  },
  [EModelEndpoint.anthropic]: {
    tool_calling: true,
    vision: true,
    file_upload: true,
    prompt_caching: true,
    anthropic_thinking: true,
    anthropic_effort: true,
    thinking: true,
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    supports_top_k: true,
    supports_max_tokens: true,
    resend_files: true,
    prompt_prefix: true,
  },
  [EModelEndpoint.google]: {
    tool_calling: true,
    vision: true,
    file_upload: true,
    google_thinking: true,
    thinking: true,
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    supports_top_k: true,
    supports_max_tokens: true,
    resend_files: true,
    prompt_prefix: true,
  },
  [EModelEndpoint.bedrock]: {
    tool_calling: true,
    vision: true,
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    supports_top_k: true,
    supports_max_tokens: true,
    resend_files: true,
    prompt_prefix: true,
  },
  [EModelEndpoint.agents]: {
    agents: true,
    subagents: true,
    tool_calling: true,
    mcp: true,
    skills: true,
    web_search: true,
    code_interpreter: true,
    file_search: true,
    streaming: true,
    resend_files: true,
  },
  [EModelEndpoint.custom]: {
    streaming: true,
    supports_temperature: true,
    supports_top_p: true,
    supports_max_tokens: true,
    resend_files: true,
    prompt_prefix: true,
  },
};

function mergeCapabilities(
  base: TModelCapability,
  overrides: CapabilityOverride | undefined,
): TModelCapability {
  if (!overrides) {
    return base;
  }
  const result = { ...base };
  for (const key of Object.keys(overrides) as Array<keyof TModelCapability>) {
    const value = overrides[key];
    if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

function heuristicOpenAI(model: string): Partial<TModelCapability> {
  const m = model.toLowerCase();
  const out: Partial<TModelCapability> = {};

  if (m.includes('o1') || m.includes('o3')) {
    out.reasoning_effort = true;
    out.thinking = true;
    out.supports_temperature = false;
    out.supports_top_p = false;
    out.json_mode = false;
  }

  if (m.includes('gpt-4o') || m.includes('gpt-4.5') || m.includes('gpt-5')) {
    out.vision = true;
    out.file_upload = true;
    out.tool_calling = true;
    out.json_mode = true;
    out.structured_output = true;
    out.artifacts = m.includes('search') || m.includes('gpt-4o.5') || m.includes('gpt-4.5') || m.includes('gpt-5');
    out.web_search = m.includes('search') || m.includes('gpt-4o-mini') || m.includes('gpt-4o') || m.includes('gpt-4.5') || m.includes('gpt-5');
    out.code_interpreter = m.includes('search') || m.includes('gpt-4.5') || m.includes('gpt-5');
    out.image_detail = true;
  }

  if (m.includes('gpt-4-turbo') || m.includes('gpt-4-vision')) {
    out.vision = true;
    out.image_detail = true;
    out.tool_calling = true;
    out.json_mode = true;
    out.structured_output = true;
    out.supports_frequency_penalty = true;
    out.supports_presence_penalty = true;
  }

  if (m.includes('gpt-4') && !m.includes('mini')) {
    out.tool_calling = true;
    out.json_mode = true;
    out.structured_output = true;
    out.supports_frequency_penalty = true;
    out.supports_presence_penalty = true;
  }

  if (m.includes('gpt-3.5') || m.includes('gpt-35')) {
    out.tool_calling = true;
    out.json_mode = true;
    out.supports_frequency_penalty = true;
    out.supports_presence_penalty = true;
  }

  return out;
}

function heuristicAnthropic(model: string): Partial<TModelCapability> {
  const m = model.toLowerCase();
  const out: Partial<TModelCapability> = {};

  if (m.includes('claude-3-5-sonnet') || m.includes('claude-3.5-sonnet') || m.includes('claude-3-7') || m.includes('claude-3.7')) {
    out.anthropic_thinking = true;
    out.anthropic_effort = true;
    out.thinking = true;
    out.tool_calling = true;
    out.artifacts = true;
    out.vision = true;
    out.file_upload = true;
    out.prompt_caching = true;
  }

  if (m.includes('claude-3-opus')) {
    out.artifacts = true;
    out.tool_calling = true;
    out.vision = true;
    out.file_upload = true;
    out.prompt_caching = true;
  }

  if (m.includes('claude-3-sonnet')) {
    out.tool_calling = true;
    out.vision = true;
    out.file_upload = true;
    out.prompt_caching = true;
  }

  if (m.includes('claude-3-haiku')) {
    out.vision = true;
    out.file_upload = true;
    out.prompt_caching = true;
  }

  return out;
}

function heuristicGoogle(model: string): Partial<TModelCapability> {
  const m = model.toLowerCase();
  const out: Partial<TModelCapability> = {};

  if (m.includes('gemini-2.5') || m.includes('gemini-3') || m.includes('gemini 2.5') || m.includes('gemini 3')) {
    out.google_thinking = true;
    out.thinking = true;
    out.tool_calling = true;
    out.vision = true;
    out.file_upload = true;
    out.web_search = m.includes('search') || m.includes('-thinking') || m.includes('flash');
    out.code_interpreter = m.includes('thinking') || m.includes('pro') || m.includes('ultra');
  }

  if (m.includes('gemini-2') || m.includes('gemini 2')) {
    out.tool_calling = true;
    out.vision = true;
    out.file_upload = true;
    out.google_thinking = m.includes('thinking');
    out.thinking = m.includes('thinking');
  }

  if (m.includes('gemini-1.5') || m.includes('gemini 1.5')) {
    out.tool_calling = true;
    out.vision = true;
    out.file_upload = true;
    out.supports_top_k = true;
  }

  return out;
}

function heuristicBedrock(model: string): Partial<TModelCapability> {
  const m = model.toLowerCase();
  const out: Partial<TModelCapability> = {};

  if (m.includes('anthropic') || m.includes('claude')) {
    out.tool_calling = true;
    out.vision = m.includes('sonnet') || m.includes('opus');
    out.prompt_caching = true;
    out.supports_top_k = true;
  }

  if (m.includes('meta') || m.includes('llama')) {
    out.vision = m.includes('vision');
    out.tool_calling = m.includes('tool') || m.includes('3.2') || m.includes('3.3');
  }

  if (m.includes('cohere')) {
    out.tool_calling = true;
  }

  if (m.includes('mistral')) {
    out.tool_calling = m.includes('large') || m.includes('mixtral');
  }

  if (m.includes('amazon') || m.includes('titan')) {
    out.supports_frequency_penalty = true;
    out.supports_presence_penalty = true;
  }

  return out;
}

function heuristicCustom(model: string, baseURL?: string): Partial<TModelCapability> {
  const m = model.toLowerCase();
  const url = (baseURL || '').toLowerCase();
  const out: Partial<TModelCapability> = {};

  if (url.includes('openrouter')) {
    out.supports_temperature = true;
    out.supports_top_p = true;
    out.supports_max_tokens = true;
    out.json_mode = true;
  }

  if (url.includes('deepseek')) {
    out.tool_calling = m.includes('chat');
    out.supports_frequency_penalty = false;
    out.supports_presence_penalty = false;
    out.reasoning_effort = m.includes('reasoner');
  }

  if (url.includes('groq') || url.includes('api.groq')) {
    out.supports_max_tokens = true;
    out.supports_temperature = true;
    out.supports_top_p = true;
    out.tool_calling = m.includes('llama') || m.includes('mixtral') || m.includes('gemma');
  }

  if (url.includes('together')) {
    out.supports_max_tokens = true;
    out.supports_temperature = true;
    out.supports_top_p = true;
    out.supports_top_k = true;
    out.supports_frequency_penalty = true;
    out.supports_presence_penalty = true;
  }

  if (m.includes('gpt')) {
    Object.assign(out, heuristicOpenAI(model));
  }
  if (m.includes('claude')) {
    Object.assign(out, heuristicAnthropic(model));
  }
  if (m.includes('gemini')) {
    Object.assign(out, heuristicGoogle(model));
  }

  return out;
}

function getHeuristicForEndpoint(
  endpoint: string,
  model: string,
  baseURL?: string,
): Partial<TModelCapability> {
  switch (endpoint) {
    case EModelEndpoint.openAI:
    case EModelEndpoint.azureOpenAI:
    case EModelEndpoint.assistants:
    case EModelEndpoint.azureAssistants:
      return heuristicOpenAI(model);
    case EModelEndpoint.anthropic:
      return heuristicAnthropic(model);
    case EModelEndpoint.google:
      return heuristicGoogle(model);
    case EModelEndpoint.bedrock:
      return heuristicBedrock(model);
    case EModelEndpoint.custom:
    default:
      return heuristicCustom(model, baseURL);
  }
}

export interface ResolveCapabilityOptions {
  endpoint: string;
  model: string;
  configOverride?: CapabilityOverride;
  baseURL?: string;
}

export function resolveCapability(options: ResolveCapabilityOptions): TModelCapability {
  const { endpoint, model, configOverride, baseURL } = options;

  const mergedProviderDefault = mergeCapabilities(
    baseCapability,
    providerDefaults[endpoint] ?? providerDefaults[EModelEndpoint.custom],
  );

  if (!model) {
    return mergeCapabilities(mergedProviderDefault, configOverride);
  }

  const heuristic = getHeuristicForEndpoint(endpoint, model, baseURL);

  const heuristicMerged = mergeCapabilities(mergedProviderDefault, heuristic);

  return mergeCapabilities(heuristicMerged, configOverride);
}

export function enrichModelsWithCapabilityResolver(
  models: string[],
  endpoint: string,
  configOverrides?: Record<string, CapabilityOverride>,
  baseURL?: string,
): Array<{ model: string; capabilities: TModelCapability; label?: string }> {
  return models.map((m) => {
    const configOverride = configOverrides?.[m];
    const capabilities = resolveCapability({ endpoint, model: m, configOverride, baseURL });
    return { model: m, capabilities };
  });
}

export type StripTarget = {
  tools?: unknown[] | null;
  toolIds?: unknown[] | null;
  tools_payload?: unknown[] | null;
  attachments?: unknown[] | null;
  files?: unknown[] | null;
  file_ids?: unknown[] | null;
  agent_id?: unknown;
  agentName?: unknown;
  temperature?: unknown;
  top_p?: unknown;
  topP?: unknown;
  top_k?: unknown;
  topK?: unknown;
  frequency_penalty?: unknown;
  presence_penalty?: unknown;
  stop?: unknown;
  max_tokens?: unknown;
  maxOutputTokens?: unknown;
  reasoning_effort?: unknown;
  thinking?: unknown;
  thinkingBudget?: unknown;
  thinkingLevel?: unknown;
  effort?: unknown;
  promptCache?: unknown;
  imageDetail?: unknown;
  resendFiles?: unknown;
  promptPrefix?: unknown;
  json_schema?: unknown;
  response_format?: unknown;
  webSearch?: unknown;
  fileSearch?: unknown;
  codeInterpreter?: unknown;
  mcpEnabled?: unknown;
  skills?: unknown[] | null;
  [key: string]: unknown;
};

export function stripUnsupportedByCapability(
  target: StripTarget,
  capability: TModelCapability,
): StripTarget {
  const result = { ...target };

  if (!capability.vision) {
    delete result.attachments;
    delete result.files;
    if (Array.isArray(target.attachments)) {
      result.attachments = (target.attachments as Array<Record<string, unknown> & { type?: string }>).filter(
        (a) => a && a.type !== 'image_url' && (!a.filepath || !/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.filepath as string)),
      );
    }
  }

  if (!capability.tool_calling) {
    delete result.tools;
    delete result.tools_payload;
  }
  if (!capability.file_search) {
    delete result.file_ids;
    delete result.fileSearch;
  }
  if (!capability.code_interpreter) {
    delete result.codeInterpreter;
  }
  if (!capability.web_search) {
    delete result.webSearch;
  }
  if (!capability.mcp) {
    delete result.mcpEnabled;
    if (result.tools && Array.isArray(result.tools)) {
      result.tools = (result.tools as Array<Record<string, unknown> & { type?: string }>).filter(
        (t) => t && t.type !== 'mcp',
      );
    }
  }
  if (!capability.skills && Array.isArray(result.skills)) {
    result.skills = [];
  }
  if (!capability.agents) {
    delete result.agent_id;
    delete result.agentName;
  }
  if (!capability.tool_calling && Array.isArray(result.toolIds)) {
    result.toolIds = [];
  }

  if (!capability.json_mode && !capability.structured_output) {
    delete result.json_schema;
    delete result.response_format;
  }

  if (!capability.supports_temperature) {
    delete result.temperature;
  }
  if (!capability.supports_top_p) {
    delete result.top_p;
    delete result.topP;
  }
  if (!capability.supports_top_k) {
    delete result.top_k;
    delete result.topK;
  }
  if (!capability.supports_frequency_penalty) {
    delete result.frequency_penalty;
  }
  if (!capability.supports_presence_penalty) {
    delete result.presence_penalty;
  }
  if (!capability.supports_stop) {
    delete result.stop;
  }
  if (!capability.supports_max_tokens) {
    delete result.max_tokens;
    delete result.maxOutputTokens;
  }

  if (!capability.reasoning_effort) {
    delete result.reasoning_effort;
  }
  if (!capability.thinking && !capability.anthropic_thinking && !capability.google_thinking) {
    delete result.thinking;
    delete result.thinkingBudget;
    delete result.thinkingLevel;
    delete result.effort;
  } else if (capability.google_thinking && !capability.anthropic_thinking) {
    delete result.effort;
  } else if (capability.anthropic_thinking && !capability.google_thinking) {
    delete result.thinkingLevel;
  }
  if (!capability.prompt_caching) {
    delete result.promptCache;
  }
  if (!capability.image_detail) {
    delete result.imageDetail;
  }
  if (!capability.resend_files) {
    delete result.resendFiles;
  }
  if (!capability.prompt_prefix) {
    delete result.promptPrefix;
  }

  return result;
}

export function detectCapabilityChange(
  prev: TModelCapability | null,
  next: TModelCapability,
): {
  needStripVision: boolean;
  needStripTools: boolean;
  needStripFileSearch: boolean;
  needStripParams: boolean;
} {
  if (!prev) {
    return {
      needStripVision: !next.vision,
      needStripTools: !next.tool_calling,
      needStripFileSearch: !next.file_search,
      needStripParams: true,
    };
  }
  return {
    needStripVision: prev.vision === true && next.vision === false,
    needStripTools: prev.tool_calling === true && next.tool_calling === false,
    needStripFileSearch: prev.file_search === true && next.file_search === false,
    needStripParams:
      prev.supports_temperature !== next.supports_temperature ||
      prev.supports_top_p !== next.supports_top_p ||
      prev.supports_top_k !== next.supports_top_k ||
      prev.supports_frequency_penalty !== next.supports_frequency_penalty ||
      prev.supports_presence_penalty !== next.supports_presence_penalty ||
      prev.reasoning_effort !== next.reasoning_effort ||
      prev.thinking !== next.thinking ||
      prev.anthropic_thinking !== next.anthropic_thinking ||
      prev.google_thinking !== next.google_thinking ||
      prev.json_mode !== next.json_mode ||
      prev.prompt_caching !== next.prompt_caching,
  };
}
