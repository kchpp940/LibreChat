import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
/**
 * Paginated skill list (single page) — use this for small lists or when you want to
 * control pagination manually.
 */
export const useListSkillsQuery = (params, config) => {
    return useQuery([
        QueryKeys.skills,
        params?.category ?? '',
        params?.search ?? '',
        params?.limit ?? 20,
        params?.cursor ?? '',
    ], () => dataService.listSkills(params), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
/**
 * Cursor-paginated infinite query for skills. Use this for the main skills listing UI.
 */
export const useSkillsInfiniteQuery = (params, config) => {
    return useInfiniteQuery([
        QueryKeys.skills,
        'infinite',
        params?.category ?? '',
        params?.search ?? '',
        params?.limit ?? 20,
    ], ({ pageParam }) => {
        const request = {
            category: params?.category,
            search: params?.search,
            limit: params?.limit,
        };
        if (typeof pageParam === 'string' && pageParam.length > 0) {
            request.cursor = pageParam;
        }
        return dataService.listSkills(request);
    }, {
        getNextPageParam: (lastPage) => lastPage.has_more && lastPage.after ? lastPage.after : undefined,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
/**
 * Fetch a single skill by id (includes full body + frontmatter).
 */
export const useGetSkillQuery = (id, config) => {
    const enabled = !!id;
    return useQuery([QueryKeys.skill, id], () => dataService.getSkill(id), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: enabled && (config?.enabled ?? true),
    });
};
/**
 * Alias kept for the original UI PR's call surface — components that still
 * import `useGetSkillByIdQuery` (e.g. `SkillsView`, `SkillForm`) resolve to
 * the same hook as `useGetSkillQuery`.
 */
export const useGetSkillByIdQuery = useGetSkillQuery;
/**
 * List file metadata for a single skill. In phase 1 this returns an empty array for
 * skills that have only an inline `SKILL.md`; multi-file skills arrive in phase 2.
 */
export const useListSkillFilesQuery = (skillId, config) => {
    const enabled = !!skillId;
    return useQuery([QueryKeys.skillFiles, skillId], () => dataService.listSkillFiles(skillId), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: enabled && (config?.enabled ?? true),
    });
};
/**
 * Fetch a single skill file's content. Returns cached text from the DB when
 * available; otherwise the backend reads from storage, caches, and returns it.
 * Uses `staleTime: Infinity` because file content is cached server-side.
 */
export const useGetSkillFileContentQuery = (skillId, relativePath, config) => {
    const enabled = !!skillId && !!relativePath;
    return useQuery([QueryKeys.skillFileContent, skillId, relativePath], () => dataService.getSkillFileContent(skillId, relativePath), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        staleTime: Infinity,
        ...config,
        enabled: enabled && (config?.enabled ?? true),
    });
};
/** Per-user skill active/inactive overrides. */
export const useGetSkillStatesQuery = (config) => {
    return useQuery([QueryKeys.skillStates], () => dataService.getSkillStates(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
export const useUpdateSkillStatesMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((skillStates) => dataService.updateSkillStates(skillStates), {
        onMutate: async (next) => {
            await queryClient.cancelQueries([QueryKeys.skillStates]);
            const previous = queryClient.getQueryData([QueryKeys.skillStates]);
            queryClient.setQueryData([QueryKeys.skillStates], next);
            return { previous };
        },
        onError: (_err, _next, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData([QueryKeys.skillStates], context.previous);
            }
        },
    });
};
