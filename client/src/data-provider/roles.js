import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService, promptPermissionsSchema, skillPermissionsSchema, memoryPermissionsSchema, mcpServersPermissionsSchema, marketplacePermissionsSchema, peoplePickerPermissionsSchema, remoteAgentsPermissionsSchema, } from 'librechat-data-provider';
export const useGetRole = (roleName, config) => {
    return useQuery([QueryKeys.roles, roleName], () => dataService.getRole(roleName), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
    });
};
export const useListRoles = (config) => {
    return useQuery([QueryKeys.rolesList], () => dataService.listRoles(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
    });
};
export const useUpdatePromptPermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        promptPermissionsSchema.partial().parse(variables.updates);
        return dataService.updatePromptPermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update prompt permissions:', error);
            }
            if (onError) {
                onError(...args);
            }
        },
        onMutate,
    });
};
export const useUpdateAgentPermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        promptPermissionsSchema.partial().parse(variables.updates);
        return dataService.updateAgentPermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess != null) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update prompt permissions:', error);
            }
            if (onError != null) {
                onError(...args);
            }
        },
        onMutate,
    });
};
export const useUpdateSkillPermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        skillPermissionsSchema.partial().parse(variables.updates);
        return dataService.updateSkillPermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update skill permissions:', error);
            }
            if (onError) {
                onError(...args);
            }
        },
        onMutate,
    });
};
export const useUpdateMemoryPermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        memoryPermissionsSchema.partial().parse(variables.updates);
        return dataService.updateMemoryPermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update memory permissions:', error);
            }
            if (onError) {
                onError(...args);
            }
        },
        onMutate,
    });
};
export const useUpdatePeoplePickerPermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        peoplePickerPermissionsSchema.partial().parse(variables.updates);
        return dataService.updatePeoplePickerPermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update people picker permissions:', error);
            }
            if (onError) {
                onError(...args);
            }
        },
        onMutate,
    });
};
export const useUpdateMCPServersPermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        mcpServersPermissionsSchema.partial().parse(variables.updates);
        return dataService.updateMCPServersPermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update MCP servers permissions:', error);
            }
            if (onError) {
                onError(...args);
            }
        },
        onMutate,
    });
};
export const useUpdateMarketplacePermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        marketplacePermissionsSchema.partial().parse(variables.updates);
        return dataService.updateMarketplacePermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update marketplace permissions:', error);
            }
            if (onError) {
                onError(...args);
            }
        },
        onMutate,
    });
};
export const useUpdateRemoteAgentsPermissionsMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onSuccess, onError } = options ?? {};
    return useMutation((variables) => {
        remoteAgentsPermissionsSchema.partial().parse(variables.updates);
        return dataService.updateRemoteAgentsPermissions(variables);
    }, {
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.roles, variables.roleName]);
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (...args) => {
            const error = args[0];
            if (error != null) {
                console.error('Failed to update remote agents permissions:', error);
            }
            if (onError) {
                onError(...args);
            }
        },
        onMutate,
    });
};
