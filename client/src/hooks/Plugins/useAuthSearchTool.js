import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthType, Tools, QueryKeys } from 'librechat-data-provider';
import { useUpdateUserPluginsMutation } from 'librechat-data-provider/react-query';
const useAuthSearchTool = (options) => {
    const queryClient = useQueryClient();
    const isEntityTool = options?.isEntityTool ?? true;
    const updateUserPlugins = useUpdateUserPluginsMutation({
        onMutate: (vars) => {
            queryClient.setQueryData([QueryKeys.toolAuth, Tools.web_search], () => {
                return {
                    authenticated: vars.action === 'install',
                    authTypes: vars.action === 'install'
                        ? [
                            ['providers', AuthType.USER_PROVIDED],
                            ['scrapers', AuthType.USER_PROVIDED],
                            ['rerankers', AuthType.USER_PROVIDED],
                        ]
                        : [],
                };
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries([QueryKeys.toolAuth, Tools.web_search]);
        },
        onError: () => {
            queryClient.invalidateQueries([QueryKeys.toolAuth, Tools.web_search]);
        },
    });
    const installTool = useCallback((data) => {
        const auth = Object.entries({
            serperApiKey: data.serperApiKey,
            searxngInstanceUrl: data.searxngInstanceUrl,
            searxngApiKey: data.searxngApiKey,
            firecrawlApiKey: data.firecrawlApiKey,
            firecrawlApiUrl: data.firecrawlApiUrl,
            tavilyApiKey: data.tavilyApiKey,
            jinaApiKey: data.jinaApiKey,
            jinaApiUrl: data.jinaApiUrl,
            cohereApiKey: data.cohereApiKey,
        }).reduce((acc, [key, value]) => {
            if (value) {
                acc[key] = value;
            }
            return acc;
        }, {});
        updateUserPlugins.mutate({
            pluginKey: Tools.web_search,
            action: 'install',
            auth,
            isEntityTool,
        });
    }, [updateUserPlugins, isEntityTool]);
    const removeTool = useCallback(() => {
        updateUserPlugins.mutate({
            pluginKey: Tools.web_search,
            action: 'uninstall',
            auth: {},
            isEntityTool,
        });
    }, [updateUserPlugins, isEntityTool]);
    return {
        removeTool,
        installTool,
    };
};
export default useAuthSearchTool;
