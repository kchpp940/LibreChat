import { useEffect, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { Spinner, useToastContext } from '@librechat/client';
import type { SearchHit } from 'librechat-data-provider';
import { SearchHitType } from 'librechat-data-provider';
import MinimalMessagesWrapper from '~/components/Chat/Messages/MinimalMessages';
import { useNavScrolling, useLocalize, useAuthContext } from '~/hooks';
import SearchMessage from '~/components/Chat/Messages/SearchMessage';
import { useMessagesInfiniteQuery } from '~/data-provider';
import { useFileMapContext } from '~/Providers';
import store from '~/store';
import { cn } from '~/utils';

const FILTER_OPTIONS = [
  { type: SearchHitType.TEXT, label: 'com_nav_search_text', icon: 'text' },
  { type: SearchHitType.TOOL_CALL, label: 'com_nav_search_tool_call', icon: 'tool' },
  { type: SearchHitType.TOOL_OUTPUT, label: 'com_nav_search_tool_output', icon: 'output' },
  { type: SearchHitType.ATTACHMENT, label: 'com_nav_search_attachment', icon: 'attachment' },
  { type: SearchHitType.FILE, label: 'com_nav_search_file', icon: 'file' },
  { type: SearchHitType.ARTIFACT, label: 'com_nav_search_artifact', icon: 'artifact' },
  { type: SearchHitType.ERROR, label: 'com_nav_search_error', icon: 'error' },
];

function FilterChip({
  type,
  label,
  isSelected,
  onClick,
}: {
  type: SearchHitType;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-600'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-600',
      )}
    >
      {label}
    </button>
  );
}

export default function Search() {
  const localize = useLocalize();
  const fileMap = useFileMapContext();
  const { showToast } = useToastContext();
  const { isAuthenticated } = useAuthContext();
  const [search, setSearch] = useRecoilState(store.search);
  const searchQuery = search.debouncedQuery;
  const selectedTypes = search.selectedTypes;

  const {
    data: searchMessages,
    isLoading,
    isError,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage: _hasNextPage,
  } = useMessagesInfiniteQuery(
    {
      search: searchQuery || undefined,
      searchTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    },
    {
      enabled: isAuthenticated && !!searchQuery,
      staleTime: 30000,
      cacheTime: 300000,
    },
  );

  const { containerRef } = useNavScrolling({
    nextCursor: searchMessages?.pages[searchMessages.pages.length - 1]?.nextCursor,
    setShowLoading: () => ({}),
    fetchNextPage: fetchNextPage,
    isFetchingNext: isFetchingNextPage,
  });

  const searchHits = useMemo(() => {
    const hits: Record<string, SearchHit[]> = {};
    searchMessages?.pages.forEach((page) => {
      if (page.searchHits) {
        Object.assign(hits, page.searchHits);
      }
    });
    return hits;
  }, [searchMessages?.pages]);

  const messages = useMemo(() => {
    const msgs =
      searchMessages?.pages.flatMap((page) =>
        page.messages.map((message) => {
          if (!message.files || !fileMap) {
            return message;
          }
          return {
            ...message,
            files: message.files.map((file) => fileMap[file.file_id ?? ''] ?? file),
          };
        }),
      ) || [];

    return msgs.length === 0 ? null : msgs;
  }, [fileMap, searchMessages?.pages]);

  useEffect(() => {
    if (isError && searchQuery) {
      showToast({ message: 'An error occurred during search', status: 'error' });
    }
  }, [isError, searchQuery, showToast]);

  const toggleFilter = (type: SearchHitType) => {
    setSearch((prev) => {
      const hasType = prev.selectedTypes.includes(type);
      return {
        ...prev,
        selectedTypes: hasType
          ? prev.selectedTypes.filter((t) => t !== type)
          : [...prev.selectedTypes, type],
      };
    });
  };

  const resultsCount = messages?.length ?? 0;
  const resultsAnnouncement = useMemo(() => {
    if (resultsCount === 0) {
      return localize('com_ui_nothing_found');
    }
    if (resultsCount === 1) {
      return localize('com_ui_result_found', { count: resultsCount });
    }
    return localize('com_ui_results_found', { count: resultsCount });
  }, [resultsCount, localize]);

  const isSearchLoading = search.isTyping || isLoading || isFetchingNextPage;

  if (isSearchLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!searchQuery) {
    return null;
  }

  return (
    <MinimalMessagesWrapper ref={containerRef} className="relative flex h-full pt-4">
      <div className="sr-only" role="alert" aria-atomic="true">
        {resultsAnnouncement}
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        {FILTER_OPTIONS.map((option) => (
          <FilterChip
            key={option.type}
            type={option.type}
            label={localize(option.label)}
            isSelected={selectedTypes.includes(option.type)}
            onClick={() => toggleFilter(option.type)}
          />
        ))}
      </div>

      {(messages && messages.length === 0) || messages == null ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-white p-6 text-lg text-gray-500 dark:border-gray-800/50 dark:bg-gray-800 dark:text-gray-300">
            {localize('com_ui_nothing_found')}
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg) => (
            <SearchMessage
              key={msg.messageId}
              message={msg}
              searchHits={searchHits[msg.messageId]}
            />
          ))}
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Spinner className="text-text-primary" />
            </div>
          )}
        </>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-[5%] bg-gradient-to-t from-gray-50 to-transparent dark:from-gray-800" />
    </MinimalMessagesWrapper>
  );
}
