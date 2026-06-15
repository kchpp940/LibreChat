import React from 'react';
import { ChatContext } from '~/Providers';
import { useChatHelpers } from '~/hooks';
export const MarketplaceProvider = ({ children }) => {
    const chatHelpers = useChatHelpers(0, 'new');
    return <ChatContext.Provider value={chatHelpers}>{children}</ChatContext.Provider>;
};
