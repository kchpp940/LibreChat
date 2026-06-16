import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys, Constants } from 'librechat-data-provider';
import { useConversationCache } from './hooks';
import { convoQueryKeys } from './cacheService';
import { updateConversationTag } from '~/utils/conversationTags';

export const useUpdateConversationMutation = (id) => {
  const cache = useConversationCache();
  return useMutation(
    (payload) => dataService.updateConversation(payload),
    {
      onSuccess: (updatedConvo, payload) => {
        const targetId = payload.conversationId || id;
        cache.updateConversation(targetId, () => updatedConvo);
        cache.invalidateProject(updatedConvo.chatProjectId);
      },
    },
  );
};

export const useTagConversationMutation = (conversationId, options) => {
  const cache = useConversationCache();
  const queryClient = useQueryClient();
  const { onSuccess, onError, onMutate } = options || {};
  return useMutation(
    (payload) => dataService.addTagToConversation(conversationId, payload),
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

export const useArchiveConvoMutation = (options) => {
  const cache = useConversationCache();
  const { onMutate, onError, onSuccess, ..._options } = options || {};

  return useMutation(
    (payload) => dataService.archiveConversation(payload),
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
          _data,
        );

        cache.invalidateProject(_data.chatProjectId);

        onSuccess?.(_data, vars, context);
      },
      onError: (_err, _vars, context) => {
        if (context && typeof context === 'object' && 'rollback' in context) {
          context.rollback();
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

export const useDeleteConversationMutation = (options) => {
  const cache = useConversationCache();
  const queryClient = useQueryClient();

  return useMutation(
    (payload) => dataService.deleteConversation(payload),
    {
      onMutate: async (vars) => {
        if (!vars.conversationId) {
          return;
        }
        const context = await cache.optimisticUpdate(vars.conversationId, (c) => {
          c.removeConversation(vars.conversationId);
        });
        return context;
      },
      onError: (_err, _vars, context) => {
        if (context?.rollback) {
          context.rollback();
        }
      },
      onSuccess: (_data, vars, context) => {
        let deletedProjectId;
        const deletedConversation = vars.conversationId
          ? queryClient.getQueryData(convoQueryKeys.single(vars.conversationId))
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

export const useDuplicateConversationMutation = (options) => {
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
        queryClient.setQueryData(convoQueryKeys.tags(), (oldTags) => {
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

export const useForkConvoMutation = (options) => {
  const cache = useConversationCache();
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options || {};

  return useMutation((payload) => dataService.forkConversation(payload), {
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
        queryClient.setQueryData(convoQueryKeys.tags(), (oldTags) => {
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

export const useUploadConversationsMutation = (_options) => {
  const cache = useConversationCache();
  const { onSuccess, onError, onMutate } = _options || {};

  return useMutation({
    mutationFn: (formData) => dataService.importConversationsFile(formData),
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

export const useConversationTagMutation = ({ context, tag, options }) => {
  const queryClient = useQueryClient();
  const cache = useConversationCache();
  const { onSuccess, ..._options } = options || {};
  const onMutationSuccess = (_data, vars) => {
    queryClient.setQueryData(convoQueryKeys.tags(), (queryData) => {
      if (!queryData) {
        return [
          {
            count: 1,
            position: 0,
            tag: Constants.SAVED_TAG,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
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
      cache.updateTags(
        vars.conversationId,
        [...(cache.findConversation(vars.conversationId)?.tags || []), _data.tag],
      );
    }
    if (tag != null) {
      cache.replaceTagInAllConversations(tag, _data.tag);
    }
  };
  return useMutation(
    (payload) =>
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

export const useDeleteConversationTagMutation = (options) => {
  const queryClient = useQueryClient();
  const cache = useConversationCache();

  const { onSuccess, ..._options } = options || {};

  return useMutation((tag) => dataService.deleteConversationTag(tag), {
    onSuccess: (_data, tagToDelete, context) => {
      queryClient.setQueryData(convoQueryKeys.tags(), (data) => {
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
