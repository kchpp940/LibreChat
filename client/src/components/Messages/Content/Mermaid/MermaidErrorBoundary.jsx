import React from 'react';
class MermaidErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Mermaid rendering error:', error, errorInfo);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.code !== this.props.code && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }
    render() {
        if (this.state.hasError) {
            return (<div className="w-full overflow-hidden rounded-md border border-border-light">
          <div className="rounded-t-md bg-surface-secondary px-4 py-2 font-sans text-xs text-text-secondary">
            {'mermaid'}
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-b-md bg-surface-primary-alt p-4 font-mono text-xs text-text-secondary">
            {this.props.code}
          </pre>
        </div>);
        }
        return this.props.children;
    }
}
export default MermaidErrorBoundary;
