import { XCircle, PlusCircleIcon, Wrench, AlertCircle } from 'lucide-react';
import type { AgentToolType, ToolAvailability } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

type MCPToolItemProps = {
  tool: AgentToolType;
  onAddTool: () => void;
  onRemoveTool: () => void;
  isInstalled?: boolean;
  isConfiguring?: boolean;
  isInitializing?: boolean;
  availability?: ToolAvailability;
};

function MCPToolItem({
  tool,
  onAddTool,
  onRemoveTool,
  isInstalled = false,
  isConfiguring = false,
  isInitializing = false,
  availability,
}: MCPToolItemProps) {
  const localize = useLocalize();
  const handleClick = () => {
    if (isInstalled) {
      onRemoveTool();
    } else {
      onAddTool();
    }
  };

  const name = tool.metadata?.name || tool.tool_id;
  const description = tool.metadata?.description || '';
  const icon = tool.metadata?.icon;

  const isAvailable = availability ? availability.isAvailable : true;
  const unavailabilityMessage = availability?.message;

  const getButtonState = () => {
    if (!isAvailable && !isInstalled) {
      return {
        text: localize('com_ui_unavailable'),
        icon: <AlertCircle className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
        className: 'btn btn-neutral border-token-border-light relative opacity-50 cursor-not-allowed',
        disabled: true,
      };
    }

    if (isInstalled) {
      return {
        text: localize('com_nav_tool_remove'),
        icon: <XCircle className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
        className: 'btn btn-neutral border-token-border-light relative',
        disabled: false,
      };
    }

    if (isConfiguring) {
      return {
        text: localize('com_ui_confirm'),
        icon: <PlusCircleIcon className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
        className: 'btn btn-primary relative',
        disabled: false,
      };
    }

    if (isInitializing) {
      return {
        text: localize('com_ui_initializing'),
        icon: <Wrench className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
        className: 'btn btn-primary relative opacity-75 cursor-not-allowed',
        disabled: true,
      };
    }

    return {
      text: localize('com_ui_add'),
      icon: <PlusCircleIcon className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
      className: 'btn btn-primary relative',
      disabled: false,
    };
  };

  const buttonState = getButtonState();

  return (
    <div className="flex flex-col gap-4 rounded border border-border-medium bg-transparent p-6">
      <div className="flex gap-4">
        <div className="h-[70px] w-[70px] shrink-0">
          <div className="relative h-full w-full">
            {icon ? (
              <img
                src={icon}
                alt={localize('com_ui_logo', { 0: name })}
                className="h-full w-full rounded-[5px] bg-white"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-[5px] border border-border-medium bg-transparent">
                <Wrench className="h-8 w-8 text-text-secondary" />
              </div>
            )}
            <div className="absolute inset-0 rounded-[5px] ring-1 ring-inset ring-black/10"></div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-start justify-between">
          <div className="mb-2 line-clamp-1 max-w-full text-lg leading-5 text-text-primary">
            {name}
          </div>
          <button
            className={buttonState.className}
            aria-label={`${buttonState.text} ${name}`}
            onClick={handleClick}
            disabled={buttonState.disabled}
          >
            <div className="flex w-full items-center justify-center gap-2">
              {buttonState.text}
              {buttonState.icon}
            </div>
          </button>
        </div>
      </div>
      <div className="line-clamp-3 h-[60px] text-sm text-text-secondary">{description}</div>
      {!isAvailable && unavailabilityMessage && (
        <div className="flex items-start gap-1 text-xs text-red-500 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{unavailabilityMessage}</span>
        </div>
      )}
    </div>
  );
}

export default MCPToolItem;
