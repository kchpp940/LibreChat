import { Link } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalize, useNavigateToConvo } from '~/hooks';
import { findConversationInInfinite } from '~/utils';
import store from '~/store';
export default function SearchButtons({ message }) {
    const localize = useLocalize();
    const queryClient = useQueryClient();
    const search = useRecoilValue(store.search);
    const { navigateToConvo } = useNavigateToConvo();
    const conversationId = message.conversationId ?? '';
    const clickHandler = async (event) => {
        event.preventDefault();
        if (!conversationId) {
            return;
        }
        let title = message.title ?? '';
        let cachedConvo = queryClient.getQueryData([
            QueryKeys.conversation,
            conversationId,
        ]);
        const convos = queryClient.getQueryData([
            QueryKeys.allConversations,
            { search: search.debouncedQuery },
        ]);
        if (!cachedConvo && convos) {
            cachedConvo = findConversationInInfinite(convos, conversationId);
        }
        if (!title) {
            title = cachedConvo?.title ?? '';
        }
        document.title = title;
        navigateToConvo(cachedConvo ??
            {
                conversationId,
                title,
            });
    };
    if (!conversationId) {
        return null;
    }
    return (<div className="visible mt-0 flex items-center justify-center gap-1 self-end text-text-secondary lg:justify-start">
      <button type="button" className="ml-0 flex cursor-pointer items-center gap-1.5 rounded-md p-1 text-xs hover:text-text-primary hover:underline" onClick={clickHandler} title={localize('com_ui_go_to_conversation')}>
        <Link className="icon-sm" aria-hidden="true"/>
        {message.title}
      </button>
    </div>);
}
