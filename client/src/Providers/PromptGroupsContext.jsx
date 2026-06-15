import React, { createContext, useContext, useMemo } from 'react';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { usePromptGroupsNav, useHasAccess } from '~/hooks';
import { useGetAllPromptGroups } from '~/data-provider';
import { CategoryIcon } from '~/components/Prompts';
import { mapPromptGroups } from '~/utils';
const PromptGroupsContext = createContext(null);
export const PromptGroupsProvider = ({ children }) => {
    const hasAccess = useHasAccess({
        permissionType: PermissionTypes.PROMPTS,
        permission: Permissions.USE,
    });
    const promptGroupsNav = usePromptGroupsNav(hasAccess);
    const { data: allGroupsData, isLoading: isLoadingAll } = useGetAllPromptGroups(undefined, {
        enabled: hasAccess,
        select: (data) => {
            const mappedArray = data.map((group) => ({
                id: group._id ?? '',
                type: 'prompt',
                value: group.command ?? group.name,
                label: `${group.command != null && group.command ? `/${group.command} - ` : ''}${group.name}: ${(group.oneliner?.length ?? 0) > 0
                    ? group.oneliner
                    : (group.productionPrompt?.prompt ?? '')}`,
                icon: <CategoryIcon category={group.category ?? ''} className="h-5 w-5"/>,
            }));
            const promptsMap = mapPromptGroups(data);
            return {
                promptsMap,
                promptGroups: mappedArray,
            };
        },
    });
    const contextValue = useMemo(() => ({
        ...promptGroupsNav,
        allPromptGroups: {
            data: hasAccess ? allGroupsData : undefined,
            isLoading: hasAccess ? isLoadingAll : false,
        },
        hasAccess,
    }), [promptGroupsNav, allGroupsData, isLoadingAll, hasAccess]);
    return (<PromptGroupsContext.Provider value={contextValue}>{children}</PromptGroupsContext.Provider>);
};
export const usePromptGroupsContext = () => {
    return useContext(PromptGroupsContext);
};
