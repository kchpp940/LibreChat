import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
export const useGetSkillTreeQuery = (skillId, config) => {
    return useQuery([QueryKeys.skillTree, skillId], () => dataService.getSkillTree(skillId), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: true,
        enabled: !!skillId && (config?.enabled ?? true),
        ...config,
    });
};
export const useGetSkillNodeContentQuery = (skillId, nodeId, config) => {
    return useQuery([QueryKeys.skillNodeContent, skillId, nodeId], () => dataService.getSkillNodeContent({
        skillId: skillId,
        nodeId: nodeId,
    }), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        enabled: !!skillId && !!nodeId && (config?.enabled ?? true),
        ...config,
    });
};
