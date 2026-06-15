import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { MessagesSquare } from 'lucide-react';
import { useUserKeyQuery } from 'librechat-data-provider/react-query';
import { getEndpointField } from 'librechat-data-provider';
import ConversationsSection from '~/components/UnifiedSidebar/ConversationsSection';
import { useGetEndpointsQuery } from '~/data-provider';
import useSideNavLinks from '~/hooks/Nav/useSideNavLinks';
import { useInterfaceFlags } from '~/Providers/CapabilitiesContext';
import store from '~/store';
export default function useUnifiedSidebarLinks() {
    const conversation = useRecoilValue(store.conversationByIndex(0));
    const endpoint = conversation?.endpoint;
    const { data: endpointsConfig = {} } = useGetEndpointsQuery();
    const interfaceConfig = useInterfaceFlags();
    const endpointType = useMemo(() => getEndpointField(endpointsConfig, endpoint, 'type'), [endpoint, endpointsConfig]);
    const userProvidesKey = useMemo(() => !!(endpointsConfig?.[endpoint ?? '']?.userProvide ?? false), [endpointsConfig, endpoint]);
    const { data: keyExpiry = { expiresAt: undefined } } = useUserKeyQuery(endpoint ?? '');
    const keyProvided = useMemo(() => (userProvidesKey ? !!(keyExpiry.expiresAt ?? '') : true), [keyExpiry.expiresAt, userProvidesKey]);
    const sideNavLinks = useSideNavLinks({
        keyProvided,
        endpoint,
        endpointType,
        endpointsConfig,
        includeHidePanel: false,
    });
    const links = useMemo(() => {
        const conversationLink = {
            title: 'com_ui_chat_history',
            label: '',
            icon: MessagesSquare,
            id: 'conversations',
            Component: ConversationsSection,
        };
        return [conversationLink, ...sideNavLinks];
    }, [sideNavLinks]);
    return links;
}
