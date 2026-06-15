import { Constants, EModelEndpoint, defaultEndpoints, modularEndpoints, LocalStorageKeys, getEndpointField, isAgentsEndpoint, isEphemeralAgentId, isAssistantsEndpoint, } from 'librechat-data-provider';
import { getTimestampedValue } from './timestamps';
/**
 * Clears model for non-ephemeral agent conversations.
 * Agents use their configured model internally, so the conversation model should be undefined.
 * Mutates the template in place.
 */
export function clearModelForNonEphemeralAgent(template) {
    if (isAgentsEndpoint(template.endpoint) &&
        template.agent_id &&
        !isEphemeralAgentId(template.agent_id)) {
        template.model = undefined;
    }
}
export const getEntityName = ({ name = '', localize, isAgent, }) => {
    if (name && name.length > 0) {
        return name;
    }
    else {
        return isAgent === true ? localize('com_ui_agent') : localize('com_ui_assistant');
    }
};
export const getEndpointsFilter = (endpointsConfig) => {
    const filter = {};
    if (!endpointsConfig) {
        return filter;
    }
    for (const key of Object.keys(endpointsConfig)) {
        filter[key] = !!endpointsConfig[key];
    }
    return filter;
};
export const getAvailableEndpoints = (filter, endpointsConfig) => {
    const defaultSet = new Set(defaultEndpoints);
    const availableEndpoints = [];
    for (const endpoint in endpointsConfig) {
        // Check if endpoint is in the filter or its type is in defaultEndpoints
        if (filter[endpoint] ||
            (endpointsConfig[endpoint]?.type &&
                defaultSet.has(endpointsConfig[endpoint]?.type))) {
            availableEndpoints.push(endpoint);
        }
    }
    return availableEndpoints;
};
export function mapEndpoints(endpointsConfig) {
    const filter = getEndpointsFilter(endpointsConfig);
    return getAvailableEndpoints(filter, endpointsConfig).sort((a, b) => (endpointsConfig?.[a]?.order ?? 0) - (endpointsConfig?.[b]?.order ?? 0));
}
const firstLocalConvoKey = LocalStorageKeys.LAST_CONVO_SETUP + '_0';
/**
 * Ensures the last selected model stays up to date, as conversation may
 * update without updating last convo setup when same endpoint */
export function updateLastSelectedModel({ endpoint, model = '', }) {
    if (!model) {
        return;
    }
    /* Note: an empty string value is possible */
    const lastConversationSetup = JSON.parse((localStorage.getItem(firstLocalConvoKey) ?? '{}') || '{}');
    if (lastConversationSetup.endpoint === endpoint) {
        lastConversationSetup.model = model;
        localStorage.setItem(firstLocalConvoKey, JSON.stringify(lastConversationSetup));
    }
    const lastSelectedModels = JSON.parse((localStorage.getItem(LocalStorageKeys.LAST_MODEL) ?? '{}') || '{}');
    lastSelectedModels[endpoint] = model;
    localStorage.setItem(LocalStorageKeys.LAST_MODEL, JSON.stringify(lastSelectedModels));
}
function hasSelectionValue(value) {
    return typeof value === 'string' && value.trim() !== '';
}
function parseStoredModelSelection(value) {
    if (!value) {
        return;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return;
    }
}
function hasStoredPrefixValue(prefix) {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(prefix)) {
            continue;
        }
        if (hasSelectionValue(localStorage.getItem(key))) {
            return true;
        }
    }
    return false;
}
function hasStoredModelValue() {
    const storedModelValue = localStorage.getItem(LocalStorageKeys.LAST_MODEL);
    if (!storedModelValue) {
        return false;
    }
    try {
        const storedModels = JSON.parse(storedModelValue);
        return Object.values(storedModels).some(hasSelectionValue);
    }
    catch {
        return false;
    }
}
export function hasModelSelection(selection) {
    if (!selection) {
        return false;
    }
    return (hasSelectionValue(selection.spec) ||
        hasSelectionValue(selection.agent_id) ||
        hasSelectionValue(selection.assistant_id) ||
        hasSelectionValue(selection.model) ||
        hasSelectionValue(selection.endpoint));
}
/**
 * Whether localStorage holds a model selection the user actually made.
 * Only spec entries naming `softDefaultSpec` are residue of the soft default
 * itself — selections that merely match its preset still count as user choices.
 */
function hasStoredModelSelection(softDefaultSpec) {
    const lastSpecName = localStorage.getItem(LocalStorageKeys.LAST_SPEC);
    if (hasSelectionValue(lastSpecName) && lastSpecName !== softDefaultSpec?.name) {
        return true;
    }
    if (hasStoredModelValue()) {
        return true;
    }
    if (hasStoredPrefixValue(LocalStorageKeys.AGENT_ID_PREFIX) ||
        hasStoredPrefixValue(LocalStorageKeys.ASST_ID_PREFIX)) {
        return true;
    }
    const lastConversationSetup = parseStoredModelSelection(localStorage.getItem(LocalStorageKeys.LAST_CONVO_SETUP + '_0'));
    if (softDefaultSpec && lastConversationSetup?.spec === softDefaultSpec.name) {
        return false;
    }
    return hasModelSelection(lastConversationSetup);
}
/**
 * Whether the selector offers any ephemeral endpoint → model options.
 * False when the endpoints menu is hidden (`modelSelect` disabled) or only
 * agents/assistants picks remain; an empty endpoints config means not loaded.
 */
function hasEphemeralModelOptions({ endpointsConfig, addedEndpoints, modelSelect, }) {
    if (!modelSelect) {
        return false;
    }
    const included = new Set(addedEndpoints ?? []);
    const includesEphemeral = included.size === 0 ||
        [...included].some((endpoint) => !isAgentsEndpoint(endpoint) && !isAssistantsEndpoint(endpoint));
    if (!includesEphemeral) {
        return false;
    }
    if (endpointsConfig == null || Object.keys(endpointsConfig).length === 0) {
        return true;
    }
    return Object.entries(endpointsConfig).some(([endpoint, config]) => config != null &&
        !isAgentsEndpoint(endpoint) &&
        !isAssistantsEndpoint(endpoint) &&
        (included.size === 0 || included.has(endpoint)));
}
/** Get the conditional logic for switching conversations */
export function getConvoSwitchLogic(params) {
    const { conversation, newEndpoint, endpointsConfig, modularChat = false } = params;
    const currentEndpoint = conversation?.endpoint;
    const template = {
        ...conversation,
        endpoint: newEndpoint,
        conversationId: 'new',
    };
    // Reset agent_id if switching to a non-agents endpoint but template has a non-ephemeral agent_id
    if (!isAgentsEndpoint(newEndpoint) &&
        template.agent_id &&
        !isEphemeralAgentId(template.agent_id)) {
        template.agent_id = Constants.EPHEMERAL_AGENT_ID;
    }
    // Clear model for non-ephemeral agents - agents use their configured model internally
    clearModelForNonEphemeralAgent(template);
    const isAssistantSwitch = isAssistantsEndpoint(newEndpoint) &&
        isAssistantsEndpoint(currentEndpoint) &&
        currentEndpoint === newEndpoint;
    const conversationId = conversation?.conversationId ?? '';
    const isExistingConversation = !!(conversationId && conversationId !== 'new');
    const currentEndpointType = getEndpointField(endpointsConfig, currentEndpoint, 'type') ?? currentEndpoint;
    const newEndpointType = getEndpointField(endpointsConfig, newEndpoint, 'type') ??
        newEndpoint;
    const hasEndpoint = modularEndpoints.has(currentEndpoint ?? '');
    const hasCurrentEndpointType = modularEndpoints.has(currentEndpointType ?? '');
    const isCurrentModular = hasEndpoint || hasCurrentEndpointType || isAssistantSwitch;
    const hasNewEndpoint = modularEndpoints.has(newEndpoint ?? '');
    const hasNewEndpointType = modularEndpoints.has(newEndpointType ?? '');
    const isNewModular = hasNewEndpoint || hasNewEndpointType || isAssistantSwitch;
    const endpointsMatch = currentEndpoint === newEndpoint;
    const shouldSwitch = endpointsMatch || modularChat || isAssistantSwitch;
    return {
        template,
        shouldSwitch,
        isExistingConversation,
        isCurrentModular,
        newEndpointType,
        isNewModular,
    };
}
export function getModelSpec({ specName, startupConfig, }) {
    if (!startupConfig || !specName) {
        return;
    }
    return startupConfig.modelSpecs?.list?.find((spec) => spec.name === specName);
}
export function applyModelSpecEphemeralAgent({ convoId, modelSpec, updateEphemeralAgent, }) {
    if (!modelSpec || !updateEphemeralAgent) {
        return;
    }
    const key = (convoId ?? Constants.NEW_CONVO) || Constants.NEW_CONVO;
    const agent = {
        mcp: modelSpec.mcpServers ?? [],
        web_search: modelSpec.webSearch ?? false,
        file_search: modelSpec.fileSearch ?? false,
        execute_code: modelSpec.executeCode ?? false,
        artifacts: modelSpec.artifacts === true ? 'default' : modelSpec.artifacts || '',
    };
    // For existing conversations, layer per-conversation localStorage overrides
    // on top of spec defaults so user modifications persist across navigation.
    // If localStorage is empty (e.g., cleared), spec values stand alone.
    if (key !== Constants.NEW_CONVO) {
        const toolStorageMap = [
            ['execute_code', LocalStorageKeys.LAST_CODE_TOGGLE_],
            ['web_search', LocalStorageKeys.LAST_WEB_SEARCH_TOGGLE_],
            ['file_search', LocalStorageKeys.LAST_FILE_SEARCH_TOGGLE_],
            ['artifacts', LocalStorageKeys.LAST_ARTIFACTS_TOGGLE_],
        ];
        for (const [toolKey, storagePrefix] of toolStorageMap) {
            const raw = getTimestampedValue(`${storagePrefix}${key}`);
            if (raw !== null) {
                try {
                    agent[toolKey] = JSON.parse(raw);
                }
                catch {
                    // ignore parse errors
                }
            }
        }
        const mcpRaw = localStorage.getItem(`${LocalStorageKeys.LAST_MCP_}${key}`);
        if (mcpRaw !== null) {
            try {
                const parsed = JSON.parse(mcpRaw);
                if (Array.isArray(parsed)) {
                    agent.mcp = parsed;
                }
            }
            catch {
                // ignore parse errors
            }
        }
    }
    updateEphemeralAgent(key, agent);
}
/**
 * Gets default model spec from config and user preferences.
 * Priority: hard admin default → prior user selection → soft default.
 * The soft default yields only to selections the user actually made, and acts
 * as the fallback default when no ephemeral endpoint → model options exist.
 * Legacy first-spec prioritization remains only when no soft default is configured.
 */
export function getDefaultModelSpec(startupConfig, endpointsConfig) {
    const { modelSpecs, interface: interfaceConfig } = startupConfig ?? {};
    const { list, prioritize, addedEndpoints } = modelSpecs ?? {};
    if (!list) {
        return;
    }
    const defaultSpec = list?.find((spec) => spec.default);
    const softDefaultSpec = list?.find((spec) => spec.softDefault);
    const lastConversationSetup = parseStoredModelSelection(localStorage.getItem(LocalStorageKeys.LAST_CONVO_SETUP + '_0'));
    const resolveSoftDefault = () => {
        if (!softDefaultSpec) {
            return;
        }
        if (lastConversationSetup?.spec === softDefaultSpec.name) {
            return { softDefault: softDefaultSpec };
        }
        const ephemeralOptions = hasEphemeralModelOptions({
            endpointsConfig,
            addedEndpoints,
            modelSelect: interfaceConfig?.modelSelect,
        });
        if (!ephemeralOptions) {
            return { softDefault: softDefaultSpec };
        }
        return hasStoredModelSelection(softDefaultSpec) ? undefined : { softDefault: softDefaultSpec };
    };
    if (prioritize === true || !interfaceConfig?.modelSelect) {
        const lastSelectedSpecName = localStorage.getItem(LocalStorageKeys.LAST_SPEC);
        const lastSelectedSpec = list?.find((spec) => spec.name === lastSelectedSpecName);
        if (defaultSpec) {
            return { default: defaultSpec };
        }
        if (lastSelectedSpec && lastSelectedSpec.name === softDefaultSpec?.name) {
            return resolveSoftDefault();
        }
        if (lastSelectedSpec) {
            return { last: lastSelectedSpec };
        }
        if (softDefaultSpec) {
            return resolveSoftDefault();
        }
        return { default: list?.[0] };
    }
    else if (defaultSpec) {
        return { default: defaultSpec };
    }
    const lastConversationSpecName = lastConversationSetup?.spec;
    if (!hasSelectionValue(lastConversationSpecName)) {
        return resolveSoftDefault();
    }
    const lastSpec = list?.find((spec) => spec.name === lastConversationSpecName);
    if (lastSpec && lastSpec.name === softDefaultSpec?.name) {
        return resolveSoftDefault();
    }
    return { last: lastSpec };
}
export function getModelSpecPreset(modelSpec) {
    if (!modelSpec) {
        return;
    }
    return {
        ...modelSpec.preset,
        spec: modelSpec.name,
        iconURL: getModelSpecIconURL(modelSpec),
    };
}
/** Fields set by a model spec that should be cleared when switching to a non-spec conversation. */
export const specDisplayFieldReset = {
    spec: null,
    iconURL: null,
    modelLabel: null,
    greeting: undefined,
};
/**
 * Merges a spec preset base with URL query settings, clearing spec display fields
 * when the query doesn't explicitly set a spec. Prevents spec contamination on
 * agent/assistant share links.
 */
export function mergeQuerySettingsWithSpec(specPreset, querySettings) {
    return {
        ...specPreset,
        ...querySettings,
        ...(specPreset != null && querySettings.spec == null ? specDisplayFieldReset : {}),
    };
}
/** Gets the model spec iconURL by explicit icon, preset icon, then preset endpoint. */
export function getModelSpecIconURL(modelSpec) {
    return modelSpec.iconURL ?? modelSpec.preset?.iconURL ?? modelSpec.preset?.endpoint ?? '';
}
/** Gets the default frontend-facing endpoint, dependent on iconURL definition.
 *
 * If the iconURL is defined in the endpoint config, use it, otherwise use the endpoint
 */
export function getIconEndpoint({ endpointsConfig, iconURL, endpoint, }) {
    return (endpointsConfig?.[iconURL ?? ''] ? (iconURL ?? endpoint) : endpoint) ?? '';
}
/** Gets the key to use for the default endpoint iconURL, as defined by the custom config */
export function getIconKey({ endpoint, endpointType: _eType, endpointsConfig, endpointIconURL: iconURL, }) {
    const endpointType = _eType ?? getEndpointField(endpointsConfig, endpoint, 'type') ?? '';
    const endpointIconURL = iconURL ?? getEndpointField(endpointsConfig, endpoint, 'iconURL') ?? '';
    if (endpointIconURL && EModelEndpoint[endpointIconURL] != null) {
        return endpointIconURL;
    }
    return endpointType ? 'unknown' : (endpoint ?? 'unknown');
}
export const getEntity = ({ endpoint, assistant_id, agent_id, agentsMap, assistantMap, }) => {
    const isAgent = isAgentsEndpoint(endpoint);
    const isAssistant = isAssistantsEndpoint(endpoint);
    if (isAgent) {
        const agent = agentsMap?.[agent_id ?? ''];
        return { entity: agent, isAgent, isAssistant };
    }
    else if (isAssistant) {
        const assistant = assistantMap?.[endpoint ?? '']?.[assistant_id ?? ''];
        return { entity: assistant, isAgent, isAssistant };
    }
    return { entity: null, isAgent, isAssistant };
};
