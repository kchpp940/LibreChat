import React, { useState, useEffect, useRef } from 'react';
function hastToReact(nodes) {
    return nodes.map((node, i) => {
        if (node.type === 'text') {
            return node.value;
        }
        return React.createElement(node.tagName, { key: i, className: node.properties?.className?.join(' ') }, node.children ? hastToReact(node.children) : undefined);
    });
}
let lowlightPromise = null;
let lowlightModule = null;
function loadLowlight() {
    if (lowlightModule) {
        return Promise.resolve(lowlightModule);
    }
    if (!lowlightPromise) {
        lowlightPromise = import('lowlight').then((mod) => {
            lowlightModule = mod;
            return mod;
        });
    }
    return lowlightPromise;
}
function highlightCode(mod, code, lang) {
    if (lang === 'plaintext') {
        return [code];
    }
    try {
        const tree = mod.lowlight.registered(lang)
            ? mod.lowlight.highlight(lang, code)
            : mod.lowlight.highlightAuto(code);
        return hastToReact(tree.children);
    }
    catch {
        return [code];
    }
}
export default function useLazyHighlight(code, lang) {
    const [highlighted, setHighlighted] = useState(() => {
        if (!code || !lowlightModule) {
            return null;
        }
        return highlightCode(lowlightModule, code, lang);
    });
    const prevKey = useRef('');
    useEffect(() => {
        const key = `${lang}\0${code ?? ''}`;
        if (key === prevKey.current) {
            return;
        }
        prevKey.current = key;
        if (!code) {
            setHighlighted(null);
            return;
        }
        if (lowlightModule) {
            setHighlighted(highlightCode(lowlightModule, code, lang));
            return;
        }
        let cancelled = false;
        loadLowlight()
            .then((mod) => {
            if (!cancelled) {
                setHighlighted(highlightCode(mod, code, lang));
            }
        })
            .catch(() => {
            if (!cancelled) {
                setHighlighted([code]);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [code, lang]);
    return highlighted;
}
