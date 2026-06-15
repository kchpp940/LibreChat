import type { TPreset, TPlugin, ToolAvailability } from 'librechat-data-provider';
import { EModelEndpoint, supportsToolCalling } from 'librechat-data-provider';

type TEndpoints = Array<string | EModelEndpoint>;

export const getPresetTitle = (preset: TPreset, mention?: boolean) => {
  const {
    endpoint,
    title: presetTitle,
    model,
    tools,
    promptPrefix,
    chatGptLabel,
    modelLabel,
  } = preset;
  const modelInfo = model ?? '';
  let title = '';
  let label = '';

  if (modelLabel) {
    label = modelLabel;
  }

  if (
    label &&
    presetTitle != null &&
    presetTitle &&
    label.toLowerCase().includes(presetTitle.toLowerCase())
  ) {
    title = label + ': ';
    label = '';
  } else if (presetTitle != null && presetTitle && presetTitle.trim() !== 'New Chat') {
    title = presetTitle + ': ';
  }

  if (mention === true) {
    return `${modelInfo}${label ? ` | ${label}` : ''}${
      promptPrefix != null && promptPrefix ? ` | ${promptPrefix}` : ''
    }${
      tools
        ? ` | ${tools
            .map((tool: TPlugin | string) => {
              if (typeof tool === 'string') {
                return tool;
              }
              return tool.pluginKey;
            })
            .join(', ')}`
        : ''
    }`;
  }

  return `${title}${modelInfo}${label ? ` (${label})` : ''}`.trim();
};

export const removeUnavailableTools = (
  preset: TPreset,
  availableTools: Record<string, TPlugin | undefined>,
  toolAvailabilityMap?: Record<string, ToolAvailability>,
  endpoint?: string | null,
  model?: string | null,
  provider?: string | null,
) => {
  const newPreset = { ...preset };

  const actualEndpoint = endpoint ?? newPreset.endpoint ?? '';
  const actualModel = model ?? (typeof newPreset.model === 'string'
    ? newPreset.model
    : (newPreset.model as unknown as { value?: string } | null)?.value ?? '');
  const actualProvider = provider ?? (typeof newPreset.endpointType === 'string'
    ? newPreset.endpointType
    : newPreset.endpoint ?? null);

  const modelSupportsToolCalling = supportsToolCalling(actualModel, actualProvider, actualEndpoint);

  if (newPreset.tools && newPreset.tools.length > 0) {
    const systemToolSet: Set<string> = new Set([
      'execute_code',
      'file_search',
      'web_search',
    ]);

    newPreset.tools = newPreset.tools
      .filter((tool) => {
        let pluginKey: string;
        if (typeof tool === 'string') {
          pluginKey = tool;
        } else {
          ({ pluginKey } = tool);
        }

        if (toolAvailabilityMap && pluginKey in toolAvailabilityMap) {
          return toolAvailabilityMap[pluginKey]?.isAvailable === true;
        }

        const isSystemTool = systemToolSet.has(pluginKey);
        if (!isSystemTool && !modelSupportsToolCalling) {
          return false;
        }

        if (availableTools && typeof availableTools === 'object' && Object.keys(availableTools).length > 0) {
          if (!(pluginKey in availableTools) || availableTools[pluginKey] == null) {
            return false;
          }
        }

        return true;
      })
      .map((tool) => {
        if (typeof tool === 'string') {
          return tool;
        }
        return tool.pluginKey;
      });
  }

  return newPreset;
};
