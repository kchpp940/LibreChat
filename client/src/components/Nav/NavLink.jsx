import React, { forwardRef } from 'react';
import { cn } from '~/utils/';
const NavLink = forwardRef((props, ref) => {
    const { svg, text, clickHandler, disabled, className = '' } = props;
    const defaultProps = {
        className: cn('w-full flex gap-2 rounded p-2.5 text-sm cursor-pointer group items-center transition-colors duration-200 text-text-primary', className, {
            'opacity-50 pointer-events-none': disabled,
        }),
    };
    if (clickHandler) {
        defaultProps.onClick = clickHandler;
    }
    return (<button {...defaultProps} ref={ref}>
      {svg()}
      {text}
    </button>);
});
export default NavLink;
