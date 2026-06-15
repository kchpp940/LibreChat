export const getPresetTitle = (preset, mention) => {
    const { endpoint, title: presetTitle, model, tools, promptPrefix, chatGptLabel, modelLabel, } = preset;
    const modelInfo = model ?? '';
    let title = '';
    let label = '';
    if (modelLabel) {
        label = modelLabel;
    }
    if (label &&
        presetTitle != null &&
        presetTitle &&
        label.toLowerCase().includes(presetTitle.toLowerCase())) {
        title = label + ': ';
        label = '';
    }
    else if (presetTitle != null && presetTitle && presetTitle.trim() !== 'New Chat') {
        title = presetTitle + ': ';
    }
    if (mention === true) {
        return `${modelInfo}${label ? ` | ${label}` : ''}${promptPrefix != null && promptPrefix ? ` | ${promptPrefix}` : ''}${tools
            ? ` | ${tools
                .map((tool) => {
                if (typeof tool === 'string') {
                    return tool;
                }
                return tool.pluginKey;
            })
                .join(', ')}`
            : ''}`;
    }
    return `${title}${modelInfo}${label ? ` (${label})` : ''}`.trim();
};
/** Remove unavailable tools from the preset */
export const removeUnavailableTools = (preset, availableTools) => {
    const newPreset = { ...preset };
    if (newPreset.tools && newPreset.tools.length > 0) {
        newPreset.tools = newPreset.tools
            .filter((tool) => {
            let pluginKey;
            if (typeof tool === 'string') {
                pluginKey = tool;
            }
            else {
                ({ pluginKey } = tool);
            }
            return !!availableTools[pluginKey];
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
