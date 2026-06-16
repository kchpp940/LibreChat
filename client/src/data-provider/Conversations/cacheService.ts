import { QueryKeys } from 'librechat-data-provider';
import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import type { TConversation, ConversationListResponse } from 'librechat-data-provider';

export type ConversationListParams = {
  isArchived?: boolean;
  sortBy?: string;
  sortDirection?: string;
  tags?: string[];
  search?: string;
  projectId?: string;
};

type ConversationQueryType = 'all' | 'archived' | 'project';

function getBaseQueryKey(type: ConversationQueryType): readonly unknown[] {
  switch (type) {
    case 'archived':
      return [QueryKeys.archivedConversations];
    case 'project':
      return [QueryKeys.projectConversations];
    case 'all':
    default:
      return [QueryKeys.allConversations];
  }
}

export const conversationQueryKeys = {
  all: (params: ConversationListParams = {}) =>
    [QueryKeys.allConversations, params] as const,
  archived: (params: ConversationListParams = {}) =>
    [QueryKeys.archivedConversations, params] as const,
  project: (params: ConversationListParams = {}) =>
    [QueryKeys.projectConversations, params] as const,
  detail: (id: string) => [QueryKeys.conversation, id] as const,
  tags: () => [QueryKeys.conversationTags] as const,
};

function getConversationQueryProjectId(queryKey: readonly unknown[]): string | undefined {
  const params = queryKey[1];
  if (!params || typeof params !== 'object') {
    return undefined;
  }
  return (params as { projectId?: string }).projectId;
}

function conversationMatchesProjectQuery(
  queryKey: readonly unknown[],
  conversation: Pick<TConversation, 'chatProjectId'>,
): boolean {
  const projectId = getConversationQueryProjectId(queryKey);
  if (!projectId) {
    return true;
  }
  if (projectId === 'unassigned') {
    return !conversation.chatProjectId;
  }
  return conversation.chatProjectId === projectId;
}

export function findConversationInInfinite(
  data: InfiniteData<ConversationListResponse> | undefined,
  conversationId: string,
): TConversation | undefined {
  if (!data) {
    return undefined;
  }
  for (const page of data.pages) {
    const found = page.conversations.find((c) => c.conversationId === conversationId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function updateInfiniteConvoPage(
  data: InfiniteData<ConversationListResponse> | undefined,
  conversationId: string,
  updater: (c: TConversation) => TConversation,
): InfiniteData<ConversationListResponse> | undefined {
  if (!data) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      conversations: page.conversations.map((c) =>
        c.conversationId === conversationId ? updater(c) : c,
      ),
    })),
  };
}

function addConversationToInfinitePages(
  data: InfiniteData<ConversationListResponse> | undefined,
  newConversation: TConversation,
): InfiniteData<ConversationListResponse> {
  if (!data) {
    return {
      pageParams: [undefined],
      pages: [{ conversations: [newConversation], nextCursor: null }],
    };
  }
  return {
    ...data,
    pages: [
      { ...data.pages[0], conversations: [newConversation, ...data.pages[0].conversations] },
      ...data.pages.slice(1),
    ],
  };
}

function removeConvoFromInfinitePages(
  data: InfiniteData<ConversationListResponse> | undefined,
  conversationId: string,
): InfiniteData<ConversationListResponse> | undefined {
  if (!data) {
    return data;
  }
  return {
    ...data,
    pages: data.pages
      .map((page) => ({
        ...page,
        conversations: page.conversations.filter((c) => c.conversationId !== conversationId),
      }))
      .filter((page) => page.conversations.length > 0),
  };
}

function updateConvoFieldsInfinite(
  data: InfiniteData<ConversationListResponse> | undefined,
  updatedConversation: Partial<TConversation> & { conversationId: string },
  keepPosition = false,
): InfiniteData<ConversationListResponse> | undefined {
  if (!data) {
    return data;
  }
  let found: TConversation | undefined;
  let pageIdx = -1,
    convoIdx = -1;
  for (let i = 0; i < data.pages.length; ++i) {
    const idx = data.pages[i].conversations.findIndex(
      (c) => c.conversationId === updatedConversation.conversationId,
    );
    if (idx !== -1) {
      pageIdx = i;
      convoIdx = idx;
      found = data.pages[i].conversations[idx];
      break;
    }
  }
  if (!found) {
    return data;
  }

  if (keepPosition) {
    return {
      ...data,
      pages: data.pages.map((page, pi) =>
        pi === pageIdx
          ? {
              ...page,
              conversations: page.conversations.map((c, ci) =>
                ci === convoIdx ? { ...c, ...updatedConversation } : c,
              ),
            }
          : page,
      ),
    };
  } else {
    const patched = { ...found, ...updatedConversation, updatedAt: new Date().toISOString() };
    const pages = data.pages.map((page) => ({
      ...page,
      conversations: page.conversations.filter((c) => c.conversationId !== patched.conversationId),
    }));

    pages[0].conversations = [patched, ...pages[0].conversations];

    const finalPages = pages.filter((page) => page.conversations.length > 0);
    return { ...data, pages: finalPages };
  }
}

export const conversationCacheService = {
  getQueryKey: (type: ConversationQueryType, params: ConversationListParams = {}) => {
    const baseKey = getBaseQueryKey(type);
    return [...baseKey, params] as const;
  },

  getDetailQueryKey: (id: string) => [QueryKeys.conversation, id] as const,

  getTagsQueryKey: () => [QueryKeys.conversationTags] as const,

  findConversation: (
    queryClient: QueryClient,
    conversationId: string,
    type: ConversationQueryType = 'all',
  ): TConversation | undefined => {
    const baseKey = getBaseQueryKey(type);
    const queries = queryClient.getQueryCache().findAll(baseKey, { exact: false });

    for (const query of queries) {
      const data = queryClient.getQueryData<InfiniteData<ConversationListResponse>>(query.queryKey);
      const found = findConversationInInfinite(data, conversationId);
      if (found) {
        return found;
      }
    }

    const detailData = queryClient.getQueryData<TConversation>([
      QueryKeys.conversation,
      conversationId,
    ]);
    return detailData;
  },

  getConversation: (queryClient: QueryClient, conversationId: string): TConversation | undefined => {
    return queryClient.getQueryData<TConversation>([QueryKeys.conversation, conversationId]);
  },

  setConversation: (
    queryClient: QueryClient,
    conversationId: string,
    conversation: TConversation | null,
  ) => {
    queryClient.setQueryData([QueryKeys.conversation, conversationId], conversation);
  },

  removeConversation: (queryClient: QueryClient, conversationId: string) => {
    queryClient.removeQueries({
      queryKey: [QueryKeys.conversation, conversationId],
      exact: true,
    });
  },

  addConversationToAllQueries: (
    queryClient: QueryClient,
    newConversation: TConversation,
    type: ConversationQueryType = 'all',
  ) => {
    const baseKey = getBaseQueryKey(type);
    const queries = queryClient.getQueryCache().findAll(baseKey, { exact: false });

    for (const query of queries) {
      if (!conversationMatchesProjectQuery(query.queryKey, newConversation)) {
        continue;
      }
      queryClient.setQueryData<InfiniteData<ConversationListResponse>>(query.queryKey, (old) => {
        if (
          !old ||
          old.pages[0].conversations.some((c) => c.conversationId === newConversation.conversationId)
        ) {
          return old;
        }
        return addConversationToInfinitePages(old, newConversation);
      });
    }
  },

  addConversation: (queryClient: QueryClient, newConversation: TConversation) => {
    conversationCacheService.setConversation(
      queryClient,
      newConversation.conversationId ?? '',
      newConversation,
    );
    conversationCacheService.addConversationToAllQueries(queryClient, newConversation, 'all');
  },

  updateConversationInAllQueries: (
    queryClient: QueryClient,
    conversationId: string,
    updater: (c: TConversation) => TConversation,
    moveToTop = false,
    type: ConversationQueryType = 'all',
  ) => {
    const baseKey = getBaseQueryKey(type);
    const queries = queryClient.getQueryCache().findAll(baseKey, { exact: false });

    for (const query of queries) {
      queryClient.setQueryData<InfiniteData<ConversationListResponse>>(query.queryKey, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        let pageIdx = -1;
        let convoIdx = -1;
        for (let pi = 0; pi < oldData.pages.length; pi++) {
          const ci = oldData.pages[pi].conversations.findIndex(
            (c) => c.conversationId === conversationId,
          );
          if (ci !== -1) {
            pageIdx = pi;
            convoIdx = ci;
            break;
          }
        }

        if (pageIdx === -1) {
          return oldData;
        }

        const found = oldData.pages[pageIdx].conversations[convoIdx];
        const updated = moveToTop
          ? { ...updater(found), updatedAt: new Date().toISOString() }
          : updater(found);

        if (!conversationMatchesProjectQuery(query.queryKey, updated)) {
          return removeConvoFromInfinitePages(oldData, conversationId);
        }

        if (!moveToTop || (pageIdx === 0 && convoIdx === 0)) {
          return {
            ...oldData,
            pages: oldData.pages.map((page, pi) =>
              pi === pageIdx
                ? {
                    ...page,
                    conversations: page.conversations.map((c, ci) =>
                      ci === convoIdx ? updated : c,
                    ),
                  }
                : page,
            ),
          };
        }

        const newPages = oldData.pages.map((page, pi) => {
          if (pi === 0 && pageIdx === 0) {
            const convos = page.conversations.filter((_, ci) => ci !== convoIdx);
            return { ...page, conversations: [updated, ...convos] };
          }
          if (pi === 0) {
            return { ...page, conversations: [updated, ...page.conversations] };
          }
          if (pi === pageIdx) {
            return {
              ...page,
              conversations: page.conversations.filter((_, ci) => ci !== convoIdx),
            };
          }
          return page;
        });

        return { ...oldData, pages: newPages };
      });
    }
  },

  updateConversation: (
    queryClient: QueryClient,
    conversationId: string,
    updater: (c: TConversation) => TConversation,
    moveToTop = false,
  ) => {
    const current = conversationCacheService.getConversation(queryClient, conversationId);
    if (current) {
      queryClient.setQueryData(
        [QueryKeys.conversation, conversationId],
        moveToTop ? { ...updater(current), updatedAt: new Date().toISOString() } : updater(current),
      );
    }

    conversationCacheService.updateConversationInAllQueries(
      queryClient,
      conversationId,
      updater,
      moveToTop,
      'all',
    );
    conversationCacheService.updateConversationInAllQueries(
      queryClient,
      conversationId,
      updater,
      moveToTop,
      'archived',
    );
  },

  upsertConversation: (
    queryClient: QueryClient,
    nextConvo: TConversation,
    moveToTop = true,
  ) => {
    if (!nextConvo.conversationId) {
      return;
    }

    const existing = conversationCacheService.findConversation(
      queryClient,
      nextConvo.conversationId,
    );
    if (!existing) {
      conversationCacheService.addConversation(queryClient, nextConvo);
      return;
    }

    conversationCacheService.updateConversation(
      queryClient,
      nextConvo.conversationId,
      () => nextConvo,
      moveToTop,
    );
  },

  removeConversationFromAllQueries: (
    queryClient: QueryClient,
    conversationId: string,
    type: ConversationQueryType = 'all',
  ) => {
    const baseKey = getBaseQueryKey(type);
    const queries = queryClient.getQueryCache().findAll(baseKey, { exact: false });

    for (const query of queries) {
      queryClient.setQueryData<InfiniteData<ConversationListResponse>>(query.queryKey, (oldData) => {
        if (!oldData) {
          return oldData;
        }
        return removeConvoFromInfinitePages(oldData, conversationId);
      });
    }
  },

  removeConversationFromCache: (queryClient: QueryClient, conversationId: string) => {
    conversationCacheService.removeConversationFromAllQueries(queryClient, conversationId, 'all');
    conversationCacheService.removeConversationFromAllQueries(
      queryClient,
      conversationId,
      'archived',
    );
    conversationCacheService.removeConversationFromAllQueries(
      queryClient,
      conversationId,
      'project',
    );
    conversationCacheService.removeConversation(queryClient, conversationId);
  },

  archiveConversation: (
    queryClient: QueryClient,
    conversationId: string,
    isArchived: boolean,
    archivedConversation?: TConversation,
  ) => {
    if (isArchived) {
      conversationCacheService.removeConversationFromAllQueries(queryClient, conversationId, 'all');
      conversationCacheService.removeConversationFromAllQueries(
        queryClient,
        conversationId,
        'project',
      );

      if (archivedConversation) {
        const archivedQueries = queryClient
          .getQueryCache()
          .findAll([QueryKeys.archivedConversations], { exact: false });

        for (const query of archivedQueries) {
          queryClient.setQueryData<InfiniteData<ConversationListResponse>>(
            query.queryKey,
            (oldData) => {
              if (!oldData) {
                return oldData;
              }
              return {
                ...oldData,
                pages: [
                  {
                    ...oldData.pages[0],
                    conversations: [archivedConversation, ...oldData.pages[0].conversations],
                  },
                  ...oldData.pages.slice(1),
                ],
              };
            },
          );
        }

        queryClient.setQueryData(
          [QueryKeys.conversation, conversationId],
          archivedConversation,
        );
      } else {
        queryClient.setQueryData([QueryKeys.conversation, conversationId], null);
      }
    } else {
      conversationCacheService.removeConversationFromAllQueries(
        queryClient,
        conversationId,
        'archived',
      );

      if (archivedConversation) {
        conversationCacheService.addConversationToAllQueries(
          queryClient,
          archivedConversation,
          'all',
        );
        queryClient.setQueryData(
          [QueryKeys.conversation, conversationId],
          archivedConversation,
        );
      }
    }
  },

  updateTagsInConversation: (
    queryClient: QueryClient,
    conversationId: string,
    tags: string[],
  ) => {
    const currentConvo = conversationCacheService.getConversation(queryClient, conversationId);
    if (currentConvo) {
      queryClient.setQueryData([QueryKeys.conversation, conversationId], {
        ...currentConvo,
        tags,
      });
    }

    const updateTags = (type: ConversationQueryType) => {
      const baseKey = getBaseQueryKey(type);
      const queries = queryClient.getQueryCache().findAll(baseKey, { exact: false });

      for (const query of queries) {
        queryClient.setQueryData<InfiniteData<ConversationListResponse>>(
          query.queryKey,
          (convoData) => {
            if (!convoData) {
              return convoData;
            }
            return updateInfiniteConvoPage(convoData, conversationId, (conv) => ({
              ...conv,
              tags,
            }));
          },
        );
      }
    };

    updateTags('all');
    updateTags('archived');
    updateTags('project');
  },

  replaceTagInAllConversations: (queryClient: QueryClient, oldTag: string, newTag: string) => {
    const replaceTag = (type: ConversationQueryType) => {
      const baseKey = getBaseQueryKey(type);
      const data = queryClient.getQueryData<InfiniteData<ConversationListResponse>>(baseKey);

      if (!data) {
        return;
      }

      const newData = JSON.parse(JSON.stringify(data)) as InfiniteData<ConversationListResponse>;
      for (let pageIndex = 0; pageIndex < newData.pages.length; pageIndex++) {
        const page = newData.pages[pageIndex];
        page.conversations = page.conversations.map((conversation) => {
          if (
            conversation.conversationId &&
            'tags' in conversation &&
            Array.isArray((conversation as { tags?: string[] }).tags) &&
            (conversation as { tags?: string[] }).tags?.includes(oldTag)
          ) {
            (conversation as { tags: string[] }).tags = (
              conversation as { tags: string[] }
            ).tags.map((t: string) => (t === oldTag ? newTag : t));
          }
          return conversation;
        });
      }
      queryClient.setQueryData<InfiniteData<ConversationListResponse>>(baseKey, newData);
    };

    replaceTag('all');
    replaceTag('archived');
    replaceTag('project');
  },

  invalidateConversations: (queryClient: QueryClient, type: ConversationQueryType = 'all') => {
    const baseKey = getBaseQueryKey(type);
    queryClient.invalidateQueries({
      queryKey: baseKey,
      refetchPage: (_, index) => index === 0,
    });
  },

  invalidateAllConversationLists: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({
      queryKey: [QueryKeys.allConversations],
      refetchPage: (_, index) => index === 0,
    });
    queryClient.invalidateQueries({
      queryKey: [QueryKeys.archivedConversations],
      refetchPage: (_, index) => index === 0,
    });
    queryClient.invalidateQueries([QueryKeys.projectConversations]);
    queryClient.invalidateQueries([QueryKeys.projects]);
  },

  invalidateConversationTags: (queryClient: QueryClient) => {
    queryClient.invalidateQueries([QueryKeys.conversationTags]);
  },

  cancelConversationsQuery: async (
    queryClient: QueryClient,
    type: ConversationQueryType = 'all',
  ) => {
    const baseKey = getBaseQueryKey(type);
    await queryClient.cancelQueries(baseKey);
  },

  cancelAllConversationQueries: async (queryClient: QueryClient) => {
    await queryClient.cancelQueries([QueryKeys.allConversations]);
    await queryClient.cancelQueries([QueryKeys.archivedConversations]);
  },
};

export default conversationCacheService;
