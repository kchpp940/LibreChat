import React from 'react';
import { HoverCardPortal, HoverCardContent } from '@librechat/client';
import { useLocalize } from '~/hooks';
function OptionHover({ side, description, disabled, langCode, sideOffset = 30, className, }) {
    const localize = useLocalize();
    if (disabled) {
        return null;
    }
    const text = langCode ? localize(description) : description;
    return (<HoverCardPortal>
      <HoverCardContent side={side} className={`z-[999] w-80 ${className}`} sideOffset={sideOffset}>
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{text}</p>
        </div>
      </HoverCardContent>
    </HoverCardPortal>);
}
export default OptionHover;
