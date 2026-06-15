import { EModelEndpoint } from 'librechat-data-provider';
import OpenAI from './OpenAI';
import Google from './Google';
import Anthropic from './Anthropic';
export const options = {
    [EModelEndpoint.openAI]: OpenAI,
    [EModelEndpoint.custom]: OpenAI,
    [EModelEndpoint.bedrock]: OpenAI,
    [EModelEndpoint.azureOpenAI]: OpenAI,
    [EModelEndpoint.google]: Google,
    [EModelEndpoint.anthropic]: Anthropic,
};
export const multiChatOptions = {
    ...options,
};
