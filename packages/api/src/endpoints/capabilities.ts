import {
  EModelEndpoint,
  visionModels,
  isMythosClassModel,
  Providers,
  isOpenAILikeProvider,
  documentSupportedProviders,
  ReasoningParameterFormat,
} from 'librechat-data-provider';
import type { TModelCapability, TModelInfo } from 'librechat-data-provider';

export function defaultCapability(): TModelCapability {
  return {
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
    streaming: false,
    thinking: false,
    artifacts: false,
    reasoning_effort: false,
    supports_temperature: false,
    supports_top_p: false,
    supports_top_k: false,
    supports_frequency_penalty: false,
    supports_presence_penalty: false,
    supports_stop: false,
    supports_max_tokens: false,
    anthropic_thinking: false,
    anthropic_effort: false,
    google_thinking: false,
    prompt_caching: false,
    image_detail: false,
    resend_files: false,
    prompt_prefix: false,
  };
}

export function detectOpenAICapability(model: string): TModelCapability {
  const caps = defaultCapability();
  caps.streaming = true;
  caps.supports_max_tokens = true;
  caps.resend_files = true;
  caps.prompt_prefix = true;
  caps.image_detail = true;
  caps.file_upload = true;

  const hasVision = visionModels.some((vm) => model.includes(vm));
  if (hasVision) {
    caps.vision = true;
  }

  const isGptOrO = /^(gpt|o)[-\d]/.test(model) || /^chatgpt-/.test(model);
  if (isGptOrO) {
    caps.tool_calling = true;
    caps.structured_output = true;
    caps.json_mode = true;
    caps.streaming = true;
    caps.reasoning_effort = true;
    caps.supports_temperature = true;
    caps.supports_top_p = true;
    caps.supports_top_k = true;
    caps.supports_frequency_penalty = true;
    caps.supports_presence_penalty = true;
    caps.supports_stop = true;
  }

  const isO1OrO3 = /^o[13](-|$)/.test(model);
  if (isO1OrO3) {
    caps.supports_temperature = false;
    caps.supports_top_p = false;
    caps.supports_frequency_penalty = false;
    caps.supports_presence_penalty = false;
    caps.supports_top_k = false;
    caps.supports_stop = false;
  }

  const isReasoningModel = /^o[1345](-|$)/.test(model);
  if (isReasoningModel) {
    caps.reasoning_effort = true;
    caps.reasoning_format = ReasoningParameterFormat.reasoningEffort;
  }

  return caps;
}

export function detectAnthropicCapability(model: string): TModelCapability {
  const caps = defaultCapability();
  caps.streaming = true;
  caps.supports_temperature = true;
  caps.supports_top_p = true;
  caps.supports_top_k = true;
  caps.supports_max_tokens = true;
  caps.supports_stop = true;
  caps.resend_files = true;
  caps.prompt_prefix = true;
  caps.reasoning_format = ReasoningParameterFormat.reasoningObject;
  caps.thinking = true;

  const isClaude3Plus = /claude-3/.test(model);
  if (isClaude3Plus) {
    caps.vision = true;
    caps.tool_calling = true;
    caps.streaming = true;
    caps.prompt_caching = true;
  }

  const isClaude4 = /claude-(opus|sonnet|haiku)-4/.test(model);
  if (isClaude4 || isMythosClassModel(model)) {
    caps.anthropic_thinking = true;
    caps.anthropic_effort = true;
    caps.vision = true;
    caps.tool_calling = true;
    caps.streaming = true;
    caps.prompt_caching = true;
  }

  if (documentSupportedProviders.has(EModelEndpoint.anthropic)) {
    caps.file_upload = true;
  }

  return caps;
}

export function detectGoogleCapability(model: string): TModelCapability {
  const caps = defaultCapability();
  caps.streaming = true;
  caps.supports_temperature = true;
  caps.supports_top_p = true;
  caps.supports_top_k = true;
  caps.supports_max_tokens = true;
  caps.resend_files = true;
  caps.prompt_prefix = true;
  caps.json_mode = true;
  caps.structured_output = true;

  const isGemini = /gemini/.test(model);
  if (isGemini) {
    caps.vision = true;
    caps.tool_calling = true;
    caps.streaming = true;
  }

  const hasFlashOrPro = /flash|pro/.test(model);
  if (hasFlashOrPro) {
    caps.google_thinking = true;
    caps.thinking = true;
  }

  const isGemini15Plus = /gemini-(1\.5|2|2\.5|3)/.test(model);
  if (isGemini15Plus) {
    caps.file_upload = true;
  }

  const supportsWebSearch = /gemini-(2\.0|2\.5|3)/.test(model);
  if (supportsWebSearch) {
    caps.web_search = true;
  }

  return caps;
}

export function detectBedrockCapability(model: string): TModelCapability {
  const caps = defaultCapability();
  caps.supports_temperature = true;
  caps.supports_top_p = true;
  caps.supports_max_tokens = true;
  caps.resend_files = true;
  caps.prompt_prefix = true;

  const parts = model.split('.');
  const provider = parts[0];
  const provider2 = parts[1];

  if (provider === 'anthropic' || provider2 === 'anthropic') {
    return detectAnthropicCapability(model);
  }

  if (provider === 'meta' || provider2 === 'meta' || provider === 'mistral' || provider2 === 'mistral') {
    return caps;
  }

  if (provider === 'amazon' || provider === 'amazon-nova' || provider2 === 'amazon' || provider2 === 'amazon-nova') {
    caps.vision = true;
    return caps;
  }

  if (provider === 'cohere' || provider2 === 'cohere') {
    caps.supports_top_k = true;
    return caps;
  }

  return caps;
}

export function detectCustomCapability(model: string, baseURL?: string): TModelCapability {
  if (isOpenAILikeProvider(baseURL)) {
    return detectOpenAICapability(model);
  }
  if (/claude/.test(model)) {
    return detectAnthropicCapability(model);
  }
  if (/gemini/.test(model)) {
    return detectGoogleCapability(model);
  }
  if (visionModels.some((vm) => model.includes(vm))) {
    const caps = defaultCapability();
    caps.vision = true;
    caps.streaming = true;
    caps.supports_temperature = true;
    caps.supports_top_p = true;
    caps.supports_max_tokens = true;
    return caps;
  }
  return defaultCapability();
}

export function enrichModelsWithCapabilities(
  models: string[],
  endpoint: EModelEndpoint,
  baseURL?: string,
): TModelInfo[] {
  return models.map((model) => {
    let capabilities: TModelCapability;
    switch (endpoint) {
      case EModelEndpoint.openAI:
      case EModelEndpoint.azureOpenAI:
      case EModelEndpoint.assistants:
      case EModelEndpoint.azureAssistants:
        capabilities = detectOpenAICapability(model);
        break;
      case EModelEndpoint.anthropic:
        capabilities = detectAnthropicCapability(model);
        break;
      case EModelEndpoint.google:
        capabilities = detectGoogleCapability(model);
        break;
      case EModelEndpoint.bedrock:
        capabilities = detectBedrockCapability(model);
        break;
      case EModelEndpoint.custom:
      default:
        capabilities = detectCustomCapability(model, baseURL);
        break;
    }
    return { model, capabilities };
  });
}
