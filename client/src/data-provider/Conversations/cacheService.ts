import { QueryClient, InfiniteData } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type {
  ConversationListParams,
  ConversationListResponse,
  ConversationData,
} from 'librechat-data-provider';
import type { TConversation, TConversationTag } from 'librechat-data-provider';

export type ConversationListQueryKey = [
  typeof QueryKeys.allConversations | typeof QueryKeys.archivedConversations,
  ConversationListParams,
];

export type ConversationSingleQueryKey = [typeof QueryKeys.conversation, string];

export type ConversationQueryKey = ConversationListQueryKey | ConversationSingleQueryKey;

export const convoQueryKeys = {
  list: (params: ConversationListParams = {}): ConversationListQueryKey => [
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

  single: (conversationId: string): ConversationSingleQueryKey => [
    QueryKeys.conversation,
    conversationId,
  ],

  allLists: (): [typeof QueryKeys.allConversations] => [QueryKeys.allConversations],

  allArchived: (): [typeof QueryKeys.archivedConversations] => [QueryKeys.archivedConversations],

  allConversations: (): [typeof QueryKeys.allConversations | typeof QueryKeys.archivedConversations] => [
    QueryKeys.allConversations,
  ],

  tags: (): [typeof QueryKeys.conversationTags] => [QueryKeys.conversationTags],
} as const;

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

export function findConversationInData(
  data: ConversationData | undefined,
  conversationId: string,
): TConversation | undefined {
  if (!data) {
    return undefined;
  }
  for (const page of data.pages) {
    const found = page.conversations.find((c) => c.conversationId === conversationId);
    if (found) {
      return found as TConversation;
    }
  }
  return undefined;
}

export function flattenConversations(data: ConversationData | undefined): TConversation[] {
  if (!data?.pages) {
    return [];
  }
  return data.pages.flatMap((page) => (page.conversations as TConversation[]) ?? []);
}

export function hasNextPage(data: ConversationData | undefined): boolean {
  if (!data?.pages || data.pages.length === 0) {
    return false;
  }
  const lastPage = data.pages[data.pages.length - 1];
  return lastPage?.nextCursor !== null && lastPage?.nextCursor !== undefined;
}

function updateInfiniteConvoPage(
  data: ConversationData | undefined,
  conversationId: string,
  updater: (c: TConversation) => TConversation,
): ConversationData | undefined {
  if (!data) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      conversations: page.conversations.map((c) =>
        c.conversationId === conversationId ? updater(c as TConversation) : c,
      ),
    })),
  };
}

function removeFromInfinitePages(
  data: ConversationData | undefined,
  conversationId: string,
): ConversationData | undefined {
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

function addToInfinitePages(
  data: ConversationData | undefined,
  newConversation: TConversation,
): ConversationData {
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

function upsertAndBumpToTop(
  data: ConversationData | undefined,
  nextConvo: TConversation,
  moveToTop = true,
): ConversationData | undefined {
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

  const found = data.pages[pageIdx].conversations[convoIdx] as TConversation;
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

export type OptimisticUpdateContext<TData = unknown> = {
  previousData: Map<unknown[], unknown>;
  rollback: () => void;
  data?: TData;
};

export class ConversationCacheService {
  constructor(private queryClient: QueryClient) {}

  findAllListQueries(isArchived?: boolean): Array<{ queryKey: ConversationListQueryKey }> {
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
        const key = q.queryKey as ConversationListQueryKey;
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

    return queries as unknown as Array<{ queryKey: ConversationListQueryKey }>;
  }

  findConversation(conversationId: string): TConversation | undefined {
    const singleQueryData = this.queryClient.getQueryData<TConversation>(
      convoQueryKeys.single(conversationId),
    );
    if (singleQueryData) {
      return singleQueryData;
    }

    const allQueries = this.findAllListQueries();
    for (const { queryKey } of allQueries) {
      const data = this.queryClient.getQueryData<ConversationData>(queryKey);
      const found = findConversationInData(data, conversationId);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  addConversation(conversation: TConversation, isArchived = false): void {
    const queries = this.findAllListQueries(isArchived);

    for (const { queryKey } of queries) {
      if (!conversationMatchesProjectQuery(queryKey, conversation)) {
        continue;
      }
      this.queryClient.setQueryData<ConversationData>(queryKey, (old) =>
        addToInfinitePages(old, conversation),
      );
    }

    if (conversation.conversationId) {
      this.queryClient.setQueryData(convoQueryKeys.single(conversation.conversationId), conversation);
    }
  }

  updateConversation(
    conversationId: string,
    updater: (c: TConversation) => TConversation,
    options: { moveToTop?: boolean; isArchived?: boolean } = {},
  ): void {
    const { moveToTop = false, isArchived } = options;
    const queries = this.findAllListQueries(isArchived);

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData<ConversationData>(queryKey, (oldData) => {
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
    const current = this.queryClient.getQueryData<TConversation>(singleKey);
    if (current) {
      this.queryClient.setQueryData(singleKey, updater(current));
    }
  }

  removeConversation(conversationId: string, isArchived?: boolean): void {
    const queries = this.findAllListQueries(isArchived);

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData<ConversationData>(queryKey, (old) =>
        removeFromInfinitePages(old, conversationId),
      );
    }

    this.queryClient.removeQueries({
      queryKey: convoQueryKeys.single(conversationId),
      exact: true,
    });
  }

  moveConversationBetweenLists(
    conversationId: string,
    fromArchived: boolean,
    toArchived: boolean,
    updatedConvo: TConversation,
  ): void {
    this.removeConversation(conversationId, fromArchived);
    this.addConversation(updatedConvo, toArchived);
  }

  updateTags(conversationId: string, tags: string[]): void {
    this.updateConversation(conversationId, (c) => ({ ...c, tags }) as TConversation);
  }

  replaceTagInAllConversations(oldTag: string, newTag: string): void {
    const queries = this.findAllListQueries();

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData<ConversationData>(queryKey, (oldData) => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((c) => {
              const convo = c as TConversation;
              if (convo.tags?.includes(oldTag)) {
                return {
                  ...convo,
                  tags: convo.tags.map((t) => (t === oldTag ? newTag : t)),
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
      const key = query.queryKey as ConversationSingleQueryKey;
      if (key[0] !== QueryKeys.conversation || typeof key[1] !== 'string') {
        continue;
      }
      const convo = this.queryClient.getQueryData<TConversation>(key);
      if (convo?.tags?.includes(oldTag)) {
        this.queryClient.setQueryData(key, {
          ...convo,
          tags: convo.tags.map((t) => (t === oldTag ? newTag : t)),
        });
      }
    }
  }

  removeTagFromAllConversations(tagToRemove: string): string[] {
    const updatedIds: string[] = [];
    const queries = this.findAllListQueries();

    for (const { queryKey } of queries) {
      this.queryClient.setQueryData<ConversationData>(queryKey, (oldData) => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((c) => {
              const convo = c as TConversation;
              if (convo.tags?.includes(tagToRemove)) {
                updatedIds.push(convo.conversationId ?? '');
                return {
                  ...convo,
                  tags: convo.tags.filter((t) => t !== tagToRemove),
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
      const convo = this.queryClient.getQueryData<TConversation>(key);
      if (convo?.tags?.includes(tagToRemove)) {
        this.queryClient.setQueryData(key, {
          ...convo,
          tags: convo.tags.filter((t) => t !== tagToRemove),
        });
      }
    }

    return uniqueIds;
  }

  async optimisticUpdate<TResult = unknown>(
    conversationId: string,
    updateFn: (cache: ConversationCacheService) => TResult | Promise<TResult>,
    options: { isArchived?: boolean } = {},
  ): Promise<OptimisticUpdateContext<TResult>> {
    const previousData = new Map<unknown[], unknown>();

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
        this.queryClient.getQueryData<ConversationData>(queryKey),
      );
    }

    const singleKey = convoQueryKeys.single(conversationId);
    const singleData = this.queryClient.getQueryData<TConversation>(singleKey);
    if (singleData) {
      previousData.set(singleKey, singleData);
    }

    const data = await updateFn(this);

    const rollback = () => {
      previousData.forEach((prevData, key) => {
        this.queryClient.setQueryData(key as unknown[], prevData);
      });
    };

    return { previousData, rollback, data };
  }

  invalidateLists(
    options: { isArchived?: boolean; refetchFirstPageOnly?: boolean; includeProjects?: boolean } = {},
  ): void {
    const { isArchived, refetchFirstPageOnly = true, includeProjects = true } = options;

    const invalidateOptions = refetchFirstPageOnly
      ? { refetchPage: (_: unknown, index: number) => index === 0 }
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

  invalidateProject(projectId?: string | null): void {
    if (projectId) {
      this.queryClient.invalidateQueries([QueryKeys.project, projectId]);
    }
  }

  invalidateTags(): void {
    this.queryClient.invalidateQueries(convoQueryKeys.tags());
  }

  getTags(): TConversationTag[] | undefined {
    return this.queryClient.getQueryData<TConversationTag[]>(convoQueryKeys.tags());
  }

  async fetchConversation(conversationId: string): Promise<TConversation> {
    return this.queryClient.fetchQuery({
      queryKey: convoQueryKeys.single(conversationId),
      queryFn: () => dataService.getConversationById(conversationId),
    });
  }

  findConversationInListCache(conversationId: string): TConversation | undefined {
    const listData = this.queryClient.getQueriesData<ConversationData>({
      queryKey: [QueryKeys.allConversations],
      exact: false,
    });
    for (const [, data] of listData) {
      if (!data) continue;
      const found = (data as ConversationData).conversations?.find(
        (c) => c.conversationId === conversationId,
      );
      if (found) {
        return found;
      }
    }
    // Also check infinite list queries
    const foundInInfinite = this.findConversation(conversationId);
    if (foundInInfinite) {
      return foundInInfinite;
    }
    return undefined;
  }

  getSingleConversation(conversationId: string): TConversation | undefined {
    return this.queryClient.getQueryData<TConversation>(convoQueryKeys.single(conversationId));
  }

  setSingleConversation(
    conversationId: string,
    updater: TConversation | ((prev: TConversation | undefined) => TConversation | undefined),
  ): void {
    if (typeof updater === 'function') {
      this.queryClient.setQueryData<TConversation>(
        convoQueryKeys.single(conversationId),
        updater as (prev: TConversation | undefined) => TConversation | undefined,
      );
    } else {
      this.queryClient.setQueryData<TConversation>(convoQueryKeys.single(conversationId), updater);
    }
  }

  removeSingleConversation(conversationId: string): void {
    this.queryClient.removeQueries({ queryKey: convoQueryKeys.single(conversationId) });
  }
}

export function useConversationCacheService(
  queryClient: QueryClient,
): ConversationCacheService {
  return new ConversationCacheService(queryClient);
}
