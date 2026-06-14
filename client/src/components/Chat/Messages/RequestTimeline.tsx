import React, { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import {
  TimelinePhase,
  TimelineStatus,
  mapTimelineError,
} from 'librechat-data-provider';
import type { TimelineEvent } from 'librechat-data-provider';
import store from '~/store';
import { cn } from '~/utils';

const phaseLabels: Record<TimelinePhase, string> = {
  [TimelinePhase.UPLOAD]: '文件上传',
  [TimelinePhase.INDEXING]: '知识库索引',
  [TimelinePhase.RETRIEVAL]: '知识检索',
  [TimelinePhase.TOOL_CALL]: '工具调用',
  [TimelinePhase.GENERATION]: '模型生成',
  [TimelinePhase.COMPLETE]: '请求完成',
  [TimelinePhase.FAILED]: '请求失败',
};

const phaseOrder: TimelinePhase[] = [
  TimelinePhase.UPLOAD,
  TimelinePhase.INDEXING,
  TimelinePhase.RETRIEVAL,
  TimelinePhase.TOOL_CALL,
  TimelinePhase.GENERATION,
  TimelinePhase.COMPLETE,
];

function getStatusIcon(status: TimelineStatus) {
  switch (status) {
    case TimelineStatus.IN_PROGRESS:
      return (
        <div className="flex h-4 w-4 items-center justify-center">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      );
    case TimelineStatus.COMPLETED:
      return (
        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case TimelineStatus.FAILED:
      return (
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case TimelineStatus.SKIPPED:
      return (
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      );
    default:
      return <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700" />;
  }
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 1000) {
    return '<1s';
  }
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`;
  }
  const seconds = Math.round((ms % 60000) / 1000);
  const minutes = Math.floor(ms / 60000);
  return `${minutes}m${seconds}s`;
}

type TimelinePhaseSummary = {
  phase: TimelinePhase;
  status: TimelineStatus;
  message: string;
  durationMs?: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
};

function aggregateTimelineEvents(events: TimelineEvent[]): TimelinePhaseSummary[] {
  const phaseMap = new Map<TimelinePhase, TimelinePhaseSummary>();

  for (const event of events) {
    const existing = phaseMap.get(event.phase);

    if (event.phase === TimelinePhase.RETRIEVAL) {
      if (!existing) {
        phaseMap.set(event.phase, {
          phase: event.phase,
          status: event.status,
          message: event.message,
          durationMs: event.durationMs,
          errorMessage: event.status === TimelineStatus.FAILED && event.details?.failedCount == null
            ? event.errorMessage
            : undefined,
          details: event.details,
        });
      } else {
        const mergedDetails = { ...existing.details, ...event.details };

        if (event.status === TimelineStatus.COMPLETED) {
          const hasPartialFailure = typeof mergedDetails.failedCount === 'number' && mergedDetails.failedCount > 0;
          phaseMap.set(event.phase, {
            phase: event.phase,
            status: TimelineStatus.COMPLETED,
            message: event.message,
            durationMs: event.durationMs ?? existing.durationMs,
            errorMessage: hasPartialFailure ? undefined : existing.errorMessage,
            details: hasPartialFailure
              ? { ...mergedDetails, partialFailure: true }
              : mergedDetails,
          });
        } else if (event.status === TimelineStatus.FAILED && existing.status !== TimelineStatus.COMPLETED) {
          phaseMap.set(event.phase, {
            phase: event.phase,
            status: TimelineStatus.FAILED,
            message: event.message,
            durationMs: event.durationMs ?? existing.durationMs,
            errorMessage: event.errorMessage ?? existing.errorMessage,
            details: mergedDetails,
          });
        } else if (event.status === TimelineStatus.FAILED && existing.status === TimelineStatus.COMPLETED) {
          const hasPartialFailure = typeof mergedDetails.failedCount === 'number' && mergedDetails.failedCount > 0;
          phaseMap.set(event.phase, {
            ...existing,
            details: hasPartialFailure
              ? { ...mergedDetails, partialFailure: true }
              : mergedDetails,
            errorMessage: hasPartialFailure ? undefined : (event.errorMessage ?? existing.errorMessage),
          });
        }
      }
    } else if (!existing || event.status === TimelineStatus.COMPLETED || event.status === TimelineStatus.FAILED) {
      phaseMap.set(event.phase, {
        phase: event.phase,
        status: event.status,
        message: event.message,
        durationMs: event.durationMs ?? existing?.durationMs,
        errorMessage: event.errorMessage ?? existing?.errorMessage,
        details: event.details ?? existing?.details,
      });
    }
  }

  const hasFailed = events.some((e) => e.phase === TimelinePhase.FAILED);
  const hasComplete = events.some((e) => e.phase === TimelinePhase.COMPLETE);

  const result: TimelinePhaseSummary[] = [];
  for (const phase of phaseOrder) {
    const summary = phaseMap.get(phase);
    if (summary) {
      result.push(summary);
    }
  }

  if (hasFailed) {
    const failedEvent = events.find((e) => e.phase === TimelinePhase.FAILED);
    if (failedEvent) {
      result.push({
        phase: TimelinePhase.FAILED,
        status: TimelineStatus.FAILED,
        message: failedEvent.message,
        errorMessage: failedEvent.errorMessage,
      });
    }
  } else if (hasComplete) {
    const completeEvent = events.find((e) => e.phase === TimelinePhase.COMPLETE);
    if (completeEvent) {
      result.push({
        phase: TimelinePhase.COMPLETE,
        status: TimelineStatus.COMPLETED,
        message: completeEvent.message,
        durationMs: completeEvent.durationMs,
      });
    }
  }

  return result;
}

type RequestTimelineProps = {
  runIndex?: number;
  className?: string;
};

export default function RequestTimeline({ runIndex = 0, className }: RequestTimelineProps) {
  const timelineEvents = useRecoilValue(store.timelineEventsFamily(runIndex));

  const phases = useMemo(() => aggregateTimelineEvents(timelineEvents), [timelineEvents]);

  if (phases.length === 0) {
    return null;
  }

  const totalDuration = useMemo(() => {
    const completePhase = phases.find((p) => p.phase === TimelinePhase.COMPLETE);
    if (completePhase?.durationMs) {
      return completePhase.durationMs;
    }
    const failedPhase = phases.find((p) => p.phase === TimelinePhase.FAILED);
    if (failedPhase?.details && typeof failedPhase.details === 'object' && 'totalDurationMs' in failedPhase.details) {
      return failedPhase.details.totalDurationMs as number;
    }
    return undefined;
  }, [phases]);

  return (
    <div className={cn('rounded-lg border border-border-light bg-surface-primary p-3', className)}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">请求执行时间线</h3>
        {totalDuration && (
          <span className="text-xs text-text-secondary">总耗时: {formatDuration(totalDuration)}</span>
        )}
      </div>
      <div className="space-y-2">
        {phases.map((phase, index) => (
          <div key={phase.phase} className="flex items-start gap-2">
            <div className="flex flex-col items-center">
              <div className="flex h-5 w-5 items-center justify-center">
                {getStatusIcon(phase.status)}
              </div>
              {index < phases.length - 1 && (
                <div
                  className={cn(
                    'w-px flex-1 min-h-[20px]',
                    phase.status === TimelineStatus.COMPLETED
                      ? 'bg-green-200 dark:bg-green-900'
                      : phase.status === TimelineStatus.FAILED
                        ? 'bg-red-200 dark:bg-red-900'
                        : 'bg-gray-200 dark:bg-gray-700',
                  )}
                />
              )}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-sm font-medium',
                    phase.status === TimelineStatus.FAILED
                      ? 'text-red-600 dark:text-red-400'
                      : phase.status === TimelineStatus.COMPLETED
                        ? 'text-green-600 dark:text-green-400'
                        : phase.status === TimelineStatus.SKIPPED
                          ? 'text-gray-400'
                          : 'text-text-primary',
                  )}
                >
                  {phaseLabels[phase.phase] || phase.phase}
                </span>
                {phase.durationMs && (
                  <span className="text-xs text-text-secondary">{formatDuration(phase.durationMs)}</span>
                )}
              </div>
              <p className="text-xs text-text-secondary">{phase.message}</p>
              {phase.errorMessage && phase.phase !== TimelinePhase.RETRIEVAL && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{phase.errorMessage}</p>
              )}
              {phase.phase === TimelinePhase.RETRIEVAL && phase.details && (
                <>
                  {phase.status === TimelineStatus.COMPLETED && phase.details.count === 0 && !phase.details.partialFailure && (
                    <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                      无命中：知识库中未找到相关内容
                    </p>
                  )}
                  {phase.status === TimelineStatus.COMPLETED && typeof phase.details.count === 'number' && phase.details.count > 0 && (
                    <>
                      <p className="mt-1 text-xs text-text-secondary">
                        命中 {String(phase.details.count)} 条相关内容
                      </p>
                      {phase.details.partialFailure && typeof phase.details.failedCount === 'number' && phase.details.failedCount > 0 && (
                        <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                          部分失败：{String(phase.details.failedCount)} 个文件检索失败
                          {Array.isArray(phase.details.failedFileNames) && phase.details.failedFileNames.length > 0 && (
                            <>（{phase.details.failedFileNames.slice(0, 3).join(', ')}
                              {phase.details.failedFileNames.length > 3 && ` 等${phase.details.failedFileNames.length}个`}）
                            </>
                          )}
                        </p>
                      )}
                    </>
                  )}
                  {phase.status === TimelineStatus.FAILED && (
                    <>
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {phase.errorMessage || mapTimelineError('retrieval_failed')}
                      </p>
                      {Array.isArray(phase.details.errorMessages) && phase.details.errorMessages.length > 0 && (
                        <p className="mt-1 text-xs text-text-secondary">
                          错误原因：{phase.details.errorMessages.slice(0, 2).join('；')}
                        </p>
                      )}
                      {Array.isArray(phase.details.failedFileNames) && phase.details.failedFileNames.length > 0 && (
                        <p className="mt-1 text-xs text-text-secondary">
                          失败文件：{phase.details.failedFileNames.slice(0, 3).join(', ')}
                          {phase.details.failedFileNames.length > 3 && ` 等${phase.details.failedFileNames.length}个`}
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              {phase.phase === TimelinePhase.TOOL_CALL && phase.details && 'toolName' in phase.details && (
                <p className="mt-1 text-xs text-text-secondary">
                  工具: {String(phase.details.toolName)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
