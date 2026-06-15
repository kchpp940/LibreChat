import { EModelEndpoint } from './types';
import { Providers } from './schemas';

const NOT_SUPPORTED_MODEL_PREFIXES: readonly string[] = [
  'text-davinci-',
  'text-curie-',
  'text-babbage-',
  'text-ada-',
  'davinci-',
  'curie-',
  'babbage-',
  'ada-',
  'gpt-3.5-turbo-instruct',
  'gpt-3.5-turbo-0125-instruct',
  'text-embedding-',
  'text-search-',
  'text-similarity-',
  'text-moderation-',
  'embedding-',
  'whisper-',
  'dall-e-',
  'tts-',
  'hd-tts-',
  'o1-',
  'o3-',
  'o4-',
];

const NOT_SUPPORTED_PROVIDERS: ReadonlySet<string> = new Set([
  'ollama:text-completion',
]);

function matchesNotSupportedPrefix(model: string): boolean {
  const lower = model.toLowerCase();
  for (const prefix of NOT_SUPPORTED_MODEL_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function isKnownClaudeModel(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.startsWith('claude-') ||
    m.includes('anthropic.claude') ||
    m === 'opus' ||
    m === 'sonnet' ||
    m === 'haiku' ||
    m.startsWith('max-') ||
    m.startsWith('fable-') ||
    m.startsWith('mythos-')
  );
}

function isKnownGPTModel(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.startsWith('gpt-') &&
    !m.startsWith('gpt-3.5-turbo-instruct') &&
    !m.startsWith('gpt-3.5-turbo-0125-instruct')
  );
}

function isKnownGeminiModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.startsWith('gemini-') || m.startsWith('models/gemini-');
}

function isKnownLlamaModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes('llama') && (m.includes('3.1') || m.includes('3.2') || m.includes('3.3') || m.includes('4.'));
}

function isKnownMistralToolModel(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes('mistral') &&
    (m.includes('large') || m.includes('-large') || m.includes('pixtral') || m.includes('saba'))
  );
}

export function supportsToolCalling(
  model: string | null | undefined,
  provider: string | null | undefined,
  endpoint?: string | null | undefined,
): boolean {
  if (!model || typeof model !== 'string' || model.trim() === '') {
    return true;
  }

  if (endpoint === EModelEndpoint.agents) {
    return true;
  }

  if (provider && NOT_SUPPORTED_PROVIDERS.has(provider.toLowerCase())) {
    return false;
  }

  if (matchesNotSupportedPrefix(model)) {
    return false;
  }

  const p = provider?.toLowerCase() ?? '';
  const lowerModel = model.toLowerCase();

  if (
    p === Providers.OPENAI.toLowerCase() ||
    p === Providers.AZURE.toLowerCase() ||
    p === 'azure-openai' ||
    p === 'azure' ||
    provider === EModelEndpoint.azureOpenAI ||
    provider === EModelEndpoint.openAI
  ) {
    return isKnownGPTModel(lowerModel) || lowerModel === 'chatgpt-4o-latest';
  }

  if (
    p === Providers.ANTHROPIC.toLowerCase() ||
    p === Providers.BEDROCK.toLowerCase() ||
    provider === EModelEndpoint.anthropic ||
    provider === EModelEndpoint.bedrock
  ) {
    if (isKnownClaudeModel(lowerModel)) {
      return true;
    }
    if (isKnownLlamaModel(lowerModel)) {
      return true;
    }
    if (isKnownMistralToolModel(lowerModel)) {
      return true;
    }
    if (isKnownGeminiModel(lowerModel)) {
      return true;
    }
    if (lowerModel.startsWith('command-') && !lowerModel.includes('nightly')) {
      return true;
    }
    return false;
  }

  if (
    p === Providers.GOOGLE.toLowerCase() ||
    p === 'googleai' ||
    p === 'gemini' ||
    p === Providers.VERTEXAI.toLowerCase() ||
    provider === EModelEndpoint.google
  ) {
    if (isKnownGeminiModel(lowerModel)) {
      return (
        !lowerModel.includes('flash-001') &&
        !lowerModel.includes('-001') &&
        !lowerModel.includes('nano')
      );
    }
    return false;
  }

  if (isKnownGPTModel(lowerModel) || isKnownClaudeModel(lowerModel) || isKnownGeminiModel(lowerModel)) {
    return true;
  }
  if (isKnownLlamaModel(lowerModel)) {
    return true;
  }
  if (isKnownMistralToolModel(lowerModel)) {
    return true;
  }

  return true;
}
