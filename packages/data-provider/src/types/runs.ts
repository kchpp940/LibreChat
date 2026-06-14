export enum ContentTypes {
  TEXT = 'text',
  THINK = 'think',
  TEXT_DELTA = 'text_delta',
  TOOL_CALL = 'tool_call',
  IMAGE_FILE = 'image_file',
  IMAGE_URL = 'image_url',
  VIDEO_URL = 'video_url',
  INPUT_AUDIO = 'input_audio',
  AGENT_UPDATE = 'agent_update',
  SUMMARY = 'summary',
  ERROR = 'error',
}

export enum StepTypes {
  TOOL_CALLS = 'tool_calls',
  MESSAGE_CREATION = 'message_creation',
}

export enum ToolCallTypes {
  FUNCTION = 'function',
  RETRIEVAL = 'retrieval',
  FILE_SEARCH = 'file_search',
  CODE_INTERPRETER = 'code_interpreter',
  /* Agents Tool Call */
  TOOL_CALL = 'tool_call',
}

/** Event names dispatched by the agent graph and consumed by step handlers. */
export enum StepEvents {
  ON_RUN_STEP = 'on_run_step',
  ON_AGENT_UPDATE = 'on_agent_update',
  ON_MESSAGE_DELTA = 'on_message_delta',
  ON_REASONING_DELTA = 'on_reasoning_delta',
  ON_RUN_STEP_DELTA = 'on_run_step_delta',
  ON_RUN_STEP_COMPLETED = 'on_run_step_completed',
  ON_SUMMARIZE_START = 'on_summarize_start',
  ON_SUMMARIZE_DELTA = 'on_summarize_delta',
  ON_SUMMARIZE_COMPLETE = 'on_summarize_complete',
  ON_SUBAGENT_UPDATE = 'on_subagent_update',
  ON_TIMELINE_EVENT = 'on_timeline_event',
}

/** Execution timeline phase - represents a stage in the request lifecycle. */
export enum TimelinePhase {
  /** File upload to server */
  UPLOAD = 'upload',
  /** File indexing / embedding for RAG */
  INDEXING = 'indexing',
  /** RAG retrieval from knowledge base */
  RETRIEVAL = 'retrieval',
  /** Tool execution */
  TOOL_CALL = 'tool_call',
  /** Model generation */
  GENERATION = 'generation',
  /** Request complete */
  COMPLETE = 'complete',
  /** Request failed */
  FAILED = 'failed',
}

/** Status of a timeline phase */
export enum TimelineStatus {
  /** Phase is pending */
  PENDING = 'pending',
  /** Phase is in progress */
  IN_PROGRESS = 'in_progress',
  /** Phase completed successfully */
  COMPLETED = 'completed',
  /** Phase failed */
  FAILED = 'failed',
  /** Phase was skipped */
  SKIPPED = 'skipped',
}

/** User-visible timeline event */
export interface TimelineEvent {
  /** Unique event ID */
  id: string;
  /** Phase this event belongs to */
  phase: TimelinePhase;
  /** Current status of the phase */
  status: TimelineStatus;
  /** Human-readable message for display */
  message: string;
  /** Optional details (e.g., tool name, file name, retrieval count) */
  details?: Record<string, unknown>;
  /** Error message if status is FAILED - already mapped to user-friendly text */
  errorMessage?: string;
  /** ISO timestamp when the event occurred */
  timestamp: string;
  /** Duration in milliseconds (for completed phases) */
  durationMs?: number;
}

/**
 * Error code to user-friendly message mapping.
 * Only expose non-technical, actionable messages to users.
 */
export const TimelineErrorMessages: Record<string, string> = {
  'upload_failed': '文件上传失败，请检查网络连接后重试',
  'upload_too_large': '文件过大，请压缩后重新上传',
  'upload_unsupported_type': '不支持的文件类型',
  'index_failed': '文件索引失败，请稍后重试',
  'index_timeout': '文件索引超时，请减少文件数量后重试',
  'retrieval_failed': '知识库检索失败',
  'retrieval_no_results': '未找到相关文档',
  'tool_call_failed': '工具调用失败',
  'tool_call_timeout': '工具调用超时',
  'tool_auth_required': '工具需要授权，请先完成认证',
  'generation_failed': '模型生成失败，请重试',
  'generation_rate_limit': '请求过于频繁，请稍后重试',
  'generation_context_exceeded': '上下文长度超限，请精简内容后重试',
  'network_error': '网络连接中断，请检查网络后重试',
  'unknown_error': '请求处理失败，请重试',
};

/** Map an error code or message to a user-friendly timeline error */
export function mapTimelineError(errorCodeOrMessage: string): string {
  if (TimelineErrorMessages[errorCodeOrMessage]) {
    return TimelineErrorMessages[errorCodeOrMessage];
  }
  for (const [code, message] of Object.entries(TimelineErrorMessages)) {
    if (errorCodeOrMessage.includes(code)) {
      return message;
    }
  }
  return TimelineErrorMessages['unknown_error'];
}

/** Lifecycle phase carried on subagent-progress envelopes (mirrors SDK SubagentUpdatePhase). */
export type SubagentUpdatePhase =
  | 'start'
  | 'run_step'
  | 'run_step_delta'
  | 'run_step_completed'
  | 'message_delta'
  | 'reasoning_delta'
  | 'stop'
  | 'error';

/** Single streamed subagent update forwarded by the SDK's SubagentExecutor. */
export interface SubagentUpdateEvent {
  runId: string;
  subagentRunId: string;
  /** Parent-side `tool_call_id` for the `subagent` tool invocation that
   *  triggered this run. Surfaces from the SDK (`3.1.67-dev.2`+) so hosts
   *  can correlate child progress to the parent tool call deterministically. */
  parentToolCallId?: string;
  subagentType: string;
  subagentAgentId: string;
  parentAgentId?: string;
  phase: SubagentUpdatePhase;
  data?: unknown;
  label?: string;
  timestamp: string;
}
