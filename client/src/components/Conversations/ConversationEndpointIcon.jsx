import { memo } from 'react';
import { useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import EndpointIcon from '~/components/Endpoints/EndpointIcon';
import { areConversationIconFieldsEqual } from './utils';
import { useGetEndpointsQuery } from '~/data-provider';
const emptyEndpointsConfig = {};
function ConversationEndpointIcon({ conversation, className, context = 'menu-item', size = 20, }) {
    const { data: endpointsConfig = emptyEndpointsConfig } = useGetEndpointsQuery();
    const agentsMap = useAgentsMapContext();
    const assistantMap = useAssistantsMapContext();
    return (<EndpointIcon conversation={conversation} endpointsConfig={endpointsConfig} assistantMap={assistantMap} agentsMap={agentsMap} className={className} size={size} context={context}/>);
}
export default memo(ConversationEndpointIcon, (prevProps, nextProps) => {
    return (prevProps.className === nextProps.className &&
        prevProps.context === nextProps.context &&
        prevProps.size === nextProps.size &&
        areConversationIconFieldsEqual(prevProps.conversation, nextProps.conversation));
});
