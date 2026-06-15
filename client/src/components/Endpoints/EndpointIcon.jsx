import { getEndpointField, isAssistantsEndpoint, isAgentsEndpoint } from 'librechat-data-provider';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import MinimalIcon from '~/components/Endpoints/MinimalIcon';
import { getAgentAvatarUrl, getIconEndpoint } from '~/utils';
import { isImageURL } from '~/utils/icons';
const emptyEndpointsConfig = {};
export default function EndpointIcon({ conversation, endpointsConfig = emptyEndpointsConfig, className = 'mr-0', assistantMap, agentsMap, context, size = 20, }) {
    const convoIconURL = conversation?.iconURL ?? '';
    const originalEndpoint = conversation?.endpoint;
    let endpoint = originalEndpoint;
    endpoint = getIconEndpoint({ endpointsConfig, iconURL: convoIconURL, endpoint });
    const endpointType = getEndpointField(endpointsConfig, endpoint, 'type');
    const endpointIconURL = getEndpointField(endpointsConfig, endpoint, 'iconURL');
    const agent = isAgentsEndpoint(endpoint) ? agentsMap?.[conversation?.agent_id ?? ''] : null;
    const assistant = isAssistantsEndpoint(endpoint)
        ? assistantMap?.[endpoint]?.[conversation?.assistant_id ?? '']
        : null;
    const agentAvatar = getAgentAvatarUrl(agent) ?? '';
    const agentName = agent?.name ?? '';
    const assistantAvatar = (assistant && assistant.metadata?.avatar) || '';
    const assistantName = assistant && (assistant.name ?? '');
    const entityAvatar = agentAvatar || assistantAvatar;
    const entityName = agentName || assistantName || '';
    const hasCustomIcon = isImageURL(convoIconURL) || (convoIconURL !== '' && convoIconURL !== originalEndpoint);
    const iconURL = hasCustomIcon ? convoIconURL : entityAvatar || convoIconURL;
    if (isImageURL(iconURL)) {
        return (<ConvoIconURL iconURL={iconURL} modelLabel={entityName || conversation?.chatGptLabel || conversation?.modelLabel || ''} context={context} endpointIconURL={endpointIconURL} assistantAvatar={assistantAvatar} assistantName={assistantName ?? ''} agentAvatar={agentAvatar} agentName={agentName}/>);
    }
    else {
        return (<MinimalIcon iconURL={endpointIconURL} endpoint={endpoint} endpointType={endpointType} model={conversation?.model} error={false} className={className} size={size} isCreatedByUser={false} chatGptLabel={undefined} modelLabel={undefined}/>);
    }
}
