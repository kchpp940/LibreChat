import React from 'react';
import remarkGfm from 'remark-gfm';
import supersub from 'remark-supersub';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { code, codeNoExecution, a, p, table } from './MarkdownComponents';
import { CodeBlockProvider } from '~/Providers';
import { langSubset } from '~/utils';
class MarkdownErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Markdown rendering error:', error, errorInfo);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.content !== this.props.content && this.state.hasError) {
            this.setState({ hasError: false, error: undefined });
        }
    }
    render() {
        if (this.state.hasError) {
            const { content, codeExecution = true } = this.props;
            const rehypePlugins = [
                [
                    rehypeHighlight,
                    {
                        detect: true,
                        ignoreMissing: true,
                        subset: langSubset,
                    },
                ],
            ];
            return (<CodeBlockProvider>
          <ReactMarkdown remarkPlugins={[
                    /** @ts-ignore */
                    supersub,
                    remarkGfm,
                ]} 
            /** @ts-ignore */
            rehypePlugins={rehypePlugins} components={{
                    code: codeExecution ? code : codeNoExecution,
                    a,
                    p,
                    table,
                }}>
            {content}
          </ReactMarkdown>
        </CodeBlockProvider>);
        }
        return this.props.children;
    }
}
export default MarkdownErrorBoundary;
