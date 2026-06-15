import { memo } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import supersub from 'remark-supersub';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { codeNoExecution } from '~/components/Chat/Messages/Content/MarkdownComponents';
import { langSubset } from '~/utils';
const REMARK_PLUGINS = [
    supersub,
    remarkGfm,
    [remarkMath, { singleDollarTextMath: false }],
];
const REHYPE_PLUGINS = [
    [rehypeKatex],
    [
        rehypeHighlight,
        {
            detect: true,
            ignoreMissing: true,
            subset: langSubset,
        },
    ],
];
const MARKDOWN_COMPONENTS = { code: codeNoExecution };
function SkillMarkdownRenderer({ content, className }) {
    return (<ReactMarkdown 
    /** @ts-ignore - PluggableList vs Pluggable[] shape drift */
    remarkPlugins={REMARK_PLUGINS} 
    /** @ts-ignore - PluggableList vs Pluggable[] shape drift */
    rehypePlugins={REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS} className={className ??
            'markdown prose dark:prose-invert light w-full break-words leading-[1.65rem] text-text-primary'}>
      {content}
    </ReactMarkdown>);
}
export default memo(SkillMarkdownRenderer);
