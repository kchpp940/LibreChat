import { useRecoilCallback } from 'recoil';
import store from '~/store';
export default function useGetConversation(index = 0) {
    return useRecoilCallback(({ snapshot }) => () => snapshot
        .getLoadable(store.conversationByKeySelector(index))
        .getValue(), [index]);
}
