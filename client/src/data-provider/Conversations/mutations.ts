import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys, Constants } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type * as t from 'librechat-data-provider';
import { useConversationCache } from './hooks';
import { convoQueryKeys } from './cacheService';
import { updateConversationTag } from '~/utils/conversationTags';

export const useUpdateConversationMutation = (
  id: string,
): UseMutationResult<
  t.TUpdateConversationResponse,
  unknown,
  t.TUpdateConversationRequest,
  unknown
> => {
  const cache = useConversationCache();
  return useMutation(
    (payload: t.TUpdateConversationRequest) => dataService.updateConversation(payload),
    {
      onSuccess: (updatedConvo, payload) => {
        const targetId = payload.conversationId || id;
        cache.updateConversation(targetId, () => updatedConvo as t.TConversation);
        cache.invalidateProject(updatedConvo.chatProjectId);
      },
    },
  );
};

export const useTagConversationMutation = (
  conversationId: string,
  options?: t.updateTagsInConvoOptions,
): UseMutationResult<t.TTagConversationResponse, unknown, t.TTagConversationRequest, unknown> => {
  const cache = useConversationCache();
  const queryClient = useQueryClient();
  const { onSuccess, onError, onMutate } = options || {};
  return useMutation(
    (payload: t.TTagConversationRequest) =>
      dataService.addTagToConversation(conversationId, payload),
    {
      onMutate,
      onSuccess: (updatedTags, ...rest) => {
        queryClient.invalidateQueries(convoQueryKeys.tags());
        cache.updateTags(conversationId, updatedTags);
        onSuccess?.(updatedTags, ...rest);
      },
      onError,
    },
  );
};

export const useArchiveConvoMutation = (
  options?: t.ArchiveConversationOptions,
): UseMutationResult<
  t.TArchiveConversationResponse,
  unknown,
  t.TArchiveConversationRequest,
  unknown
> => {
  const cache = useConversationCache();
  const { onMutate, onError, onSuccess, ..._options } = options || {};

  return useMutation(
    (payload: t.TArchiveConversationRequest) => dataService.archiveConversation(payload),
    {
      onMutate: async (vars) => {
        if (onMutate) {
          return onMutate(vars);
        }
        const context = await cache.optimisticUpdate(vars.conversationId, (c) => {
          c.removeConversation(vars.conversationId, !vars.isArchived);
        }, { isArchived: !vars.isArchived });
        return context;
      },
      onSuccess: (_data, vars, context) => {
        const isArchived = vars.isArchived === true;

        cache.moveConversationBetweenLists(
          vars.conversationId,
          !isArchived,
          isArchived,
          _data as t.TConversation,
        );

        cache.invalidateProject(_data.chatProjectId);

        onSuccess?.(_data, vars, context);
      },
      onError: (_err, _vars, context) => {
        if (context && typeof context === 'object' && 'rollback' in context) {
          (context as { rollback: () => void }).rollback();
        }
        onError?.(_err, _vars, context);
      },
      onSettled: () => {
        cache.invalidateLists({ refetchFirstPageOnly: true });
      },
      ..._options,
    },
  );
};

export const useDeleteConversationMutation = (
  options?: t.DeleteConversationOptions,
): UseMutationResult<
  t.TDeleteConversationResponse,
  unknown,
  t.TDeleteConversationRequest,
  unknown
> => {
  const cache = useConversationCache();
  const queryClient = useQueryClient();

  return useMutation(
    (payload: t.TDeleteConversationRequest) =>
      dataService.deleteConversation(payload) as Promise<t.TDeleteConversationResponse>,
    {
      onMutate: async (vars) => {
        if (!vars.conversationId) {
          return;
        }
        const context = await cache.optimisticUpdate(vars.conversationId, (c) => {
          c.removeConversation(vars.conversationId!);
        });
        return context;
      },
      onError: (_err, _vars, context) => {
        if (context?.rollback) {
          context.rollback();
        }
      },
      onSuccess: (_data, vars, context) => {
        let deletedProjectId: string | undefined;
        const deletedConversation = vars.conversationId
          ? queryClient.getQueryData<t.TConversation>(convoQueryKeys.single(vars.conversationId))
          : undefined;
        deletedProjectId = deletedConversation?.chatProjectId ?? undefined;

        if (!deletedProjectId && vars.conversationId) {
          const found = cache.findConversation(vars.conversationId);
          deletedProjectId = found?.chatProjectId ?? undefined;
        }

        cache.invalidateLists({ refetchFirstPageOnly: true });
        cache.invalidateProject(deletedProjectId);

        options?.onSuccess?.(_data, vars, context);
      },
    },
  );
};

export const useDuplicateConversationMutation = (
  options?: t.DuplicateConvoOptions,
): UseMutationResult<t.TDuplicateConvoResponse, unknown, t.TDuplicateConvoRequest, unknown> => {
  const cache = useConversationCache();
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options ?? {};
  return useMutation((payload) => dataService.duplicateConversation(payload), {
    onSuccess: (data, vars, context) => {
      const duplicatedConversation = data.conversation;
      if (!duplicatedConversation?.conversationId) {
        return;
      }
      queryClient.setQueryData(
        convoQueryKeys.single(duplicatedConversation.conversationId),
        duplicatedConversation,
      );
      cache.addConversation(duplicatedConversation);
      queryClient.setQueryData(
        [QueryKeys.messages, duplicatedConversation.conversationId],
        data.messages,
      );
      cache.invalidateLists({ refetchFirstPageOnly: true });
      cache.invalidateProject(duplicatedConversation.chatProjectId);

      if (duplicatedConversation.tags && duplicatedConversation.tags.length > 0) {
        queryClient.setQueryData<t.TConversationTag[]>(convoQueryKeys.tags(), (oldTags) => {
          if (!oldTags) return oldTags;
          return oldTags.map((tag) => {
            if (duplicatedConversation.tags?.includes(tag.tag)) {
              return { ...tag, count: tag.count + 1 };
            }
            return tag;
          });
        });
      }

      onSuccess?.(data, vars, context);
    },
    ..._options,
  });
};

export const useForkConvoMutation = (
  options?: t.ForkConvoOptions,
): UseMutationResult<t.TForkConvoResponse, unknown, t.TForkConvoRequest, unknown> => {
  const cache = useConversationCache();
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options || {};

  return useMutation((payload: t.TForkConvoRequest) => dataService.forkConversation(payload), {
    onSuccess: (data, vars, context) => {
      if (!vars.conversationId) {
        return;
      }
      const forkedConversation = data.conversation;
      const forkedConversationId = forkedConversation.conversationId;
      if (!forkedConversationId) {
        return;
      }

      queryClient.setQueryData(convoQueryKeys.single(forkedConversationId), forkedConversation);
      cache.addConversation(forkedConversation);
      queryClient.setQueryData([QueryKeys.messages, forkedConversationId], data.messages);
      cache.invalidateLists({ refetchFirstPageOnly: true });
      cache.invalidateProject(forkedConversation.chatProjectId);

      if (forkedConversation.tags && forkedConversation.tags.length > 0) {
        queryClient.setQueryData<t.TConversationTag[]>(convoQueryKeys.tags(), (oldTags) => {
          if (!oldTags) return oldTags;
          return oldTags.map((tag) => {
            if (forkedConversation.tags?.includes(tag.tag)) {
              return { ...tag, count: tag.count + 1 };
            }
            return tag;
          });
        });
      }

      onSuccess?.(data, vars, context);
    },
    ..._options,
  });
};

export const useUploadConversationsMutation = (
  _options?: t.MutationOptions<t.TImportResponse, FormData>,
) => {
  const cache = useConversationCache();
  const { onSuccess, onError, onMutate } = _options || {};

  return useMutation<t.TImportResponse, unknown, FormData>({
    mutationFn: (formData: FormData) => dataService.importConversationsFile(formData),
    onSuccess: (data, variables, context) => {
      cache.invalidateLists({ refetchFirstPageOnly: false });
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError,
    onMutate,
  });
};

export const useConversationTagMutation = ({
  context,
  tag,
  options,
}: {
  context: string;
  tag?: string;
  options?: t.UpdateConversationTagOptions;
}): UseMutationResult<t.TConversationTagResponse, unknown, t.TConversationTagRequest, unknown> => {
  const queryClient = useQueryClient();
  const cache = useConversationCache();
  const { onSuccess, ..._options } = options || {};
  const onMutationSuccess: typeof onSuccess = (_data, vars) => {
    queryClient.setQueryData<t.TConversationTag[]>(convoQueryKeys.tags(), (queryData) => {
      if (!queryData) {
        return [
          {
            count: 1,
            position: 0,
            tag: Constants.SAVED_TAG,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ] as t.TConversationTag[];
      }
      if (tag === undefined || !tag.length) {
        const existingTagIndex = queryData.findIndex((item) => item.tag === _data.tag);
        if (existingTagIndex !== -1) {
          const updatedData = [...queryData];
          updatedData[existingTagIndex] = { ...updatedData[existingTagIndex], ..._data };
          return updatedData.sort((a, b) => a.position - b.position);
        } else {
          return [...queryData, _data].sort((a, b) => a.position - b.position);
        }
      }
      return updateConversationTag(queryData, vars, _data, tag);
    });
    if (vars.addToConversation === true && vars.conversationId != null && _data.tag) {
      cache.updateTags(vars.conversationId, [...(cache.findConversation(vars.conversationId)?.tags || []), _data.tag]);
    }
    if (tag != null) {
      cache.replaceTagInAllConversations(tag, _data.tag);
    }
  };
  return useMutation(
    (payload: t.TConversationTagRequest) =>
      tag != null
        ? dataService.updateConversationTag(tag, payload)
        : dataService.createConversationTag(payload),
    {
      onSuccess: (...args) => {
        onMutationSuccess(...args);
        onSuccess?.(...args);
      },
      ..._options,
    },
  );
};

export const useDeleteConversationTagMutation = (
  options?: t.DeleteConversationTagOptions,
): UseMutationResult<t.TConversationTagResponse, unknown, string, void> => {
  const queryClient = useQueryClient();
  const cache = useConversationCache();

  const { onSuccess, ..._options } = options || {};

  return useMutation((tag: string) => dataService.deleteConversationTag(tag), {
    onSuccess: (_data, tagToDelete, context) => {
      queryClient.setQueryData<t.TConversationTag[]>(convoQueryKeys.tags(), (data) => {
        if (!data) {
          return data;
        }
        return data.filter((t) => t.tag !== tagToDelete);
      });

      cache.removeTagFromAllConversations(tagToDelete);
      onSuccess?.(_data, tagToDelete, context);
    },
    ..._options,
  });
};
