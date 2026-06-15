import { ContentTypes, ToolCallTypes } from 'librechat-data-provider';
const extractTextChunk = (data) => {
    const content = data?.delta?.content;
    if (!Array.isArray(content))
        return '';
    for (const block of content) {
        if (block?.type === 'text' && typeof block.text === 'string') {
            return block.text;
        }
    }
    return '';
};
const extractThinkChunk = (data) => {
    const content = data?.delta?.content;
    if (!Array.isArray(content))
        return '';
    for (const block of content) {
        if (block?.type === 'think' && typeof block.think === 'string') {
            return block.think;
        }
    }
    return '';
};
const stringifyArgs = (args) => typeof args === 'string' ? args : JSON.stringify(args ?? {});
/** Initial empty aggregator state. */
export function initSubagentAggregatorState() {
    return {
        openTextIdx: null,
        openThinkIdx: null,
        toolCallIndexById: {},
    };
}
/**
 * Incrementally fold a single {@link SubagentUpdateEvent} into an existing
 * `contentParts` array, returning a new array + updated cursor state.
 * Pure function — never mutates inputs.
 *
 * Adjacent `message_delta` / `reasoning_delta` events extend the in-flight
 * TEXT / THINK part (tracked via the open*Idx cursors). When a delta
 * type switches, the opposite buffer is closed first so chronological
 * order is preserved — what the user saw is what lands in the array.
 *
 * `run_step` with `tool_calls` closes any open text/think and appends a
 * TOOL_CALL part per unique id. `run_step_completed` updates the matching
 * TOOL_CALL (output + progress). Late-arriving completions without a
 * prior `run_step` synthesize the part. `start` / `stop` / `error` /
 * `run_step_delta` contribute nothing to content.
 */
export function foldSubagentEvent(parts, state, event) {
    if (event.phase === 'message_delta') {
        const chunk = extractTextChunk(event.data);
        if (!chunk)
            return { parts, state };
        /** Reasoning→text transition: close the open THINK so the THINK part
         *  lands BEFORE the TEXT part in chronological order. */
        const afterThinkClose = state.openThinkIdx != null ? { ...state, openThinkIdx: null } : state;
        if (afterThinkClose.openTextIdx != null) {
            const idx = afterThinkClose.openTextIdx;
            const existing = parts[idx];
            const next = parts.slice();
            next[idx] = { type: ContentTypes.TEXT, text: existing.text + chunk };
            return { parts: next, state: afterThinkClose };
        }
        const next = parts.slice();
        const newIdx = next.length;
        next.push({ type: ContentTypes.TEXT, text: chunk });
        return { parts: next, state: { ...afterThinkClose, openTextIdx: newIdx } };
    }
    if (event.phase === 'reasoning_delta') {
        const chunk = extractThinkChunk(event.data);
        if (!chunk)
            return { parts, state };
        const afterTextClose = state.openTextIdx != null ? { ...state, openTextIdx: null } : state;
        if (afterTextClose.openThinkIdx != null) {
            const idx = afterTextClose.openThinkIdx;
            const existing = parts[idx];
            const next = parts.slice();
            next[idx] = { type: ContentTypes.THINK, think: existing.think + chunk };
            return { parts: next, state: afterTextClose };
        }
        const next = parts.slice();
        const newIdx = next.length;
        next.push({ type: ContentTypes.THINK, think: chunk });
        return { parts: next, state: { ...afterTextClose, openThinkIdx: newIdx } };
    }
    if (event.phase === 'run_step') {
        const data = event.data;
        if (data?.stepDetails?.type !== 'tool_calls')
            return { parts, state };
        const toolCalls = data.stepDetails.tool_calls ?? [];
        let next = parts;
        const toolCallIndexById = { ...state.toolCallIndexById };
        for (const tc of toolCalls) {
            if (typeof tc?.id !== 'string' || !tc.id || tc.id in toolCallIndexById)
                continue;
            if (next === parts)
                next = parts.slice();
            toolCallIndexById[tc.id] = next.length;
            next.push({
                type: ContentTypes.TOOL_CALL,
                tool_call: {
                    id: tc.id,
                    name: tc.name ?? '',
                    args: stringifyArgs(tc.args),
                    progress: 0.1,
                    type: tc.type ?? ToolCallTypes.TOOL_CALL,
                },
            });
        }
        if (next === parts)
            return { parts, state: { ...state, toolCallIndexById } };
        /** New tool_call parts bound any open TEXT/THINK to the run before
         *  them — close the buffers. */
        return {
            parts: next,
            state: { openTextIdx: null, openThinkIdx: null, toolCallIndexById },
        };
    }
    if (event.phase === 'run_step_completed') {
        const data = event.data;
        const tc = data?.result?.tool_call;
        if (typeof tc?.id !== 'string' || !tc.id)
            return { parts, state };
        const existingIdx = state.toolCallIndexById[tc.id];
        if (existingIdx != null) {
            const existing = parts[existingIdx];
            const merged = {
                type: ContentTypes.TOOL_CALL,
                tool_call: {
                    ...existing.tool_call,
                    ...(tc.name ? { name: tc.name } : {}),
                    ...(tc.args != null ? { args: stringifyArgs(tc.args) } : {}),
                    ...(tc.output != null ? { output: tc.output } : {}),
                    progress: tc.progress ?? 1,
                },
            };
            const next = parts.slice();
            next[existingIdx] = merged;
            return { parts: next, state };
        }
        /** Late-arriving completion without a prior run_step — synthesize the
         *  part (and close any open buffer like run_step would). */
        const next = parts.slice();
        const newIdx = next.length;
        next.push({
            type: ContentTypes.TOOL_CALL,
            tool_call: {
                id: tc.id,
                name: tc.name ?? '',
                args: stringifyArgs(tc.args),
                output: tc.output,
                progress: tc.progress ?? 1,
                type: ToolCallTypes.TOOL_CALL,
            },
        });
        return {
            parts: next,
            state: {
                openTextIdx: null,
                openThinkIdx: null,
                toolCallIndexById: { ...state.toolCallIndexById, [tc.id]: newIdx },
            },
        };
    }
    return { parts, state };
}
/**
 * Batch wrapper around {@link foldSubagentEvent}: folds an entire event
 * stream in one go and returns just the parts. Kept for tests and for
 * legacy call-sites that don't need cursor state.
 */
export function aggregateSubagentContent(events) {
    let parts = [];
    let state = initSubagentAggregatorState();
    for (const event of events) {
        ({ parts, state } = foldSubagentEvent(parts, state, event));
    }
    return parts;
}
export function initSubagentTickerState() {
    return {
        lines: [],
        textLineIdx: null,
        thinkLineIdx: null,
        textBuffer: '',
        thinkBuffer: '',
    };
}
/** Generous tail window so wide ticker containers aren't half-empty.
 *  The component applies CSS tail-ellipsis (`dir="rtl"` +
 *  `text-overflow: ellipsis`) so narrow viewports clip from the oldest
 *  side; we deliberately DON'T prepend a data-level `…` on top of that
 *  CSS ellipsis — double-eliding would render a stray dot character
 *  right next to the "Writing:" / "Reasoning:" label. */
const PREVIEW_MAX_CHARS = 300;
const truncatePreview = (input) => {
    const normalized = input.replace(/\s+/g, ' ').trim();
    if (normalized.length <= PREVIEW_MAX_CHARS)
        return normalized;
    return normalized.slice(-PREVIEW_MAX_CHARS);
};
const SNIPPET_MAX_CHARS = 48;
/** Short head-truncation for tool args/output — caller labels what each
 *  side is. Whitespace collapsed so multi-line outputs stay one line. */
const truncateSnippet = (input) => {
    const normalized = input.replace(/\s+/g, ' ').trim();
    if (normalized.length <= SNIPPET_MAX_CHARS)
        return normalized;
    return `${normalized.slice(0, SNIPPET_MAX_CHARS)}…`;
};
/** Best-effort, non-rendering summary of a tool's args payload. Parsed JSON
 *  is collapsed into `key=value, key=value`; everything else falls back to
 *  the raw string. Returns `''` when nothing useful is extractable. */
const summarizeArgs = (args) => {
    if (typeof args !== 'string' || args.length === 0)
        return '';
    const raw = args.trim();
    if (raw.length === 0 || raw === '{}' || raw === '[]')
        return '';
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const entries = Object.entries(parsed)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => {
                const valueStr = typeof v === 'string' ? v : JSON.stringify(v);
                return `${k}=${valueStr}`;
            });
            if (entries.length === 0)
                return '';
            return truncateSnippet(entries.join(', '));
        }
    }
    catch {
        /* fall through to raw-string snippet */
    }
    return truncateSnippet(raw);
};
const summarizeOutput = (output) => {
    if (typeof output === 'string')
        return truncateSnippet(output);
    if (output == null)
        return '';
    try {
        return truncateSnippet(JSON.stringify(output));
    }
    catch {
        return '';
    }
};
/**
 * Incrementally fold a single {@link SubagentUpdateEvent} into the ticker
 * state. Pure — never mutates inputs. Stored in the Recoil atom so the
 * ticker always reflects the *full* run, not just the rolling event
 * window (which trims as deltas pile up and can drop earlier tool_call
 * lifecycle events).
 *
 * Message/reasoning deltas extend an in-flight line via the `textLineIdx`
 * / `thinkLineIdx` cursors. A `run_step` with tool_calls closes the
 * running buffers and appends a `using_tool` line. `run_step_completed`
 * appends a `tool_complete` line. `error` appends an `error` line.
 * Phases we ignore (`start`, `stop`, `run_step_delta`): pass-through.
 */
export function foldSubagentEventIntoTicker(state, event) {
    if (event.phase === 'message_delta') {
        const chunk = extractTextChunk(event.data);
        if (!chunk)
            return state;
        /** Delta-type transition: close any open reasoning buffer/cursor so
         *  a later `reasoning_delta` starts a NEW line below this text,
         *  rather than appending to the original reasoning line (which
         *  would produce merged / out-of-order previews). Mirrors the
         *  content-parts reducer's chronological-order rule. */
        const afterClose = state.thinkLineIdx != null || state.thinkBuffer
            ? { ...state, thinkLineIdx: null, thinkBuffer: '' }
            : state;
        const textBuffer = afterClose.textBuffer + chunk;
        const body = truncatePreview(textBuffer);
        const line = { kind: 'writing', body };
        if (afterClose.textLineIdx == null) {
            const lines = afterClose.lines.concat(line);
            return { ...afterClose, textBuffer, lines, textLineIdx: lines.length - 1 };
        }
        const lines = afterClose.lines.slice();
        lines[afterClose.textLineIdx] = line;
        return { ...afterClose, textBuffer, lines };
    }
    if (event.phase === 'reasoning_delta') {
        const chunk = extractThinkChunk(event.data);
        if (!chunk)
            return state;
        /** Symmetric: close any open text buffer/cursor. */
        const afterClose = state.textLineIdx != null || state.textBuffer
            ? { ...state, textLineIdx: null, textBuffer: '' }
            : state;
        const thinkBuffer = afterClose.thinkBuffer + chunk;
        const body = truncatePreview(thinkBuffer);
        const line = { kind: 'reasoning', body };
        if (afterClose.thinkLineIdx == null) {
            const lines = afterClose.lines.concat(line);
            return { ...afterClose, thinkBuffer, lines, thinkLineIdx: lines.length - 1 };
        }
        const lines = afterClose.lines.slice();
        lines[afterClose.thinkLineIdx] = line;
        return { ...afterClose, thinkBuffer, lines };
    }
    if (event.phase === 'run_step') {
        /** A new run_step starts a fresh lifecycle marker and closes any
         *  in-flight streaming line — the delta cursors reset so the *next*
         *  message/reasoning delta starts its own line below the tool call. */
        const afterClose = {
            ...state,
            textBuffer: '',
            thinkBuffer: '',
            textLineIdx: null,
            thinkLineIdx: null,
        };
        const data = event.data;
        if (data?.stepDetails?.type !== 'tool_calls')
            return afterClose;
        const toolCalls = data.stepDetails.tool_calls ?? [];
        const named = toolCalls.filter((tc) => typeof tc?.name === 'string' && tc.name.length > 0);
        if (named.length === 0)
            return afterClose;
        const toolNames = named.map((tc) => tc.name);
        const argsSnippet = named.length === 1 ? summarizeArgs(named[0].args) : undefined;
        const line = {
            kind: 'using_tool',
            toolNames,
            ...(argsSnippet ? { argsSnippet } : {}),
        };
        return { ...afterClose, lines: afterClose.lines.concat(line) };
    }
    if (event.phase === 'run_step_completed') {
        const data = event.data;
        const tc = data?.result?.tool_call;
        if (typeof tc?.name !== 'string' || tc.name.length === 0)
            return state;
        const outputSnippet = tc.output != null ? summarizeOutput(tc.output) : undefined;
        const line = {
            kind: 'tool_complete',
            toolName: tc.name,
            ...(outputSnippet ? { outputSnippet } : {}),
        };
        return { ...state, lines: state.lines.concat(line) };
    }
    if (event.phase === 'error') {
        const data = event.data;
        const line = {
            kind: 'error',
            ...(data?.message ? { message: data.message } : {}),
        };
        return { ...state, lines: state.lines.concat(line) };
    }
    return state;
}
/**
 * Batch wrapper around {@link foldSubagentEventIntoTicker} — folds an
 * entire event stream in one shot. Kept for tests and any legacy
 * consumer that prefers a one-call API.
 */
export function buildSubagentTickerLines(events) {
    let state = initSubagentTickerState();
    for (const event of events) {
        state = foldSubagentEventIntoTicker(state, event);
    }
    return state.lines;
}
