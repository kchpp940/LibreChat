import { v4 } from 'uuid';
import type {
  TimelineEvent,
  TimelinePhase,
  TimelineStatus,
} from 'librechat-data-provider';
import {
  StepEvents,
  mapTimelineError,
} from 'librechat-data-provider';
import type { IJobStore, IEventTransport } from './interfaces/IJobStore';

/**
 * Manages request execution timeline events.
 * Tracks phase start/end times, persists events for resume,
 * and emits events to connected clients.
 */
export class TimelineManager {
  private jobStore: IJobStore;
  private eventTransport: IEventTransport;
  private streamId: string;
  private events: TimelineEvent[] = [];
  private phaseStartTimes = new Map<TimelinePhase, number>();

  constructor(
    streamId: string,
    jobStore: IJobStore,
    eventTransport: IEventTransport,
  ) {
    this.streamId = streamId;
    this.jobStore = jobStore;
    this.eventTransport = eventTransport;
  }

  /**
   * Create and emit a timeline event.
   * @param phase - The execution phase
   * @param status - The phase status
   * @param message - Human-readable message for display
   * @param details - Optional details (tool name, file name, etc.)
   * @param errorCodeOrMessage - Optional error code or raw message (will be mapped to user-friendly text)
   */
  async emitEvent(
    phase: TimelinePhase,
    status: TimelineStatus,
    message: string,
    details?: Record<string, unknown>,
    errorCodeOrMessage?: string,
  ): Promise<TimelineEvent> {
    const now = Date.now();
    const id = v4();

    let durationMs: number | undefined;
    if (status === 'completed' || status === 'failed' || status === 'skipped') {
      const startTime = this.phaseStartTimes.get(phase);
      if (startTime != null) {
        durationMs = now - startTime;
        this.phaseStartTimes.delete(phase);
      }
    } else if (status === 'in_progress') {
      this.phaseStartTimes.set(phase, now);
    }

    const event: TimelineEvent = {
      id,
      phase,
      status,
      message,
      details,
      timestamp: new Date(now).toISOString(),
      durationMs,
      ...(errorCodeOrMessage != null && {
        errorMessage: mapTimelineError(errorCodeOrMessage),
      }),
    };

    this.events.push(event);
    await this.persist();
    this.broadcast(event);

    return event;
  }

  /**
   * Mark a phase as started.
   */
  async startPhase(
    phase: TimelinePhase,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<TimelineEvent> {
    return this.emitEvent(phase, 'in_progress', message, details);
  }

  /**
   * Mark a phase as completed successfully.
   */
  async completePhase(
    phase: TimelinePhase,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<TimelineEvent> {
    return this.emitEvent(phase, 'completed', message, details);
  }

  /**
   * Mark a phase as failed.
   * @param errorCodeOrMessage - Error code or raw message (will be mapped to user-friendly text)
   */
  async failPhase(
    phase: TimelinePhase,
    message: string,
    errorCodeOrMessage: string,
    details?: Record<string, unknown>,
  ): Promise<TimelineEvent> {
    return this.emitEvent(phase, 'failed', message, details, errorCodeOrMessage);
  }

  /**
   * Mark a phase as skipped.
   */
  async skipPhase(
    phase: TimelinePhase,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<TimelineEvent> {
    return this.emitEvent(phase, 'skipped', message, details);
  }

  /**
   * Mark the entire request as complete.
   */
  async markComplete(
    message: string = '请求处理完成',
    details?: Record<string, unknown>,
  ): Promise<TimelineEvent> {
    return this.emitEvent('complete', 'completed', message, details);
  }

  /**
   * Mark the entire request as failed.
   */
  async markFailed(
    errorCodeOrMessage: string,
    message: string = '请求处理失败',
    details?: Record<string, unknown>,
  ): Promise<TimelineEvent> {
    return this.emitEvent('failed', 'failed', message, details, errorCodeOrMessage);
  }

  /**
   * Get all timeline events.
   */
  getEvents(): TimelineEvent[] {
    return [...this.events];
  }

  /**
   * Load existing events from job store (for manager instantiation on existing jobs).
   */
  async loadEvents(): Promise<void> {
    const job = await this.jobStore.getJob(this.streamId);
    if (job?.timelineEvents) {
      try {
        this.events = JSON.parse(job.timelineEvents);
      } catch {
        this.events = [];
      }
    }
  }

  /**
   * Persist events to job store.
   */
  private async persist(): Promise<void> {
    try {
      await this.jobStore.updateJob(this.streamId, {
        timelineEvents: JSON.stringify(this.events),
      });
    } catch (error) {
      console.error('[TimelineManager] Failed to persist timeline events:', error);
    }
  }

  /**
   * Broadcast event to connected clients via SSE.
   */
  private broadcast(event: TimelineEvent): void {
    const sseEvent = {
      event: StepEvents.ON_TIMELINE_EVENT,
      data: event,
    };
    this.eventTransport.emitChunk(this.streamId, sseEvent);
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    this.events = [];
    this.phaseStartTimes.clear();
  }
}
