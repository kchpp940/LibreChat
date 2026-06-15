import { useMemo } from 'react';
import { PermissionBits } from 'librechat-data-provider';
import { useListAgentsQuery } from '~/data-provider';
import { mapAgents } from '~/utils';
export default function useAgentsMap({ isAuthenticated, }) {
    const { data: mappedAgents = null } = useListAgentsQuery({ requiredPermission: PermissionBits.VIEW }, {
        select: (res) => mapAgents(res.data),
        enabled: isAuthenticated,
    });
    const agentsMap = useMemo(() => {
        return mappedAgents !== null ? mappedAgents : undefined;
    }, [mappedAgents]);
    return agentsMap;
}
