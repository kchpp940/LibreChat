import React from 'react';
import { useMessageProcess, useMemoizedChatContext } from '~/hooks';
import MessageRender from './ui/MessageRender';
import MultiMessage from './MultiMessage';
const MessageContainer = React.memo(function MessageContainer({ handleScroll, children, }) {
    return (<div className="text-token-text-primary w-full border-0 bg-transparent dark:border-0 dark:bg-transparent" onWheel={handleScroll} onTouchMove={handleScroll}>
      {children}
    </div>);
});
export default function Message(props) {
    const { conversation, handleScroll, isSubmitting } = useMessageProcess({
        message: props.message,
    });
    const { message, currentEditId, setCurrentEditId } = props;
    const { chatContext, effectiveIsSubmitting } = useMemoizedChatContext(message, isSubmitting);
    if (!message || typeof message !== 'object') {
        return null;
    }
    const { children, messageId = null } = message;
    return (<>
      <MessageContainer handleScroll={handleScroll}>
        <div className="m-auto justify-center p-4 py-2 md:gap-6">
          <MessageRender {...props} isSubmitting={effectiveIsSubmitting} chatContext={chatContext}/>
        </div>
      </MessageContainer>
      <MultiMessage messageId={messageId} conversation={conversation} messagesTree={children ?? []} currentEditId={currentEditId} setCurrentEditId={setCurrentEditId}/>
    </>);
}
