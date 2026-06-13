import { useState, useCallback } from 'react';
import {
  Bot,
  Wrench,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@librechat/client';
import type { TTourData, TTourItem } from 'librechat-data-provider';
import { cn } from '~/utils';

const categoryIcon: Record<string, React.ReactNode> = {
  assistant: <Bot className="size-3.5" />,
  tool_call: <Wrench className="size-3.5" />,
  artifact: <Sparkles className="size-3.5" />,
  file: <FileText className="size-3.5" />,
  error: <AlertTriangle className="size-3.5" />,
};

const categoryLabel: Record<string, string> = {
  assistant: 'Reply',
  tool_call: 'Tool Call',
  artifact: 'Artifact',
  file: 'File',
  error: 'Error',
};

function TourItemRow({
  item,
  onNavigate,
}: {
  item: TTourItem;
  onNavigate: (messageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = (item.toolCalls && item.toolCalls.length > 0) || (item.files && item.files.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-tertiary cursor-pointer',
        )}
      >
        <button
          type="button"
          className="flex flex-1 items-start gap-2 text-left"
          onClick={() => onNavigate(item.messageId)}
          aria-label={`Navigate to ${categoryLabel[item.category]}: ${item.label}`}
        >
          <span className="mt-0.5 shrink-0 text-text-secondary">
            {categoryIcon[item.category]}
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 text-text-primary">{item.label}</span>
        </button>
        {hasDetails && (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded p-0.5 text-text-secondary hover:text-text-primary"
              aria-label="Toggle details"
            >
              {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          </CollapsibleTrigger>
        )}
      </div>
      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-5 mr-2 mb-1 space-y-1 border-l border-border-light pl-3">
            {item.toolCalls?.map((tc, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5 text-xs text-text-secondary">
                <Wrench className="size-3 shrink-0" />
                <span className="truncate">{tc.toolName}</span>
                {tc.output && (
                  <span className="truncate text-text-tertiary">→ {tc.output.slice(0, 50)}</span>
                )}
              </div>
            ))}
            {item.files?.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5 text-xs text-text-secondary">
                <FileText className="size-3 shrink-0" />
                <span className="truncate">{f.filename || 'File'}</span>
                {f.filetype && (
                  <span className="rounded bg-surface-tertiary px-1 text-[10px] text-text-tertiary">
                    {f.filetype}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

interface ShareTourPanelProps {
  tour: TTourData;
  onNavigate: (messageId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ShareTourPanel({
  tour,
  onNavigate,
  isOpen,
  onToggle,
}: ShareTourPanelProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredItems =
    filter === 'all' ? tour.items : tour.items.filter((item) => item.category === filter);

  const filterOptions = [
    { value: 'all', label: `All (${tour.items.length})` },
    { value: 'assistant', label: `Replies (${tour.assistantCount})` },
    { value: 'tool_call', label: `Tools (${tour.toolCallCount})` },
    { value: 'artifact', label: 'Artifacts' },
    { value: 'file', label: `Files (${tour.fileCount})` },
  ];

  if (!isOpen) {
    return (
      <div className="flex h-full flex-col items-center pt-3">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          aria-label="Open tour panel"
        >
          <PanelRightOpen className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col border-l border-border-light bg-surface-primary">
      <div className="flex items-center justify-between border-b border-border-light px-3 py-2.5">
        <h2 className="text-sm font-semibold text-text-primary">Tour Guide</h2>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          aria-label="Close tour panel"
        >
          <PanelRightClose className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border-light px-2 py-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={cn(
              'rounded-full px-2 py-0.5 text-xs transition-colors',
              filter === opt.value
                ? 'bg-surface-tertiary text-text-primary font-medium'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto thin-scrollbar flex-1 px-1 py-2">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-text-secondary">
            No items for this filter
          </div>
        ) : (
          filteredItems.map((item) => (
            <TourItemRow key={item.messageId} item={item} onNavigate={onNavigate} />
          ))
        )}
      </div>

      <div className="border-t border-border-light px-3 py-2 text-[10px] text-text-tertiary">
        {tour.totalMessages} messages · {tour.assistantCount} replies · {tour.toolCallCount} tool calls · {tour.fileCount} files
      </div>
    </div>
  );
}
