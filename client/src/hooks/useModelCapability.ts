import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import {
  EModelEndpoint,
  visionModels,
  documentSupportedProviders,
  isModelInfoArray,
  findModelCapability,
  ReasoningParameterFormat,
} from 'librechat-data-provider';
import type { TModelCapability, TModelInfo } from 'librechat-data-provider';
import store from '~/store';

function getHeuristicCapability(
  endpoint: string | null | undefined,
  model: string | null | undefined,
  endpointType?: string | null,
): TModelCapability | null {
  const resolvedEndpoint = endpointType ?? endpoint;
  if (!resolvedEndpoint) {
    return null;
  }

  const isVision =
    model != null &&
    model.length > 0 &&
    visionModels.some((prefix) => model.includes(prefix));

  const supportsFiles = documentSupportedProviders.has(resolvedEndpoint);

  const defaultCapability: TModelCapability = {
    vision: isVision,
    file_upload: supportsFiles,
    file_search: false,
    audio_input: false,
    video_input: false,
    tool_calling:
      resolvedEndpoint === EModelEndpoint.openAI ||
      resolvedEndpoint === EModelEndpoint.agents ||
      resolvedEndpoint === EModelEndpoint.assistants ||
      resolvedEndpoint === EModelEndpoint.azureAssistants ||
      resolvedEndpoint === EModelEndpoint.azureOpenAI ||
      resolvedEndpoint === EModelEndpoint.anthropic ||
      resolvedEndpoint === EModelEndpoint.google ||
      resolvedEndpoint === EModelEndpoint.bedrock ||
      resolvedEndpoint === EModelEndpoint.custom,
    web_search: false,
    code_interpreter: false,
    mcp: resolvedEndpoint === EModelEndpoint.agents,
    skills: resolvedEndpoint === EModelEndpoint.agents,
    agents: false,
    subagents: resolvedEndpoint === EModelEndpoint.agents,
    json_mode:
      resolvedEndpoint === EModelEndpoint.openAI ||
      resolvedEndpoint === EModelEndpoint.azureOpenAI ||
      resolvedEndpoint === EModelEndpoint.anthropic ||
      resolvedEndpoint === EModelEndpoint.google,
    structured_output:
      resolvedEndpoint === EModelEndpoint.openAI ||
      resolvedEndpoint === EModelEndpoint.azureOpenAI ||
      resolvedEndpoint === EModelEndpoint.google,
    streaming: true,
    thinking: false,
    artifacts: resolvedEndpoint === EModelEndpoint.agents,
    reasoning_effort: false,
    reasoning_format: ReasoningParameterFormat.disabled,
    supports_temperature: true,
    supports_top_p: true,
    supports_top_k: resolvedEndpoint === EModelEndpoint.google,
    supports_frequency_penalty:
      resolvedEndpoint === EModelEndpoint.openAI ||
      resolvedEndpoint === EModelEndpoint.azureOpenAI,
    supports_presence_penalty:
      resolvedEndpoint === EModelEndpoint.openAI ||
      resolvedEndpoint === EModelEndpoint.azureOpenAI,
    supports_stop:
      resolvedEndpoint === EModelEndpoint.openAI ||
      resolvedEndpoint === EModelEndpoint.azureOpenAI ||
      resolvedEndpoint === EModelEndpoint.anthropic,
    supports_max_tokens: true,
    anthropic_thinking: resolvedEndpoint === EModelEndpoint.anthropic,
    anthropic_effort: resolvedEndpoint === EModelEndpoint.anthropic,
    google_thinking: resolvedEndpoint === EModelEndpoint.google,
    prompt_caching: resolvedEndpoint === EModelEndpoint.anthropic,
    image_detail: isVision,
    resend_files: true,
    prompt_prefix: true,
  };

  return defaultCapability;
}

export default function useModelCapability(
  endpoint: string | null | undefined,
  model: string | null | undefined,
  endpointType?: string | null,
): TModelCapability | null {
  const endpointsConfig = useRecoilValue(store.endpointsConfig);
  const modelsQuery = useGetModelsQuery();

  const resolvedEndpoint = endpointType ?? endpoint;

  const capability = useMemo(() => {
    if (!resolvedEndpoint) {
      return null;
    }

    const endpointModels = modelsQuery.data?.[resolvedEndpoint];
    if (isModelInfoArray(endpointModels as unknown as string[] | TModelInfo[] | undefined)) {
      const found = findModelCapability(endpointModels, model);
      if (found) {
        return found;
      }
    }

    return getHeuristicCapability(endpoint, model, endpointType);
  }, [resolvedEndpoint, model, endpointType, modelsQuery.data, endpointsConfig]);

  return capability;
}
