import React from 'react';
import { handleDoubleClick } from '~/utils';
export const CodeVariableGfm = ({ children }) => {
    return (<code onDoubleClick={handleDoubleClick} className="rounded-md bg-surface-primary-alt p-1 text-xs text-text-secondary md:text-sm">
      {children}
    </code>);
};
const variableRegex = /{{(.*?)}}/g;
const highlightVariables = (text) => {
    const parts = text.split(variableRegex);
    return parts.map((part, index) => {
        if (index % 2 === 1) {
            return (<b key={index} className="ml-[0.5] rounded-lg bg-amber-100 p-[1px] font-medium text-text-warning dark:bg-transparent">
          {`{{${part}}}`}
        </b>);
        }
        return part;
    });
};
const processChildren = (children) => {
    if (typeof children === 'string') {
        return highlightVariables(children);
    }
    if (Array.isArray(children)) {
        return children.map((child, index) => (<React.Fragment key={index}>{processChildren(child)}</React.Fragment>));
    }
    if (React.isValidElement(children)) {
        const element = children;
        if (typeof element.type !== 'string' || element.type === 'code') {
            return children;
        }
        if (element.props.children) {
            return React.cloneElement(element, {
                ...element.props,
                children: processChildren(element.props.children),
            });
        }
        return children;
    }
    return children;
};
export const PromptVariableGfm = ({ children, }) => {
    return <p>{processChildren(children)}</p>;
};
