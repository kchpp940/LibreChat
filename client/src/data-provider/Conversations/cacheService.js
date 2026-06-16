import { QueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';

export const convoQueryKeys = {
  list: (params = {}) => [
    params.isArchived ? QueryKeys.archivedConversations : QueryKeys.allConversations,
    {
      isArchived: params.isArchived,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
      tags: params.tags,
      search: params.search,
      projectId: params.projectId,
    },
  ],

  single: (conversationId) => [QueryKeys.conversation, conversationId],

  allLists: () => [QueryKeys.allConversations],

  allArchived: () => [QueryKeys.archivedConversations],

  allConversations: () => [QueryKeys.allConversations],

  tags: () => [QueryKeys.conversationTags],
};

function getConversationQueryProjectId(queryKey) {
  const params = queryKey[1];
  if (!params || typeof params !== 'object') {
    return undefined;
  }
  return params.projectId;
}

function conversationMatchesProjectQuery(queryKey, conversation) {
  const projectId = getConversationQueryProjectId(queryKey);
  if (!projectId) {
    return true;
  }
  if (projectId === 'unassigned') {
    return !conversation.chatProjectId;
  }
  return conversation.chatProjectId === projectId;
}

export function findConversationInData(data, conversationId) {
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

export function flattenConversations(data) {
  if (!data?.pages) {
    return [];
  }
  return data.pages.flatMap((page) => page.conversations ?? []);
}

export function hasNextPage(data) {
  if (!data?.pages || data.pages.length === 0) {
    return false;
  }
  const lastPage = data.pages[data.pages.length - 1];
  return lastPage?.nextCursor !== null && lastPage?.nextCursor !== undefined;
}

function updateInfiniteConvoPage(data, conversationId, updater) {
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

function removeFromInfinitePages(data, conversationId) {
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

function addToInfinitePages(data, newConversation) {
  if (!data) {
    return {
      pageParams: [undefined],
      pages: [{ conversations: [newConversation], nextCursor: null }],
    };
  }
  const exists = data.pages.some((p) =>
    p.conversations.some((c) => c.conversationId === newConversation.conversationId),
  );
  if (exists) {
    return data;
  }
  return {
    ...data,
    pages: [
      { ...data.pages[0], conversations: [newConversation, ...data.pages[0].conversations] },
      ...data.pages.slice(1),
    ],
  };
}

function upsertAndBumpToTop(data, nextConvo, moveToTop = true) {
  if (!nextConvo.conversationId) {
    return data;
  }

  if (!data) {
    return {
      pageParams: [undefined],
      pages: [{ conversations: [nextConvo], nextCursor: null }],
    };
  }

  let pageIdx = -1;
  let convoIdx = -1;
  for (let pi = 0; pi < data.pages.length; pi++) {
    const ci = data.pages[pi].conversations.findIndex(
      (c) => c.conversationId === nextConvo.conversationId,
    );
    if (ci !== -1) {
      pageIdx = pi;
      convoIdx = ci;
      break;
    }
  }

  const now = new Date().toISOString();
  if (pageIdx === -1) {
    const firstPage = data.pages[0] ?? { conversations: [], nextCursor: null };
    return {
      ...data,
      pages: [
        {
          ...firstPage,
          conversations: [
            { ...nextConvo, updatedAt: nextConvo.updatedAt ?? now },
            ...firstPage.conversations,
          ],
        },
        ...data.pages.slice(1),
      ],
    };
  }

  const found = data.pages[pageIdx].conversations[convoIdx];
  const updated = {
    ...found,
    ...nextConvo,
    updatedAt: nextConvo.updatedAt ?? (moveToTop ? now : found.updatedAt),
  };

  if (!moveToTop || (pageIdx === 0 && convoIdx === 0)) {
    return {
      ...data,
      pages: data.pages.map((page, pi) =>
        pi === pageIdx
          ? {
              ...page,
              conversations: page.conversations.map((c, ci) => (ci === convoIdx ? updated : c)),
            }
          : page,
      ),
    };
  }

  const pages = data.pages.map((page, pi) => {
    if (pi === 0 && pageIdx === 0) {
      const conversations = page.conversations.filter((_, ci) => ci !== convoIdx);
      return { ...page, conversations: [updated, ...conversations] };
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

  return { ...data, pages };
}

export class ConversationCacheService {
  constructor(queryClient) {
    this.queryClient = queryClient;
  }

  findAllListQueries(isArchived) {
    const baseKey =
      isArchived === true
        ? QueryKeys.archivedConversations
        : isArchived === false
          ? QueryKeys.allConversations
          : QueryKeys.allConversations;

    const queries = this.queryClient
      .getQueryCache()
      .findAll([baseKey], { exact: false })
      .filter((q) => {
        const key = q.queryKey;
        if (key[0] !== QueryKeys.allConversations && key[0] !== QueryKeys.archivedConversations) {
          return false;
        }
        if (isArchived === true) {
          return key[0] === QueryKeys.archivedConversations;
        }
        if (isArchived === false) {
          return key[0] === QueryKeys.allConversations;
        }
        return true;
      });

    return queries;
  }

  findConversation(conversationId) {
    const singleQueryData = this.queryClient.getQueryData(
      convoQueryKeys.single(conversationId),
    );
    if (singleQueryData) {
      return singleQueryData;
    }

    const allQueries = this.findAllListQueries();
    for (const { queryKey } of allQueries) {
      const data = this.queryClient.getQueryData(queryKey);
      const found = findConversationInData(data, conversationId);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  addConversation(conversation, isArchived = false) {
    const queries = this.findAllListQueries(isArchived);

    for (const { queryKey } of queries) {
      if (!conversationMatchesProjectQuery(queryKey, conversation)) {
        continue;
      }
      this.queryClient.setQueryData(queryKey, (old) =>
        addToInfinitePages(old, conversation),
      );
    }

    if (conversation.conversationId) {
      this.queryClient.setQueryData(convoQueryKeys.single(conversation.conversationId), conversation);
    }
  }

  updateConversation(conversationId, updater, options = {}) {
    const { moveToTop = false, isArchived } = options;
    const queries = this.findAllListQueries(isArchived);

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) {
          return oldData;
        }

        if (!moveToTop) {
          return updateInfiniteConvoPage(oldData, conversationId, updater);
        }

        const found = findConversationInData(oldData, conversationId);
        if (!found) {
          return oldData;
        }

        const updated = updater(found);
        return upsertAndBumpToTop(oldData, updated, true);
      });
    }

    const singleKey = convoQueryKeys.single(conversationId);
    const current = this.queryClient.getQueryData(singleKey);
    if (current) {
      this.queryClient.setQueryData(singleKey, updater(current));
    }
  }

  removeConversation(conversationId, isArchived) {
    const queries = this.findAllListQueries(isArchived);

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData(queryKey, (old) =>
        removeFromInfinitePages(old, conversationId),
      );
    }

    this.queryClient.removeQueries({
      queryKey: convoQueryKeys.single(conversationId),
      exact: true,
    });
  }

  moveConversationBetweenLists(
    conversationId,
    fromArchived,
    toArchived,
    updatedConvo,
  ) {
    this.removeConversation(conversationId, fromArchived);
    this.addConversation(updatedConvo, toArchived);
  }

  updateTags(conversationId, tags) {
    this.updateConversation(conversationId, (c) => ({ ...c, tags }));
  }

  replaceTagInAllConversations(oldTag, newTag) {
    const queries = this.findAllListQueries();

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((c) => {
              if (c.tags?.includes(oldTag)) {
                return {
                  ...c,
                  tags: c.tags.map((t) => (t === oldTag ? newTag : t)),
                };
              }
              return c;
            }),
          })),
        };
      });
    }

    const allSingleQueries = this.queryClient
      .getQueryCache()
      .findAll([QueryKeys.conversation], { exact: false });

    for (const query of allSingleQueries) {
      const key = query.queryKey;
      if (key[0] !== QueryKeys.conversation || typeof key[1] !== 'string') {
        continue;
      }
      const convo = this.queryClient.getQueryData(key);
      if (convo?.tags?.includes(oldTag)) {
        this.queryClient.setQueryData(key, {
          ...convo,
          tags: convo.tags.map((t) => (t === oldTag ? newTag : t)),
        });
      }
    }
  }

  removeTagFromAllConversations(tagToRemove) {
    const updatedIds = [];
    const queries = this.findAllListQueries();

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((c) => {
              if (c.tags?.includes(tagToRemove)) {
                updatedIds.push(c.conversationId ?? '');
                return {
                  ...c,
                  tags: c.tags.filter((t) => t !== tagToRemove),
                };
              }
              return c;
            }),
          })),
        };
      });
    }

    const uniqueIds = [...new Set(updatedIds)];
    for (const id of uniqueIds) {
      const key = convoQueryKeys.single(id);
      const convo = this.queryClient.getQueryData(key);
      if (convo?.tags?.includes(tagToRemove)) {
        this.queryClient.setQueryData(key, {
          ...convo,
          tags: convo.tags.filter((t) => t !== tagToRemove),
        });
      }
    }

    return uniqueIds;
  }

  async optimisticUpdate(conversationId, updateFn, options = {}) {
    const previousData = new Map();

    const { isArchived } = options;

    await this.queryClient.cancelQueries({
      queryKey: convoQueryKeys.allConversations(),
      exact: false,
    });
    await this.queryClient.cancelQueries({
      queryKey: convoQueryKeys.allArchived(),
      exact: false,
    });

    const queries = this.findAllListQueries(isArchived);
    for (const { queryKey } of queries) {
      previousData.set(
        queryKey,
        this.queryClient.getQueryData(queryKey),
      );
    }

    const singleKey = convoQueryKeys.single(conversationId);
    const singleData = this.queryClient.getQueryData(singleKey);
    if (singleData) {
      previousData.set(singleKey, singleData);
    }

    const data = await updateFn(this);

    const rollback = () => {
      previousData.forEach((prevData, key) => {
        this.queryClient.setQueryData(key, prevData);
      });
    };

    return { previousData, rollback, data };
  }

  invalidateLists(options = {}) {
    const { isArchived, refetchFirstPageOnly = true, includeProjects = true } = options;

    const invalidateOptions = refetchFirstPageOnly
      ? { refetchPage: (_, index) => index === 0 }
      : undefined;

    if (isArchived === true || isArchived === undefined) {
      this.queryClient.invalidateQueries({
        queryKey: convoQueryKeys.allArchived(),
        ...invalidateOptions,
      });
    }

    if (isArchived === false || isArchived === undefined) {
      this.queryClient.invalidateQueries({
        queryKey: convoQueryKeys.allLists(),
        ...invalidateOptions,
      });
    }

    if (includeProjects) {
      this.queryClient.invalidateQueries([QueryKeys.projectConversations]);
      this.queryClient.invalidateQueries([QueryKeys.projects]);
    }
  }

  invalidateProject(projectId) {
    if (projectId) {
      this.queryClient.invalidateQueries([QueryKeys.project, projectId]);
    }
  }

  invalidateTags() {
    this.queryClient.invalidateQueries(convoQueryKeys.tags());
  }

  getTags() {
    return this.queryClient.getQueryData(convoQueryKeys.tags());
  }

  async fetchConversation(conversationId) {
    return this.queryClient.fetchQuery({
      queryKey: convoQueryKeys.single(conversationId),
      queryFn: () => dataService.getConversationById(conversationId),
    });
  }

  getSingleConversation(conversationId) {
    return this.queryClient.getQueryData(convoQueryKeys.single(conversationId));
  }

  setSingleConversation(conversationId, updater) {
    if (typeof updater === 'function') {
      this.queryClient.setQueryData(convoQueryKeys.single(conversationId), updater);
    } else {
      this.queryClient.setQueryData(convoQueryKeys.single(conversationId), updater);
    }
  }

  removeSingleConversation(conversationId) {
    this.queryClient.removeQueries({ queryKey: convoQueryKeys.single(conversationId) });
  }
}

export function useConversationCacheService(queryClient) {
  return new ConversationCacheService(queryClient);
}
