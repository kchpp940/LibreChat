import { useRecoilCallback } from 'recoil';
import store from '~/store';
export default function useBuildMessageTree() {
    const getSiblingIdx = useRecoilCallback(({ snapshot }) => async (messageId) => await snapshot.getPromise(store.messagesSiblingIdxFamily(messageId)), []);
    // return an object or an array based on branches and recursive option
    // messageId is used to get siblindIdx from recoil snapshot
    const buildMessageTree = async ({ messageId, message, messages, branches = false, recursive = false, }) => {
        let children = [];
        if (messages?.length != null && messages.length > 0) {
            if (branches) {
                for (const message of messages) {
                    children.push((await buildMessageTree({
                        messageId: message?.messageId,
                        message: message,
                        messages: message?.children || [],
                        branches,
                        recursive,
                    })));
                }
            }
            else {
                let message = messages[0];
                if (messages.length > 1) {
                    const siblingIdx = await getSiblingIdx(messageId);
                    message = messages[messages.length - siblingIdx - 1];
                }
                children = [
                    (await buildMessageTree({
                        messageId: message?.messageId,
                        message: message,
                        messages: message?.children || [],
                        branches,
                        recursive,
                    })),
                ];
            }
        }
        if (recursive && message) {
            return { ...message, children: children };
        }
        else {
            let ret = [];
            if (message) {
                const _message = { ...message };
                delete _message.children;
                ret = [_message];
            }
            for (const child of children) {
                ret = ret.concat(child);
            }
            return ret;
        }
    };
    return buildMessageTree;
}
