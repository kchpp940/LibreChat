import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import type { TMessageProps } from '~/common';
import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts, TTourToolCall } from 'librechat-data-provider';
import MinimalHoverButtons from '~/components/Chat/Messages/MinimalHoverButtons';
import MessageContent from '~/components/Chat/Messages/Content/MessageContent';
import SearchContent from '~/components/Chat/Messages/Content/SearchContent';
import SiblingSwitch from '~/components/Chat/Messages/SiblingSwitch';
import SubRow from '~/components/Chat/Messages/SubRow';
import { fontSizeAtom } from '~/store/fontSize';
import { MessageContext } from '~/Providers';
import MultiMessage from './MultiMessage';
import ToolOutputCollapsible from './ToolOutputCollapsible';
import { useAttachments } from '~/hooks';
import Icon from './MessageIcon';
import { cn } from '~/utils';

function extractToolCallsFromContent(content?: TMessageContentParts[]): TTourToolCall[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const results: TTourToolCall[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') {
      continue;
    }
    const p = part as Record<string, unknown>;
    if (p.type === ContentTypes.TOOL_CALL && p.tool_call && typeof p.tool_call === 'object') {
      const tc = p.tool_call as Record<string, unknown>;
      const name =
        typeof tc.name === 'string'
          ? tc.name
          : tc.function && typeof tc.function === 'object' && typeof (tc.function as Record<string, unknown>).name === 'string'
            ? ((tc.function as Record<string, unknown>).name as string)
            : undefined;
      if (name) {
        results.push({
          toolName: name,
          toolCallId: typeof tc.id === 'string' ? tc.id : undefined,
          output: tc.output != null && typeof tc.output === 'string' ? tc.output : undefined,
        });
      }
    }
  }
  return results;
}

export default function Message(props: TMessageProps) {
  const fontSize = useAtomValue(fontSizeAtom);
  const {
    message,
    siblingIdx,
    siblingCount,
    conversation,
    setSiblingIdx,
    currentEditId,
    setCurrentEditId,
  } = props;

  const { attachments, searchResults } = useAttachments({
    messageId: message?.messageId,
    attachments: message?.attachments,
  });

  const toolCalls = useMemo(() => {
    if (!message || message.isCreatedByUser) {
      return [];
    }
    const contentCalls = extractToolCallsFromContent(message.content);
    const attachCalls: TTourToolCall[] = [];
    if (Array.isArray(message.attachments)) {
      for (const att of message.attachments) {
        const a = att as Record<string, unknown>;
        if (typeof a.type === 'string' && a.type) {
          attachCalls.push({
            toolName: a.type,
            toolCallId: typeof a.toolCallId === 'string' ? a.toolCallId : undefined,
          });
        }
      }
    }
    return [...contentCalls, ...attachCalls];
  }, [message]);

  if (!message) {
    return null;
  }

  const {
    text = '',
    children,
    error = false,
    messageId = '',
    unfinished = false,
    isCreatedByUser = true,
  } = message;

  let messageLabel = '';
  if (isCreatedByUser) {
    messageLabel = 'anonymous';
  } else {
    messageLabel = message.sender ?? '';
  }

  return (
    <>
      <div
        id={`share-msg-${messageId}`}
        className="text-token-text-primary w-full border-0 bg-transparent dark:border-0 dark:bg-transparent scroll-mt-4"
      >
        <div className="m-auto justify-center p-4 py-2 md:gap-6">
          <div className="final-completion group mx-auto flex flex-1 gap-3 md:max-w-[47rem] md:px-5 lg:px-1 xl:max-w-[55rem] xl:px-5">
            <div className="relative flex flex-shrink-0 flex-col items-end">
              <div>
                <div className="pt-0.5">
                  <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
                    <Icon message={message} conversation={conversation} />
                  </div>
                </div>
              </div>
            </div>
            <div
              className={cn('relative flex w-11/12 flex-col', isCreatedByUser ? '' : 'agent-turn')}
            >
              <div className={cn('select-none font-semibold', fontSize)}>{messageLabel}</div>
              <div className="flex-col gap-1 md:gap-3">
                <div className="flex min-h-[20px] max-w-full flex-grow flex-col gap-0">
                  <MessageContext.Provider
                    value={{
                      messageId,
                      isExpanded: false,
                      conversationId: conversation?.conversationId,
                      isSubmitting: false,
                      isLatestMessage: false,
                    }}
                  >
                    {message.content ? (
                      <SearchContent
                        message={message}
                        attachments={attachments}
                        searchResults={searchResults}
                      />
                    ) : (
                      <MessageContent
                        edit={false}
                        error={error}
                        isLast={false}
                        ask={() => {}}
                        text={text || ''}
                        message={message}
                        isSubmitting={false}
                        enterEdit={() => ({})}
                        unfinished={unfinished}
                        siblingIdx={siblingIdx ?? 0}
                        isCreatedByUser={isCreatedByUser}
                        setSiblingIdx={setSiblingIdx ?? (() => ({}))}
                      />
                    )}
                  </MessageContext.Provider>
                  {toolCalls.length > 0 && !isCreatedByUser && (
                    <div className="mt-2">
                      <ToolOutputCollapsible toolCalls={toolCalls} />
                    </div>
                  )}
                </div>
              </div>
              <SubRow classes="text-xs">
                <SiblingSwitch
                  siblingIdx={siblingIdx}
                  siblingCount={siblingCount}
                  setSiblingIdx={setSiblingIdx}
                />
                <MinimalHoverButtons message={message} searchResults={searchResults} />
              </SubRow>
            </div>
          </div>
        </div>
      </div>
      <MultiMessage
        key={messageId}
        messageId={messageId}
        messagesTree={children ?? []}
        currentEditId={currentEditId}
        setCurrentEditId={setCurrentEditId}
      />
    </>
  );
}
