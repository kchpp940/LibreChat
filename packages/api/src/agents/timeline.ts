import { GraphEvents, Constants } from '@librechat/agents';
import type { EventHandler } from '@librechat/agents';
import { logger } from '@librechat/data-schemas';
import { ContentTypes, StepTypes, TimelinePhase } from 'librechat-data-provider';
import type { TimelineManager } from '../stream/TimelineManager';

interface TimelineHandlersOptions {
  timelineManager: TimelineManager | null;
}

interface ToolStartData {
  id?: string;
  name?: string;
  tool_call_id?: string;
  type?: string;
}

interface ToolEndData {
  output?: {
    name?: string;
    tool_call_id?: string;
    content?: string | unknown;
    artifact?: unknown;
  };
}

interface MessageDeltaData {
  id?: string;
  content?: Array<{ type: string; text?: string }>;
}

interface RunStepData {
  id?: string;
  type?: string;
  status?: string;
  step_details?: {
    type?: string;
    tool_calls?: Array<{
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }>;
  };
}

export function createTimelineHandlers({
  timelineManager,
}: TimelineHandlersOptions): Record<string, EventHandler> {
  if (!timelineManager) {
    return {};
  }

  let hasFirstToken = false;
  const activeTools = new Set<string>();
  let toolPhaseStarted = false;

  const handleFirstToken = () => {
    if (hasFirstToken) return;
    hasFirstToken = true;
    timelineManager
      .emitEvent(
        TimelinePhase.GENERATION,
        'in_progress',
        '开始生成回复',
      )
      .catch((err) => {
        logger.warn('[Timeline] Failed to emit first token event:', err?.message ?? err);
      });
  };

  const handleToolStart = (data: ToolStartData) => {
    const toolName = data?.name ?? 'unknown';
    const toolId = data?.id ?? data?.tool_call_id ?? '';
    if (!toolId) return;

    if (!toolPhaseStarted) {
      toolPhaseStarted = true;
      timelineManager
        .startPhase(TimelinePhase.TOOL_CALL, '正在调用工具')
        .catch((err) => {
          logger.warn('[Timeline] Failed to start tool_call phase:', err?.message ?? err);
        });
    }

    activeTools.add(toolId);
    timelineManager
      .emitEvent(
        TimelinePhase.TOOL_CALL,
        'in_progress',
        `调用工具: ${toolName}`,
        { toolName, toolId },
      )
      .catch((err) => {
        logger.warn('[Timeline] Failed to emit tool start event:', err?.message ?? err);
      });
  };

  const handleToolEnd = (data: ToolEndData) => {
    const toolName = data?.output?.name ?? 'unknown';
    const toolId = data?.output?.tool_call_id ?? '';

    if (toolId) {
      activeTools.delete(toolId);
    }

    timelineManager
      .emitEvent(
        TimelinePhase.TOOL_CALL,
        'completed',
        `工具调用完成: ${toolName}`,
        { toolName, toolId },
      )
      .catch((err) => {
        logger.warn('[Timeline] Failed to emit tool end event:', err?.message ?? err);
      });

    if (activeTools.size === 0 && toolPhaseStarted) {
      toolPhaseStarted = false;
      timelineManager
        .completePhase(TimelinePhase.TOOL_CALL, '工具调用完成')
        .catch((err) => {
          logger.warn('[Timeline] Failed to complete tool_call phase:', err?.message ?? err);
        });
    }
  };

  const handleRunStep = (data: RunStepData) => {
    const stepType = data?.step_details?.type ?? data?.type;
    if (stepType !== StepTypes.TOOL_CALLS && stepType !== ContentTypes.TOOL_CALL) {
      return;
    }

    const status = data?.status;
    const toolCalls = data?.step_details?.tool_calls;

    if (status === 'in_progress' && toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const toolName = toolCall?.function?.name ?? 'unknown';
        const toolId = toolCall?.id ?? '';
        if (toolId && !activeTools.has(toolId)) {
          handleToolStart({ id: toolId, name: toolName } as ToolStartData);
        }
      }
    } else if (status === 'completed') {
      // Tool end is handled by TOOL_END event
    }
  };

  const handleMessageDelta = (data: MessageDeltaData) => {
    const content = data?.content;
    if (!content || !Array.isArray(content)) return;

    for (const part of content) {
      if (part.type === 'text' && part.text) {
        handleFirstToken();
        break;
      }
    }
  };

  const handleChatModelStream = () => {
    handleFirstToken();
  };

  return {
    [GraphEvents.ON_MESSAGE_DELTA]: {
      handle: (_event: string, data: unknown) => {
        handleMessageDelta(data as MessageDeltaData);
      },
    },
    [GraphEvents.CHAT_MODEL_STREAM]: {
      handle: () => {
        handleChatModelStream();
      },
    },
    [GraphEvents.TOOL_END]: {
      handle: (_event: string, data: unknown) => {
        handleToolEnd(data as ToolEndData);
      },
    },
    [GraphEvents.ON_RUN_STEP]: {
      handle: (_event: string, data: unknown) => {
        handleRunStep(data as RunStepData);
      },
    },
  };
}
