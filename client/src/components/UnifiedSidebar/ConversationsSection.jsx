import { useCallback, useEffect, useState, useMemo, memo, lazy, Suspense, useRef } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { useMediaQuery } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { useLocalize, useHasAccess, useAuthContext, useLocalStorage, useNavScrolling, } from '~/hooks';
import { useConversationsInfiniteQuery, useTitleGeneration } from '~/data-provider';
import { Conversations } from '~/components/Conversations';
import ProjectsSection from '~/components/Conversations/ProjectsSection';
import FavoritesList from '~/components/Nav/Favorites/FavoritesList';
import SearchBar from '~/components/Nav/SearchBar';
import store from '~/store';
const BookmarkNav = lazy(() => import('~/components/Nav/Bookmarks/BookmarkNav'));
const ConversationsSection = memo(() => {
    const localize = useLocalize();
    const isSmallScreen = useMediaQuery('(max-width: 768px)');
    const setSidebarExpanded = useSetRecoilState(store.sidebarExpanded);
    const { isAuthenticated } = useAuthContext();
    useTitleGeneration(isAuthenticated);
    const [isChatsExpanded, setIsChatsExpanded] = useLocalStorage('chatsExpanded', true);
    const [showLoading, setShowLoading] = useState(false);
    const [tags, setTags] = useState([]);
    const hasAccessToBookmarks = useHasAccess({
        permissionType: PermissionTypes.BOOKMARKS,
        permission: Permissions.USE,
    });
    const search = useRecoilValue(store.search);
    const { conversations, hasNext, fetchNextPage, isFetchingNextPage, isLoading, isFetching } = useConversationsInfiniteQuery({
        tags: tags.length === 0 ? undefined : tags,
        search: search.debouncedQuery || undefined,
    }, {
        enabled: isAuthenticated,
        staleTime: 30000,
        cacheTime: 300000,
    });
    const conversationsRef = useRef(null);
    const { moveToTop } = useNavScrolling({
        setShowLoading,
        fetchNextPage: async (options) => {
            if (hasNext) {
                return fetchNextPage(options);
            }
            return Promise.resolve({});
        },
        isFetchingNext: isFetchingNextPage,
    });
    const toggleNav = useCallback(() => {
        if (isSmallScreen) {
            setSidebarExpanded(false);
        }
    }, [isSmallScreen, setSidebarExpanded]);
    const loadMoreConversations = useCallback(() => {
        if (isFetchingNextPage || !hasNext) {
            return;
        }
        fetchNextPage();
    }, [isFetchingNextPage, hasNext, fetchNextPage]);
    const [isSearchLoading, setIsSearchLoading] = useState(!!search.query && (search.isTyping || isLoading || isFetching));
    useEffect(() => {
        if (search.isTyping) {
            setIsSearchLoading(true);
        }
        else if (!isLoading && !isFetching) {
            setIsSearchLoading(false);
        }
        else if (!!search.query && (isLoading || isFetching)) {
            setIsSearchLoading(true);
        }
    }, [search.query, search.isTyping, isLoading, isFetching]);
    return (<div className="flex h-full min-h-0 flex-col overflow-hidden pb-3 pt-2" role="region" aria-label={localize('com_ui_chat_history')}>
      <div className="flex items-center gap-0.5 px-3">
        {hasAccessToBookmarks && (<Suspense fallback={null}>
            <BookmarkNav tags={tags} setTags={setTags}/>
          </Suspense>)}
        {search.enabled && <SearchBar isSmallScreen={isSmallScreen}/>}
      </div>
      {!search.query && (<div className="px-3">
          <FavoritesList isSmallScreen={isSmallScreen} toggleNav={toggleNav}/>
        </div>)}
      {!search.query && <ProjectsSection toggleNav={toggleNav} isAuthenticated={isAuthenticated}/>}
      <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
        <Conversations conversations={conversations} moveToTop={moveToTop} toggleNav={toggleNav} containerRef={conversationsRef} loadMoreConversations={loadMoreConversations} isLoading={isFetchingNextPage || showLoading || isLoading} isSearchLoading={isSearchLoading} isChatsExpanded={isChatsExpanded} setIsChatsExpanded={setIsChatsExpanded} showFavorites={false}/>
      </div>
    </div>);
});
ConversationsSection.displayName = 'ConversationsSection';
export default ConversationsSection;
