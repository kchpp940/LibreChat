import { useState, useRef, useMemo, useEffect, useCallback, memo } from 'react';
import { useRecoilValue } from 'recoil';
import { ChevronDown, Users } from 'lucide-react';
import { Constants, ContentTypes, ToolCallTypes } from 'librechat-data-provider';
import type { Agents, FunctionToolCall, TAttachment } from 'librechat-data-provider';
import type { ToolCallBlock, ToolCallGroupExpansionState } from '~/common';
export type { ToolCallGroupExpansionState } from '~/common';
import { useLocalize, useExpandCollapse, scheduleMessageContentLayoutReconcile } from '~/hooks';
import { cn, getToolDisplayLabel } from '~/utils';
import { StackedToolIcons } from '~/components/Chat/Messages/Content/ToolOutput';
import { useMCPIconMap } from '~/hooks/MCP';
import { AttachmentGroup } from '~/components/Chat/Messages/Content/Parts';
import { BlockRenderer } from './BlockRenderer';
import store from '~/store';
import { isBashProgrammaticToolCall } from '~/components/Chat/Messages/Content/routing';

interface ToolMeta {
  name: string;
  iconName: string;
  hasOutput: boolean;
}

function getToolMetaFromBlock(block: ToolCallBlock): ToolMeta | null {
  const toolName = block.toolName;
  const hasOutput = Boolean(block.output && block.output.length > 0) || block.progress === 1;

  if (block.isCodeInterpreter) {
    return {
      name: 'code_interpreter',
      iconName: 'code_interpreter',
      hasOutput,
    };
  }

  if (block.isRetrieval) {
    return {
      name: 'file_search',
      iconName: 'file_search',
      hasOutput,
    };
  }

  const isStandard =
    !block.isCodeInterpreter && !block.isRetrieval;
  if (isStandard) {
    const iconName = (block.isProgrammaticBash || block.isBashTool)
      ? 'bash'
      : toolName;
    return { name: toolName, iconName, hasOutput };
  }

  return { name: toolName, iconName: toolName, hasOutput };
}

export type ToolCallGroupRendererProps = {
  groupId: string;
  toolBlocks: ToolCallBlock[];
  groupAttachments: TAttachment[];
  isSubmitting: boolean;
  isLast: boolean;
  messageId: string;
  conversationId?: string | null;
  isCreatedByUser: boolean;
  isLatestMessage?: boolean;
  initialExpansionState?: ToolCallGroupExpansionState;
  onExpansionChange?: (state: ToolCallGroupExpansionState) => void;
};

function ToolCallGroupRendererInner({
  groupId,
  toolBlocks,
  groupAttachments,
  isSubmitting,
  isLast,
  messageId,
  conversationId,
  isCreatedByUser,
  isLatestMessage,
  initialExpansionState,
  onExpansionChange,
}: ToolCallGroupRendererProps) {
  const localize = useLocalize();
  const mcpIconMap = useMCPIconMap();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cancelLayoutReconcileRef = useRef<(() => void) | null>(null);
  const count = toolBlocks.length;

  const toolMetadata = useMemo(() => toolBlocks.map(getToolMetaFromBlock), [toolBlocks]);
  const allCompleted = useMemo(
    () => toolMetadata.every((m) => m?.hasOutput === true),
    [toolMetadata],
  );
  const toolNames = useMemo(() => toolMetadata.map((m) => m?.name ?? ''), [toolMetadata]);
  const iconToolNames = useMemo(() => toolMetadata.map((m) => m?.iconName ?? ''), [toolMetadata]);

  const subagentCount = useMemo(
    () => toolNames.filter((n) => n === Constants.SUBAGENT).length,
    [toolNames],
  );
  const allSubagents = subagentCount > 0 && subagentCount === count;
  const subagentsDone = allSubagents && (allCompleted || !isSubmitting);

  const toolNameSummary = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const rawName of toolNames) {
      if (!rawName) continue;
      const label = getToolDisplayLabel(rawName, localize);
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
    if (labels.length <= 3) {
      return labels.join(', ');
    }
    return `${labels.slice(0, 3).join(', ')}, +${labels.length - 3}`;
  }, [toolNames, localize]);

  const autoExpand = useRecoilValue(store.autoExpandTools);
  const autoCollapse = !autoExpand && count >= 2 && allCompleted;
  const initialState = initialExpansionState?.userOverride === true ? initialExpansionState : null;
  const [isExpanded, setIsExpanded] = useState(
    initialState?.isExpanded ?? (autoExpand || !autoCollapse),
  );
  const [userOverride, setUserOverride] = useState(initialState != null);
  const [shouldRenderBody, setShouldRenderBody] = useState(isExpanded);
  const previousIsExpandedRef = useRef(isExpanded);
  const { style: expandStyle, ref: expandRef } = useExpandCollapse(isExpanded);
  const notifyLayoutChange = useCallback(() => {
    cancelLayoutReconcileRef.current?.();
    cancelLayoutReconcileRef.current = scheduleMessageContentLayoutReconcile(rootRef.current);
  }, []);

  useEffect(() => () => { cancelLayoutReconcileRef.current?.(); }, []);
  useEffect(() => {
    const wasExpanded = previousIsExpandedRef.current;
    previousIsExpandedRef.current = isExpanded;
    if (wasExpanded && !isExpanded) notifyLayoutChange();
  }, [isExpanded, notifyLayoutChange]);

  useEffect(() => {
    if (autoCollapse && !userOverride) setIsExpanded(false);
  }, [autoCollapse, userOverride]);

  const handleToggle = useCallback(() => {
    const nextExpanded = !isExpanded;
    setUserOverride(true);
    if (nextExpanded) setShouldRenderBody(true);
    setIsExpanded(nextExpanded);
    onExpansionChange?.({ isExpanded: nextExpanded, userOverride: true });
  }, [isExpanded, onExpansionChange]);

  const handleToolExpand = useCallback(() => {
    setUserOverride(true);
    setShouldRenderBody(true);
    setIsExpanded(true);
    onExpansionChange?.({ isExpanded: true, userOverride: true });
  }, [onExpansionChange]);

  const handleTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (isExpanded) return;
      setShouldRenderBody(false);
      notifyLayoutChange();
    },
    [isExpanded, notifyLayoutChange],
  );

  const getSubagentLabel = () =>
    subagentsDone
      ? localize('com_ui_ran_n_agents', { 0: String(count) })
      : localize('com_ui_running_n_agents', { 0: String(count) });
  const groupLabel = allSubagents
    ? getSubagentLabel()
    : localize('com_ui_used_n_tools', { 0: String(count) });

  const hasActiveToolCall = useMemo(
    () => isSubmitting && toolMetadata.some((m) => m && !m.hasOutput),
    [toolMetadata, isSubmitting],
  );

  useEffect(() => {
    if (hasActiveToolCall && !userOverride) {
      setShouldRenderBody(true);
      setIsExpanded(true);
    }
  }, [hasActiveToolCall, userOverride]);

  return (
    <div className="mb-2 mt-1" ref={rootRef}>
      <button
        type="button"
        className="inline-flex w-full items-center gap-2 py-1 text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={groupLabel}
      >
        {allSubagents ? (
          <div
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center text-text-secondary',
              !allCompleted && isSubmitting && 'animate-pulse text-primary',
            )}
            aria-hidden="true"
          >
            <Users size={14} />
          </div>
        ) : (
          <StackedToolIcons
            toolNames={iconToolNames}
            mcpIconMap={mcpIconMap}
            maxIcons={4}
            isAnimating={!allCompleted && isSubmitting}
          />
        )}
        <span className="tool-status-text font-medium">{groupLabel}</span>
        {toolNameSummary && !allSubagents && (
          <span className="text-xs font-normal text-text-secondary">— {toolNameSummary}</span>
        )}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-text-secondary transition-transform duration-200 ease-out',
            isExpanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <div style={expandStyle} onTransitionEnd={handleTransitionEnd} aria-hidden={!isExpanded}>
        {shouldRenderBody && (
          <div className="overflow-hidden" ref={expandRef}>
            <div className="py-0.5 pl-4">
              {toolBlocks.map((block, idx) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  messageId={messageId}
                  conversationId={conversationId}
                  isSubmitting={isSubmitting}
                  isLatestMessage={isLatestMessage}
                  isCreatedByUser={isCreatedByUser}
                  isLast={isLast && idx === toolBlocks.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {groupAttachments && groupAttachments.length > 0 && (
        <AttachmentGroup attachments={groupAttachments} />
      )}
    </div>
  );
}

export const ToolCallGroupRenderer = memo(ToolCallGroupRendererInner);
