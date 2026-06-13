import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@librechat/client';
import type { TTourToolCall } from 'librechat-data-provider';
import { cn } from '~/utils';

interface ToolOutputCollapsibleProps {
  toolCalls: TTourToolCall[];
  defaultOpen?: boolean;
}

export default function ToolOutputCollapsible({
  toolCalls,
  defaultOpen = false,
}: ToolOutputCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md border border-border-light px-2.5 py-1.5 text-xs transition-colors',
            'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
          )}
        >
          <Wrench className="size-3 shrink-0" />
          <span className="flex-1 text-left font-medium">
            {toolCalls.length === 1
              ? toolCalls[0].toolName
              : `${toolCalls.length} tool calls`}
          </span>
          {open ? (
            <ChevronDown className="size-3 shrink-0" />
          ) : (
            <ChevronRight className="size-3 shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-1.5 border-l-2 border-border-light pl-3">
          {toolCalls.map((tc, i) => (
            <div key={tc.toolCallId ?? i} className="py-0.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                <Wrench className="size-3 text-text-secondary" />
                <span>{tc.toolName}</span>
              </div>
              {tc.output && (
                <div className="mt-0.5 rounded-md bg-surface-secondary px-2 py-1 text-xs text-text-secondary">
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                    {tc.output.length > 500 ? tc.output.slice(0, 500) + '…' : tc.output}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
