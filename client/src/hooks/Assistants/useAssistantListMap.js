import { useMemo } from 'react';
import { EModelEndpoint } from 'librechat-data-provider';
import { useListAssistantsQuery } from '~/data-provider';
const selectAssistantsResponse = (res) => res.data.map(({ id, name, metadata, model }) => ({
    id,
    name: name ?? '',
    metadata,
    model,
}));
export default function useAssistantListMap(selector = selectAssistantsResponse) {
    const { data: assistantsList = null } = useListAssistantsQuery(EModelEndpoint.assistants, undefined, {
        select: selector,
    });
    const { data: azureAssistants = null } = useListAssistantsQuery(EModelEndpoint.azureAssistants, undefined, {
        select: selector,
    });
    const assistantListMap = useMemo(() => {
        return {
            [EModelEndpoint.assistants]: assistantsList,
            [EModelEndpoint.azureAssistants]: azureAssistants,
        };
    }, [assistantsList, azureAssistants]);
    return assistantListMap;
}
