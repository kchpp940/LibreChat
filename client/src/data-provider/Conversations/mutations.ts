import {
  Constants,
  QueryKeys,
} from 'librechat-data-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, MutationKeys } from 'librechat-data-provider';
import type { UseMutationResult, InfiniteData } from '@tanstack/react-query';
import type * as t from 'librechat-data-provider';
import {
  logger,
} from '~/utils';
import useUpdateTagsInConvo from '~/hooks/Conversations/useUpdateTagsInConvo';
import { updateConversationTag } from '~/utils/conversationTags';
import { useConversationTagsQuery } from './queries';
import { conversationCacheService } from './cacheService';

export const useUpdateConversationMutation = (
  id: string,
): UseMutationResult<
  t.TUpdateConversationResponse,
  unknown,
  t.TUpdateConversationRequest,
  unknown
> => {
  const queryClient = useQueryClient();
  return useMutation(
    (payload: t.TUpdateConversationRequest) => dataService.updateConversation(payload),
    {
      onSuccess: (updatedConvo, payload) => {
        const targetId = payload.conversationId || id;
        conversationCacheService.setConversation(queryClient, targetId, updatedConvo);
        conversationCacheService.updateConversation(
          queryClient,
          targetId,
          () => updatedConvo,
          false,
        );
        queryClient.invalidateQueries([QueryKeys.projectConversations]);
      },
    },
  );
};

export const useTagConversationMutation = (
  conversationId: string,
  options?: t.updateTagsInConvoOptions,
): UseMutationResult<t.TTagConversationResponse, unknown, t.TTagConversationRequest, unknown> => {
  const query = useConversationTagsQuery();
  const { updateTagsInConversation } = useUpdateTagsInConvo();
  return useMutation(
    (payload: t.TTagConversationRequest) =>
      dataService.addTagToConversation(conversationId, payload),
    {
      onSuccess: (updatedTags, ...rest) => {
        query.refetch();
        updateTagsInConversation(conversationId, updatedTags);
        options?.onSuccess?.(updatedTags, ...rest);
      },
      onError: options?.onError,
      onMutate: options?.onMutate,
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
  const queryClient = useQueryClient();
  const { onMutate, onError, onSuccess, ..._options } = options || {};

  return useMutation(
    (payload: t.TArchiveConversationRequest) => dataService.archiveConversation(payload),
    {
      onMutate,
      onSuccess: (_data, vars, context) => {
        const isArchived = vars.isArchived === true;

        conversationCacheService.archiveConversation(
          queryClient,
          vars.conversationId,
          isArchived,
          _data,
        );

        if (_data.chatProjectId) {
          queryClient.invalidateQueries([QueryKeys.project, _data.chatProjectId]);
        }

        onSuccess?.(_data, vars, context);
      },
      onError,
      onSettled: () => {
        conversationCacheService.invalidateConversations(queryClient, 'all');
        conversationCacheService.invalidateConversations(queryClient, 'archived');
        queryClient.invalidateQueries([QueryKeys.projectConversations]);
        queryClient.invalidateQueries([QueryKeys.projects]);
      },
      ..._options,
    },
  );
};

export const useCreateSharedLinkMutation = (
  options?: t.MutationOptions<
    t.TCreateShareLinkRequest,
    { conversationId: string; targetMessageId?: string }
  >,
): UseMutationResult<
  t.TSharedLinkResponse,
  unknown,
  { conversationId: string; targetMessageId?: string },
  unknown
> => {
  const queryClient = useQueryClient();

  const { onSuccess, ..._options } = options || {};
  return useMutation(
    ({ conversationId, targetMessageId }: { conversationId: string; targetMessageId?: string }) => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      return dataService.createSharedLink(conversationId, targetMessageId);
    },
    {
      onSuccess: (_data: t.TSharedLinkResponse, vars, context) => {
        queryClient.setQueryData([QueryKeys.sharedLinks, _data.conversationId], _data);

        onSuccess?.(_data, vars, context);
      },
      ..._options,
    },
  );
};

export const useUpdateSharedLinkMutation = (
  options?: t.MutationOptions<t.TUpdateShareLinkRequest, t.TUpdateShareLinkRequest>,
): UseMutationResult<t.TSharedLinkResponse, unknown, t.TUpdateShareLinkRequest, unknown> => {
  const queryClient = useQueryClient();

  const { onSuccess, ..._options } = options || {};
  return useMutation(
    ({ shareId, targetMessageId }) => {
      if (!shareId) {
        throw new Error('Share ID is required');
      }
      return dataService.updateSharedLink(shareId, targetMessageId);
    },
    {
      onSuccess: (_data: t.TSharedLinkResponse, vars, context) => {
        queryClient.setQueryData([QueryKeys.sharedLinks, _data.conversationId], _data);

        onSuccess?.(_data, vars, context);
      },
      ..._options,
    },
  );
};

export const useDeleteSharedLinkMutation = (
  options?: t.DeleteSharedLinkOptions,
): UseMutationResult<
  t.TDeleteSharedLinkResponse,
  unknown,
  { shareId: string },
  t.DeleteSharedLinkContext
> => {
  const queryClient = useQueryClient();
  const { onSuccess } = options || {};

  return useMutation((vars) => dataService.deleteSharedLink(vars.shareId), {
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: [QueryKeys.sharedLinks],
        exact: false,
      });

      const previousQueries = new Map();
      const queryKeys = queryClient.getQueryCache().findAll([QueryKeys.sharedLinks]);

      queryKeys.forEach((query) => {
        const previousData = queryClient.getQueryData(query.queryKey);
        previousQueries.set(query.queryKey, previousData);

        queryClient.setQueryData<t.SharedLinkQueryData>(query.queryKey, (old) => {
          if (!old?.pages) {
            return old;
          }

          const updatedPages = old.pages.map((page) => ({
            ...page,
            links: page.links.filter((link) => link.shareId !== vars.shareId),
          }));

          const nonEmptyPages = updatedPages.filter((page) => page.links.length > 0);

          return {
            ...old,
            pages: nonEmptyPages,
          };
        });
      });

      return { previousQueries };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach((prevData: unknown, prevQueryKey: unknown) => {
          queryClient.setQueryData(prevQueryKey as string[], prevData);
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.sharedLinks],
        exact: false,
      });
    },

    onSuccess: (data, variables) => {
      if (onSuccess) {
        onSuccess(data, variables);
      }

      queryClient.refetchQueries({
        queryKey: [QueryKeys.sharedLinks],
        exact: true,
      });
    },
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
  const { onSuccess, ..._options } = options || {};
  const onMutationSuccess: typeof onSuccess = (_data, vars) => {
    queryClient.setQueryData<t.TConversationTag[]>([QueryKeys.conversationTags], (queryData) => {
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
          logger.log(
            'tag_mutation',
            `"Created" tag exists, updating from ${context}`,
            queryData,
            _data,
          );
          const updatedData = [...queryData];
          updatedData[existingTagIndex] = { ...updatedData[existingTagIndex], ..._data };
          return updatedData.sort((a, b) => a.position - b.position);
        } else {
          logger.log(
            'tag_mutation',
            `"Created" tag is new, adding from ${context}`,
            queryData,
            _data,
          );
          return [...queryData, _data].sort((a, b) => a.position - b.position);
        }
      }
      logger.log('tag_mutation', `Updating tag from ${context}`, queryData, _data);
      return updateConversationTag(queryData, vars, _data, tag);
    });
    if (vars.addToConversation === true && vars.conversationId != null && _data.tag) {
      const currentConvo = conversationCacheService.getConversation(
        queryClient,
        vars.conversationId,
      );
      if (!currentConvo) {
        return;
      }
      logger.log(
        'tag_mutation',
        `\`updateTagsInConversation\` Update from ${context}`,
        currentConvo,
      );
      updateTagsInConversation(vars.conversationId, [...(currentConvo.tags || []), _data.tag]);
    }
    if (tag != null) {
      replaceTagsInAllConversations(tag, _data.tag);
    }
  };
  const { updateTagsInConversation, replaceTagsInAllConversations } = useUpdateTagsInConvo();
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

export const useDeleteTagInConversations = () => {
  const queryClient = useQueryClient();
  const deleteTagInAllConversation = (deletedTag: string) => {
    const conversationIdsWithTag: string[] = [];

    const processQueryType = (type: 'all' | 'archived' | 'project') => {
      const baseKey =
        type === 'all'
          ? [QueryKeys.allConversations]
          : type === 'archived'
            ? [QueryKeys.archivedConversations]
            : [QueryKeys.projectConversations];

      const queries = queryClient.getQueryCache().findAll(baseKey, { exact: false });

      for (const query of queries) {
        queryClient.setQueryData<InfiniteData<t.ConversationListResponse>>(
          query.queryKey,
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            const updatedPages = oldData.pages.map((page) => ({
              ...page,
              conversations: page.conversations.map((conversation) => {
                if (
                  conversation.conversationId &&
                  'tags' in conversation &&
                  Array.isArray(
                    (conversation as unknown as { tags?: string[] }).tags,
                  ) &&
                  (conversation as unknown as { tags: string[] }).tags.includes(
                    deletedTag,
                  )
                ) {
                  if (conversationIdsWithTag.indexOf(conversation.conversationId) === -1) {
                    conversationIdsWithTag.push(conversation.conversationId);
                  }
                  return {
                    ...conversation,
                    tags: (conversation as unknown as { tags: string[] }).tags.filter(
                      (tag: string) => tag !== deletedTag,
                    ),
                  };
                }
                return conversation;
              }),
            }));

            return {
              ...oldData,
              pages: updatedPages,
            };
          },
        );
      }
    };

    processQueryType('all');
    processQueryType('archived');
    processQueryType('project');

    for (let i = 0; i < conversationIdsWithTag.length; i++) {
      const conversationId = conversationIdsWithTag[i];
      const conversationData = conversationCacheService.getConversation(
        queryClient,
        conversationId,
      );
      if (conversationData && Array.isArray((conversationData as { tags?: string[] }).tags)) {
        queryClient.setQueryData<t.TConversation>(
          [QueryKeys.conversation, conversationId],
          {
            ...conversationData,
            tags: (conversationData as { tags: string[] }).tags.filter(
              (tag: string) => tag !== deletedTag,
            ),
          },
        );
      }
    }
  };
  return deleteTagInAllConversation;
};

export const useDeleteConversationTagMutation = (
  options?: t.DeleteConversationTagOptions,
): UseMutationResult<t.TConversationTagResponse, unknown, string, void> => {
  const queryClient = useQueryClient();
  const deleteTagInAllConversations = useDeleteTagInConversations();

  const { onSuccess, ..._options } = options || {};

  return useMutation((tag: string) => dataService.deleteConversationTag(tag), {
    onSuccess: (_data, tagToDelete, context) => {
      queryClient.setQueryData<t.TConversationTag[]>([QueryKeys.conversationTags], (data) => {
        if (!data) {
          return data;
        }
        return data.filter((t) => t.tag !== tagToDelete);
      });

      deleteTagInAllConversations(tagToDelete);
      onSuccess?.(_data, tagToDelete, context);
    },
    ..._options,
  });
};

export const useDeleteConversationMutation = (
  options?: t.DeleteConversationOptions,
): UseMutationResult<
  t.TDeleteConversationResponse,
  unknown,
  t.TDeleteConversationRequest,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation(
    (payload: t.TDeleteConversationRequest) =>
      dataService.deleteConversation(payload) as Promise<t.TDeleteConversationResponse>,
    {
      onMutate: async () => {
        await conversationCacheService.cancelAllConversationQueries(queryClient);
      },
      onError: () => {
      },
      onSuccess: (data, vars, context) => {
        const deletedConversation = vars.conversationId
          ? conversationCacheService.getConversation(queryClient, vars.conversationId)
          : undefined;
        let deletedProjectId = deletedConversation?.chatProjectId;
        if (!deletedProjectId && vars.conversationId) {
          const cacheKeys = [QueryKeys.allConversations, QueryKeys.projectConversations];
          for (const cacheKey of cacheKeys) {
            const queries = queryClient.getQueryCache().findAll([cacheKey], { exact: false });
            for (const query of queries) {
              const found = conversationCacheService.findConversation(
                queryClient,
                vars.conversationId,
              );
              if (found?.chatProjectId) {
                deletedProjectId = found.chatProjectId;
                break;
              }
            }
            if (deletedProjectId) {
              break;
            }
          }
        }

        if (vars.conversationId) {
          conversationCacheService.removeConversationFromCache(queryClient, vars.conversationId);
        }

        conversationCacheService.invalidateAllConversationLists(queryClient);

        if (deletedProjectId) {
          queryClient.invalidateQueries([QueryKeys.project, deletedProjectId]);
        }

        options?.onSuccess?.(data, vars, context);
      },
    },
  );
};

export const useDuplicateConversationMutation = (
  options?: t.DuplicateConvoOptions,
): UseMutationResult<t.TDuplicateConvoResponse, unknown, t.TDuplicateConvoRequest, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options ?? {};
  return useMutation((payload) => dataService.duplicateConversation(payload), {
    onSuccess: (data, vars, context) => {
      const duplicatedConversation = data.conversation;
      if (!duplicatedConversation?.conversationId) {
        return;
      }
      conversationCacheService.setConversation(
        queryClient,
        duplicatedConversation.conversationId,
        duplicatedConversation,
      );
      conversationCacheService.addConversationToAllQueries(
        queryClient,
        duplicatedConversation,
        'all',
      );
      queryClient.setQueryData(
        [QueryKeys.messages, duplicatedConversation.conversationId],
        data.messages,
      );
      conversationCacheService.invalidateConversations(queryClient, 'all');
      queryClient.invalidateQueries([QueryKeys.projectConversations]);
      queryClient.invalidateQueries([QueryKeys.projects]);
      if (duplicatedConversation.chatProjectId) {
        queryClient.invalidateQueries([QueryKeys.project, duplicatedConversation.chatProjectId]);
      }

      if (duplicatedConversation.tags && duplicatedConversation.tags.length > 0) {
        queryClient.setQueryData<t.TConversationTag[]>([QueryKeys.conversationTags], (oldTags) => {
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

      conversationCacheService.setConversation(
        queryClient,
        forkedConversationId,
        forkedConversation,
      );
      conversationCacheService.addConversationToAllQueries(
        queryClient,
        forkedConversation,
        'all',
      );
      queryClient.setQueryData([QueryKeys.messages, forkedConversationId], data.messages);
      conversationCacheService.invalidateConversations(queryClient, 'all');
      queryClient.invalidateQueries([QueryKeys.projectConversations]);
      queryClient.invalidateQueries([QueryKeys.projects]);
      if (forkedConversation.chatProjectId) {
        queryClient.invalidateQueries([QueryKeys.project, forkedConversation.chatProjectId]);
      }

      if (forkedConversation.tags && forkedConversation.tags.length > 0) {
        queryClient.setQueryData<t.TConversationTag[]>([QueryKeys.conversationTags], (oldTags) => {
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
  const queryClient = useQueryClient();
  const { onSuccess, onError, onMutate } = _options || {};

  return useMutation<t.TImportResponse, unknown, FormData>({
    mutationFn: (formData: FormData) => dataService.importConversationsFile(formData),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.allConversations]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (err, variables, context) => {
      if (onError) {
        onError(err, variables, context);
      }
    },
    onMutate,
  });
};

export const useUpdatePresetMutation = (
  options?: t.UpdatePresetOptions,
): UseMutationResult<
  t.TPreset,
  unknown,
  t.TPreset,
  unknown
> => {
  return useMutation([MutationKeys.updatePreset], {
    mutationFn: (preset: t.TPreset) => dataService.updatePreset(preset),
    ...(options || {}),
  });
};

export const useDeletePresetMutation = (
  options?: t.DeletePresetOptions,
): UseMutationResult<
  t.PresetDeleteResponse,
  unknown,
  t.TPreset | undefined,
  unknown
> => {
  return useMutation([MutationKeys.deletePreset], {
    mutationFn: (preset: t.TPreset | undefined) => dataService.deletePreset(preset),
    ...(options || {}),
  });
};

export const useUploadAvatarMutation = (
  options?: t.UploadAvatarOptions,
): UseMutationResult<
  t.AvatarUploadResponse,
  unknown,
  FormData,
  unknown
> => {
  return useMutation([MutationKeys.avatarUpload], {
    mutationFn: (variables: FormData) => dataService.uploadAvatar(variables),
    ...(options || {}),
  });
};

export const useSpeechToTextMutation = (
  options?: t.SpeechToTextOptions,
): UseMutationResult<
  t.SpeechToTextResponse,
  unknown,
  FormData,
  unknown
> => {
  return useMutation([MutationKeys.speechToText], {
    mutationFn: (variables: FormData) => dataService.speechToText(variables),
    ...(options || {}),
  });
};

export const useTextToSpeechMutation = (
  options?: t.TextToSpeechOptions,
): UseMutationResult<
  ArrayBuffer,
  unknown,
  FormData,
  unknown
> => {
  return useMutation([MutationKeys.textToSpeech], {
    mutationFn: (variables: FormData) => dataService.textToSpeech(variables),
    ...(options || {}),
  });
};

export const useVerifyEmailMutation = (
  options?: t.VerifyEmailOptions,
): UseMutationResult<t.VerifyEmailResponse, unknown, t.TVerifyEmail, unknown> => {
  return useMutation({
    mutationFn: (variables: t.TVerifyEmail) => dataService.verifyEmail(variables),
    ...(options || {}),
  });
};

export const useResendVerificationEmail = (
  options?: t.ResendVerifcationOptions,
): UseMutationResult<t.VerifyEmailResponse, unknown, t.TResendVerificationEmail, unknown> => {
  return useMutation({
    mutationFn: (variables: t.TResendVerificationEmail) =>
      dataService.resendVerificationEmail(variables),
    ...(options || {}),
  });
};

export const useAcceptTermsMutation = (
  options?: t.AcceptTermsMutationOptions,
): UseMutationResult<t.TAcceptTermsResponse, unknown, void, unknown> => {
  const queryClient = useQueryClient();
  return useMutation(() => dataService.acceptTerms(), {
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData<t.TUserTermsResponse>([QueryKeys.userTerms], {
        termsAccepted: true,
      });
      options?.onSuccess?.(data, variables, context);
    },
    onError: options?.onError,
    onMutate: options?.onMutate,
  });
};

export default {
  useUpdateConversationMutation,
  useTagConversationMutation,
  useArchiveConvoMutation,
  useCreateSharedLinkMutation,
  useUpdateSharedLinkMutation,
  useDeleteSharedLinkMutation,
  useConversationTagMutation,
  useDeleteTagInConversations,
  useDeleteConversationTagMutation,
  useDeleteConversationMutation,
  useDuplicateConversationMutation,
  useForkConvoMutation,
  useUploadConversationsMutation,
  useUpdatePresetMutation,
  useDeletePresetMutation,
  useUploadAvatarMutation,
  useSpeechToTextMutation,
  useTextToSpeechMutation,
  useVerifyEmailMutation,
  useResendVerificationEmail,
  useAcceptTermsMutation,
};
