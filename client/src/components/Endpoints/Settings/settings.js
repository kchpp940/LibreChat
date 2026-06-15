import { EModelEndpoint } from 'librechat-data-provider';
import AssistantsSettings from './Assistants';
import { GoogleSettings } from './MultiView';
import AnthropicSettings from './Anthropic';
import BedrockSettings from './Bedrock';
import OpenAISettings from './OpenAI';
const settings = {
    [EModelEndpoint.assistants]: AssistantsSettings,
    [EModelEndpoint.azureAssistants]: AssistantsSettings,
    [EModelEndpoint.agents]: OpenAISettings,
    [EModelEndpoint.openAI]: OpenAISettings,
    [EModelEndpoint.custom]: OpenAISettings,
    [EModelEndpoint.azureOpenAI]: OpenAISettings,
    [EModelEndpoint.anthropic]: AnthropicSettings,
    [EModelEndpoint.bedrock]: BedrockSettings,
};
export const getSettings = () => {
    return {
        settings,
        multiViewSettings: {
            [EModelEndpoint.google]: GoogleSettings,
        },
    };
};
