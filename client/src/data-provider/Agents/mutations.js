import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, MutationKeys, PermissionBits, QueryKeys } from 'librechat-data-provider';
/**
 * AGENTS
 */
export const allAgentViewAndEditQueryKeys = [
    { requiredPermission: PermissionBits.VIEW },
    { requiredPermission: PermissionBits.EDIT },
];
/**
 * Create a new agent
 */
export const useCreateAgentMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation((newAgentData) => dataService.createAgent(newAgentData), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (newAgent, variables, context) => {
            ((keys) => {
                keys.forEach((key) => {
                    const listRes = queryClient.getQueryData([QueryKeys.agents, key]);
                    if (!listRes) {
                        return options?.onSuccess?.(newAgent, variables, context);
                    }
                    const currentAgents = [newAgent, ...JSON.parse(JSON.stringify(listRes.data))];
                    queryClient.setQueryData([QueryKeys.agents, key], {
                        ...listRes,
                        data: currentAgents,
                    });
                });
            })(allAgentViewAndEditQueryKeys);
            invalidateAgentMarketplaceQueries(queryClient);
            return options?.onSuccess?.(newAgent, variables, context);
        },
    });
};
/**
 * Hook for updating an agent
 */
export const useUpdateAgentMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ agent_id, data }) => {
        return dataService.updateAgent({
            data,
            agent_id,
        });
    }, {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => {
            return options?.onError?.(error, variables, context);
        },
        onSuccess: (updatedAgent, variables, context) => {
            ((keys) => {
                keys.forEach((key) => {
                    const listRes = queryClient.getQueryData([QueryKeys.agents, key]);
                    if (!listRes) {
                        return options?.onSuccess?.(updatedAgent, variables, context);
                    }
                    queryClient.setQueryData([QueryKeys.agents, key], {
                        ...listRes,
                        data: listRes.data.map((agent) => {
                            if (agent.id === variables.agent_id) {
                                return updatedAgent;
                            }
                            return agent;
                        }),
                    });
                });
            })(allAgentViewAndEditQueryKeys);
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id], updatedAgent);
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id, 'expanded'], updatedAgent);
            invalidateAgentMarketplaceQueries(queryClient);
            return options?.onSuccess?.(updatedAgent, variables, context);
        },
    });
};
/**
 * Hook for deleting an agent
 */
export const useDeleteAgentMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ agent_id }) => {
        return dataService.deleteAgent({ agent_id });
    }, {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (_data, variables, context) => {
            const data = ((keys) => {
                let data = [];
                keys.forEach((key) => {
                    const listRes = queryClient.getQueryData([QueryKeys.agents, key]);
                    if (!listRes) {
                        return options?.onSuccess?.(_data, variables, context);
                    }
                    data = listRes.data.filter((agent) => agent.id !== variables.agent_id);
                    queryClient.setQueryData([QueryKeys.agents, key], {
                        ...listRes,
                        data,
                    });
                });
                return data;
            })(allAgentViewAndEditQueryKeys);
            queryClient.removeQueries([QueryKeys.agent, variables.agent_id]);
            queryClient.removeQueries([QueryKeys.agent, variables.agent_id, 'expanded']);
            invalidateAgentMarketplaceQueries(queryClient);
            return options?.onSuccess?.(_data, variables, data);
        },
    });
};
/**
 * Hook for duplicating an agent
 */
export const useDuplicateAgentMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation((params) => dataService.duplicateAgent(params), {
        onMutate: options?.onMutate,
        onError: options?.onError,
        onSuccess: ({ agent, actions }, variables, context) => {
            ((keys) => {
                keys.forEach((key) => {
                    const listRes = queryClient.getQueryData([QueryKeys.agents, key]);
                    if (listRes) {
                        const currentAgents = [agent, ...listRes.data];
                        queryClient.setQueryData([QueryKeys.agents, key], {
                            ...listRes,
                            data: currentAgents,
                        });
                    }
                });
            })(allAgentViewAndEditQueryKeys);
            const existingActions = queryClient.getQueryData([QueryKeys.actions]) || [];
            queryClient.setQueryData([QueryKeys.actions], existingActions.concat(actions));
            invalidateAgentMarketplaceQueries(queryClient);
            return options?.onSuccess?.({ agent, actions }, variables, context);
        },
    });
};
/**
 * Hook for uploading an agent avatar
 */
export const useUploadAgentAvatarMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: [MutationKeys.agentAvatarUpload],
        mutationFn: (variables) => dataService.uploadAgentAvatar(variables),
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (updatedAgent, variables, context) => {
            ((keys) => {
                keys.forEach((key) => {
                    const listRes = queryClient.getQueryData([QueryKeys.agents, key]);
                    if (!listRes) {
                        return;
                    }
                    queryClient.setQueryData([QueryKeys.agents, key], {
                        ...listRes,
                        data: listRes.data.map((agent) => {
                            if (agent.id === variables.agent_id) {
                                return updatedAgent;
                            }
                            return agent;
                        }),
                    });
                });
            })(allAgentViewAndEditQueryKeys);
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id], updatedAgent);
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id, 'expanded'], updatedAgent);
            invalidateAgentMarketplaceQueries(queryClient);
            return options?.onSuccess?.(updatedAgent, variables, context);
        },
    });
};
/**
 * Hook for updating Agent Actions
 */
export const useUpdateAgentAction = (options) => {
    const queryClient = useQueryClient();
    return useMutation([MutationKeys.updateAgentAction], {
        mutationFn: (variables) => dataService.updateAgentAction(variables),
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (updateAgentActionResponse, variables, context) => {
            const updatedAgent = updateAgentActionResponse[0];
            ((keys) => {
                keys.forEach((key) => {
                    const listRes = queryClient.getQueryData([QueryKeys.agents, key]);
                    if (!listRes) {
                        return options?.onSuccess?.(updateAgentActionResponse, variables, context);
                    }
                    queryClient.setQueryData([QueryKeys.agents, key], {
                        ...listRes,
                        data: listRes.data.map((agent) => {
                            if (agent.id === variables.agent_id) {
                                return updatedAgent;
                            }
                            return agent;
                        }),
                    });
                });
            })(allAgentViewAndEditQueryKeys);
            queryClient.setQueryData([QueryKeys.actions], (prev) => {
                if (!prev) {
                    return [updateAgentActionResponse[1]];
                }
                if (variables.action_id) {
                    return prev.map((action) => {
                        if (action.action_id === variables.action_id) {
                            return updateAgentActionResponse[1];
                        }
                        return action;
                    });
                }
                return [...prev, updateAgentActionResponse[1]];
            });
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id], updatedAgent);
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id, 'expanded'], updatedAgent);
            return options?.onSuccess?.(updateAgentActionResponse, variables, context);
        },
    });
};
/**
 * Hook for deleting an Agent Action
 */
export const useDeleteAgentAction = (options) => {
    const queryClient = useQueryClient();
    return useMutation([MutationKeys.deleteAgentAction], {
        mutationFn: (variables) => {
            return dataService.deleteAgentAction({
                ...variables,
            });
        },
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (_data, variables, context) => {
            let domain = '';
            queryClient.setQueryData([QueryKeys.actions], (prev) => {
                return prev?.filter((action) => {
                    domain = action.metadata.domain;
                    return action.action_id !== variables.action_id;
                });
            });
            ((keys) => {
                keys.forEach((key) => {
                    queryClient.setQueryData([QueryKeys.agents, key], (prev) => {
                        if (!prev) {
                            return prev;
                        }
                        return {
                            ...prev,
                            data: prev.data.map((agent) => {
                                if (agent.id === variables.agent_id) {
                                    return {
                                        ...agent,
                                        tools: agent.tools?.filter((tool) => !tool.includes(domain ?? '')),
                                    };
                                }
                                return agent;
                            }),
                        };
                    });
                });
            })(allAgentViewAndEditQueryKeys);
            const updaterFn = (prev) => {
                if (!prev) {
                    return prev;
                }
                return {
                    ...prev,
                    tools: prev.tools?.filter((tool) => !tool.includes(domain ?? '')),
                };
            };
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id], updaterFn);
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id, 'expanded'], updaterFn);
            return options?.onSuccess?.(_data, variables, context);
        },
    });
};
/**
 * Hook for reverting an agent to a previous version
 */
export const useRevertAgentVersionMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ agent_id, version_index }) => {
        return dataService.revertAgentVersion({
            agent_id,
            version_index,
        });
    }, {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (revertedAgent, variables, context) => {
            queryClient.setQueryData([QueryKeys.agent, variables.agent_id], revertedAgent);
            ((keys) => {
                keys.forEach((key) => {
                    const listRes = queryClient.getQueryData([QueryKeys.agents, key]);
                    if (listRes) {
                        queryClient.setQueryData([QueryKeys.agents, key], {
                            ...listRes,
                            data: listRes.data.map((agent) => {
                                if (agent.id === variables.agent_id) {
                                    return revertedAgent;
                                }
                                return agent;
                            }),
                        });
                    }
                });
            })(allAgentViewAndEditQueryKeys);
            return options?.onSuccess?.(revertedAgent, variables, context);
        },
    });
};
export const usePrecheckAgentMutation = (options) => {
    return useMutation((params) => dataService.precheckAgent(params), {
        mutationKey: [MutationKeys.agentPrecheck],
        onMutate: options?.onMutate,
        onError: options?.onError,
        onSuccess: options?.onSuccess,
    });
};
export const invalidateAgentMarketplaceQueries = (queryClient) => {
    queryClient.invalidateQueries([QueryKeys.marketplaceAgents]);
};
