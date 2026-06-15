import { useMemo } from 'react';
export default function Stdout({ output = '' }) {
    const processedContent = useMemo(() => {
        if (!output) {
            return '';
        }
        const parts = output.split('Generated files:');
        return parts[0].trim();
    }, [output]);
    if (!processedContent) {
        return null;
    }
    return (<pre className="shrink-0 whitespace-pre-wrap break-words font-mono text-text-primary">
      {processedContent}
    </pre>);
}
