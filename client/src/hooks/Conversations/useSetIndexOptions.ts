import {
  TPreset,
  TConversation,
  EModelEndpoint,
  tConvoUpdateSchema,
  resolveCapability,
  stripUnsupportedByCapability,
  type TModelCapability,
  type StripTarget,
} from 'librechat-data-provider';
import type { TSetExample, TSetOption, TSetOptionsPayload } from '~/common';
import usePresetIndexOptions from './usePresetIndexOptions';
import { useChatContext } from '~/Providers/ChatContext';
import useModelCapability from '~/hooks/useModelCapability';

type TUseSetOptions = (preset?: TPreset | boolean | null) => TSetOptionsPayload;

const useSetIndexOptions: TUseSetOptions = (preset = false) => {
  const { conversation, setConversation, setFiles, capabilityChangeHandlers } = useChatContext();
  const currentCapability = useModelCapability(
    conversation?.endpoint,
    conversation?.model,
    conversation?.endpointType,
  );

  const result = usePresetIndexOptions(preset);

  if (result && typeof result !== 'boolean') {
    return result;
  }

  const setOption: TSetOption = (param) => (newValue) => {
    const update = {};
    update[param] = newValue;

    if (param === 'presetOverride') {
      const currentOverride = conversation?.presetOverride || {};
      update['presetOverride'] = {
        ...currentOverride,
        ...(newValue as unknown as Partial<TPreset>),
      };
    }

    if (param === 'web_search' && newValue === true) {
      const currentEndpoint = conversation?.endpoint;
      const isOpenAICompatible =
        currentEndpoint === EModelEndpoint.openAI ||
        currentEndpoint === EModelEndpoint.azureOpenAI ||
        currentEndpoint === EModelEndpoint.custom;

      if (isOpenAICompatible) {
        const currentUseResponsesApi = conversation?.useResponsesApi ?? false;
        if (!currentUseResponsesApi) {
          update['useResponsesApi'] = true;
        }
      }
    }

    if (param === 'model' && conversation) {
      const newModel = typeof newValue === 'string' ? newValue : conversation.model;
      const resolvedEndpoint = (conversation.endpointType ??
        conversation.endpoint ??
        EModelEndpoint.custom) as string;
      const newCapability: TModelCapability = resolveCapability({
        endpoint: resolvedEndpoint,
        model: newModel ?? '',
      });

      const merged = stripUnsupportedByCapability(
        {
          ...(conversation as unknown as StripTarget),
          ...(update as unknown as StripTarget),
        },
        newCapability,
      ) as unknown as Partial<TConversation>;

      if (currentCapability) {
        const stripFileSearch =
          currentCapability.file_search && !newCapability.file_search;
        const stripTools = currentCapability.tool_calling && !newCapability.tool_calling;

        if (stripFileSearch) {
          merged.file_ids = undefined;
        }
        if (stripTools) {
          merged.tools = undefined;
        }
      }

      setConversation(
        (prevState) =>
          tConvoUpdateSchema.parse({
            ...prevState,
            ...merged,
          }) as TConversation,
      );

      if (currentCapability) {
        const stripVision = currentCapability.vision && !newCapability.vision;
        const stripFileSearch =
          currentCapability.file_search && !newCapability.file_search;
        const stripTools = currentCapability.tool_calling && !newCapability.tool_calling;
        const stripParams =
          currentCapability.supports_temperature !== newCapability.supports_temperature ||
          currentCapability.supports_top_p !== newCapability.supports_top_p ||
          currentCapability.supports_top_k !== newCapability.supports_top_k ||
          currentCapability.supports_frequency_penalty !==
            newCapability.supports_frequency_penalty ||
          currentCapability.supports_presence_penalty !==
            newCapability.supports_presence_penalty ||
          currentCapability.reasoning_effort !== newCapability.reasoning_effort ||
          currentCapability.thinking !== newCapability.thinking ||
          currentCapability.anthropic_thinking !== newCapability.anthropic_thinking ||
          currentCapability.google_thinking !== newCapability.google_thinking ||
          currentCapability.json_mode !== newCapability.json_mode ||
          currentCapability.prompt_caching !== newCapability.prompt_caching;

        if (stripVision && setFiles) {
          setFiles(new Map());
        }

        if (capabilityChangeHandlers) {
          capabilityChangeHandlers.forEach((handler) => {
            try {
              handler({
                stripVision,
                stripFileSearch,
                stripTools,
                stripParams,
                newCapability,
              });
            } catch (e) {
              // no-op
            }
          });
        }
      }
      return;
    }

    setConversation(
      (prevState) =>
        tConvoUpdateSchema.parse({
          ...prevState,
          ...update,
        }) as TConversation,
    );
  };

  const setExample: TSetExample = (i, type, newValue = null) => {
    const update = {};
    const current = conversation?.examples?.slice() || [];
    const currentExample = { ...current[i] };
    currentExample[type] = { content: newValue };
    current[i] = currentExample;
    update['examples'] = current;
    setConversation(
      (prevState) =>
        tConvoUpdateSchema.parse({
          ...prevState,
          ...update,
        }) as TConversation,
    );
  };

  const addExample: () => void = () => {
    const update = {};
    const current = conversation?.examples?.slice() || [];
    current.push({ input: { content: '' }, output: { content: '' } });
    update['examples'] = current;
    setConversation(
      (prevState) =>
        tConvoUpdateSchema.parse({
          ...prevState,
          ...update,
        }) as TConversation,
    );
  };

  const removeExample: () => void = () => {
    const update = {};
    const current = conversation?.examples?.slice() || [];
    if (current.length <= 1) {
      update['examples'] = [{ input: { content: '' }, output: { content: '' } }];
      setConversation(
        (prevState) =>
          tConvoUpdateSchema.parse({
            ...prevState,
            ...update,
          }) as TConversation,
      );
      return;
    }
    current.pop();
    update['examples'] = current;
    setConversation(
      (prevState) =>
        tConvoUpdateSchema.parse({
          ...prevState,
          ...update,
        }) as TConversation,
    );
  };

  return {
    setOption,
    setExample,
    addExample,
    removeExample,
  };
};

export default useSetIndexOptions;
