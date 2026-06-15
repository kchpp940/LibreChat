import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { multiChatOptions } from './options';
export default function ModelSelect({ conversation, setOption, popover = false, showAbove = true, }) {
    const modelsQuery = useGetModelsQuery();
    if (!conversation?.endpoint) {
        return null;
    }
    const { endpoint: _endpoint, endpointType } = conversation;
    const models = modelsQuery.data?.[_endpoint] ?? [];
    const endpoint = endpointType ?? _endpoint;
    const OptionComponent = multiChatOptions[endpoint];
    if (!OptionComponent) {
        return null;
    }
    return (<OptionComponent conversation={conversation} setOption={setOption} models={models} showAbove={showAbove} popover={popover}/>);
}
