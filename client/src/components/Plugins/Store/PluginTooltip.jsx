import { HoverCardPortal, HoverCardContent } from '@librechat/client';
function PluginTooltip({ content, position }) {
    return (<HoverCardPortal>
      <HoverCardContent side={position} className="w-80">
        <div className="space-y-2">
          <div className="text-sm text-gray-600 dark:text-gray-300">{content}</div>
        </div>
      </HoverCardContent>
    </HoverCardPortal>);
}
export default PluginTooltip;
