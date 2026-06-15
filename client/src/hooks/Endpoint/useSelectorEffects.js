import { useMemo, useEffect, useRef } from 'react';
import { isAgentsEndpoint, LocalStorageKeys, isEphemeralAgentId, isAssistantsEndpoint, } from 'librechat-data-provider';
import useSetIndexOptions from '~/hooks/Conversations/useSetIndexOptions';
export default function useSelectorEffects({ index = 0, agentsMap, conversation, assistantsMap, setSelectedValues, }) {
    const { setOption } = useSetIndexOptions();
    const agents = useMemo(() => {
        return Object.values(agentsMap ?? {});
    }, [agentsMap]);
    const { agent_id: selectedAgentId = null, assistant_id: selectedAssistantId = null, endpoint, } = conversation ?? {};
    const assistants = useMemo(() => {
        if (!isAssistantsEndpoint(endpoint)) {
            return [];
        }
        return Object.values(assistantsMap?.[endpoint ?? ''] ?? {});
    }, [assistantsMap, endpoint]);
    useEffect(() => {
        if (!isAgentsEndpoint(endpoint)) {
            return;
        }
        if (selectedAgentId == null && agents.length > 0) {
            let agent_id = localStorage.getItem(`${LocalStorageKeys.AGENT_ID_PREFIX}${index}`);
            if (agent_id == null || isEphemeralAgentId(agent_id)) {
                agent_id = agents[0]?.id;
            }
            const agent = agentsMap?.[agent_id];
            if (agent !== undefined) {
                setOption('model')('');
                setOption('agent_id')(agent_id);
            }
        }
    }, [index, agents, selectedAgentId, agentsMap, endpoint, setOption]);
    useEffect(() => {
        if (!isAssistantsEndpoint(endpoint)) {
            return;
        }
        if (selectedAssistantId == null && assistants.length > 0) {
            let assistant_id = localStorage.getItem(`${LocalStorageKeys.ASST_ID_PREFIX}${index}`);
            if (assistant_id == null) {
                assistant_id = assistants[0]?.id;
            }
            const assistant = assistantsMap?.[endpoint ?? '']?.[assistant_id];
            if (assistant !== undefined) {
                setOption('model')(assistant.model);
                setOption('assistant_id')(assistant_id);
            }
        }
    }, [index, assistants, selectedAssistantId, assistantsMap, endpoint, setOption]);
    const debounceTimeoutRef = useRef(null);
    const debouncedSetSelectedValues = (values) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            setSelectedValues(values);
        }, 150);
    };
    useEffect(() => {
        if (!conversation?.endpoint) {
            return;
        }
        if (conversation?.assistant_id ||
            conversation?.agent_id ||
            conversation?.model ||
            conversation?.spec) {
            if (isAgentsEndpoint(conversation?.endpoint)) {
                debouncedSetSelectedValues({
                    endpoint: conversation.endpoint || '',
                    model: conversation.agent_id ?? '',
                    modelSpec: conversation.spec || '',
                });
                return;
            }
            else if (isAssistantsEndpoint(conversation?.endpoint)) {
                debouncedSetSelectedValues({
                    endpoint: conversation.endpoint || '',
                    model: conversation.assistant_id || '',
                    modelSpec: conversation.spec || '',
                });
                return;
            }
            debouncedSetSelectedValues({
                endpoint: conversation.endpoint || '',
                model: conversation.model || '',
                modelSpec: conversation.spec || '',
            });
        }
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [
        conversation?.spec,
        conversation?.model,
        conversation?.endpoint,
        conversation?.agent_id,
        conversation?.assistant_id,
    ]);
}
