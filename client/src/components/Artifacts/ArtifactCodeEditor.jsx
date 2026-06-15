import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import debounce from 'lodash/debounce';
import MonacoEditor from '@monaco-editor/react';
import { useMutationState, useCodeState } from '~/Providers/EditorContext';
import { useArtifactsContext } from '~/Providers';
import { useEditArtifact } from '~/data-provider';
const LANG_MAP = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    css: 'css',
    json: 'json',
    markdown: 'markdown',
    html: 'html',
    xml: 'xml',
    sql: 'sql',
    yaml: 'yaml',
    shell: 'shell',
    bash: 'shell',
    tsx: 'typescript',
    jsx: 'javascript',
    c: 'c',
    cpp: 'cpp',
    java: 'java',
    go: 'go',
    rust: 'rust',
    kotlin: 'kotlin',
    swift: 'swift',
    php: 'php',
    ruby: 'ruby',
    r: 'r',
    lua: 'lua',
    scala: 'scala',
    perl: 'perl',
};
const TYPE_MAP = {
    'text/html': 'html',
    'application/vnd.code-html': 'html',
    'application/vnd.react': 'typescript',
    'application/vnd.ant.react': 'typescript',
    'text/markdown': 'markdown',
    'text/md': 'markdown',
    'text/plain': 'plaintext',
    'application/vnd.mermaid': 'markdown',
};
function getMonacoLanguage(type, language) {
    if (language && LANG_MAP[language]) {
        return LANG_MAP[language];
    }
    return TYPE_MAP[type ?? ''] ?? 'plaintext';
}
function getArtifactEditTarget(artifact) {
    if (artifact.index == null) {
        return null;
    }
    return {
        artifactId: artifact.id,
        messageId: artifact.messageId ?? '',
        index: artifact.index,
    };
}
function isSameArtifactTarget(left, right) {
    return (left.artifactId === right.artifactId &&
        left.messageId === right.messageId &&
        left.index === right.index);
}
function isSameMutationTarget(target, vars) {
    return target.messageId === vars.messageId && target.index === vars.index;
}
export const ArtifactCodeEditor = function ArtifactCodeEditor({ artifact, monacoRef, readOnly: externalReadOnly, }) {
    const { isSubmitting } = useArtifactsContext();
    const readOnly = (externalReadOnly ?? false) || isSubmitting;
    const { setCurrentCode } = useCodeState();
    const [currentUpdate, setCurrentUpdate] = useState(null);
    const { isMutating, setIsMutating } = useMutationState();
    const artifactRef = useRef(artifact);
    const isMutatingRef = useRef(isMutating);
    const currentUpdateRef = useRef(currentUpdate);
    const setCurrentCodeRef = useRef(setCurrentCode);
    const pendingUpdateRef = useRef(null);
    const runMutationRef = useRef(() => { });
    const editArtifact = useEditArtifact({
        onMutate: (vars) => {
            isMutatingRef.current = true;
            currentUpdateRef.current = vars.updated;
            setIsMutating(true);
            setCurrentUpdate(vars.updated);
        },
        onSuccess: (_data, vars) => {
            isMutatingRef.current = false;
            currentUpdateRef.current = null;
            setIsMutating(false);
            setCurrentUpdate(null);
            const pending = pendingUpdateRef.current;
            pendingUpdateRef.current = null;
            const currentTarget = getArtifactEditTarget(artifactRef.current);
            if (pending == null ||
                currentTarget == null ||
                !isSameArtifactTarget(pending, currentTarget)) {
                return;
            }
            const original = isSameMutationTarget(pending, vars) ? vars.updated : pending.original;
            if (pending.code.trim() !== original.trim()) {
                setCurrentCodeRef.current(pending.code);
                runMutationRef.current(pending.code, original);
            }
        },
        onError: () => {
            const pending = pendingUpdateRef.current;
            pendingUpdateRef.current = null;
            isMutatingRef.current = false;
            currentUpdateRef.current = null;
            setIsMutating(false);
            setCurrentUpdate(null);
            const currentTarget = getArtifactEditTarget(artifactRef.current);
            if (pending == null ||
                currentTarget == null ||
                !isSameArtifactTarget(pending, currentTarget)) {
                return;
            }
            if (pending.code.trim() !== pending.original.trim()) {
                setCurrentCodeRef.current(pending.code);
                runMutationRef.current(pending.code, pending.original);
            }
        },
    });
    const editArtifactRef = useRef(editArtifact);
    const prevContentRef = useRef(artifact.content ?? '');
    const prevArtifactId = useRef(artifact.id);
    const prevReadOnly = useRef(readOnly);
    artifactRef.current = artifact;
    isMutatingRef.current = isMutating;
    currentUpdateRef.current = currentUpdate;
    editArtifactRef.current = editArtifact;
    setCurrentCodeRef.current = setCurrentCode;
    const runMutation = useCallback((code, originalOverride) => {
        const art = artifactRef.current;
        const target = getArtifactEditTarget(art);
        if (readOnly || target == null) {
            return;
        }
        const original = originalOverride ?? art.content ?? '';
        if (isMutatingRef.current) {
            pendingUpdateRef.current = {
                ...target,
                code,
                original,
            };
            return;
        }
        const isNotOriginal = code.trim() !== original.trim();
        const isNotRepeated = currentUpdateRef.current == null ? true : code.trim() !== currentUpdateRef.current.trim();
        if (!isNotOriginal || !isNotRepeated) {
            return;
        }
        setCurrentCodeRef.current(code);
        editArtifactRef.current.mutate({
            index: target.index,
            messageId: target.messageId,
            original,
            updated: code,
        });
    }, [readOnly]);
    runMutationRef.current = runMutation;
    const debouncedMutation = useMemo(() => debounce((code) => {
        runMutationRef.current(code);
    }, 500), []);
    useEffect(() => {
        return () => debouncedMutation.cancel();
    }, [artifact.id, debouncedMutation]);
    /**
     * Streaming: use model.applyEdits() to append new content.
     * Unlike setValue/pushEditOperations, applyEdits preserves existing
     * tokens so syntax highlighting doesn't flash during updates.
     */
    useEffect(() => {
        const ed = monacoRef.current;
        if (!ed || !readOnly) {
            return;
        }
        const newContent = artifact.content ?? '';
        const prev = prevContentRef.current;
        if (newContent === prev) {
            return;
        }
        const model = ed.getModel();
        if (!model) {
            return;
        }
        if (newContent.startsWith(prev) && prev.length > 0) {
            const appended = newContent.slice(prev.length);
            const endPos = model.getPositionAt(model.getValueLength());
            model.applyEdits([
                {
                    range: {
                        startLineNumber: endPos.lineNumber,
                        startColumn: endPos.column,
                        endLineNumber: endPos.lineNumber,
                        endColumn: endPos.column,
                    },
                    text: appended,
                },
            ]);
        }
        else {
            model.setValue(newContent);
        }
        prevContentRef.current = newContent;
        ed.revealLine(model.getLineCount());
    }, [artifact.content, readOnly, monacoRef]);
    useEffect(() => {
        if (artifact.id === prevArtifactId.current) {
            return;
        }
        prevArtifactId.current = artifact.id;
        pendingUpdateRef.current = null;
        prevContentRef.current = artifact.content ?? '';
        const ed = monacoRef.current;
        if (ed && artifact.content != null) {
            ed.getModel()?.setValue(artifact.content);
        }
    }, [artifact.id, artifact.content, monacoRef]);
    useEffect(() => {
        if (prevReadOnly.current && !readOnly && artifact.content != null) {
            const ed = monacoRef.current;
            if (ed) {
                ed.getModel()?.setValue(artifact.content);
                prevContentRef.current = artifact.content;
            }
        }
        prevReadOnly.current = readOnly;
    }, [readOnly, artifact.content, monacoRef]);
    const handleChange = useCallback((value) => {
        if (value === undefined || readOnly) {
            return;
        }
        prevContentRef.current = value;
        setCurrentCode(value);
        if (value.length > 0) {
            debouncedMutation(value);
        }
    }, [readOnly, debouncedMutation, setCurrentCode]);
    /**
     * Disable all validation — this is an artifact viewer/editor, not an IDE.
     * Note: these are global Monaco settings that affect all editor instances on the page.
     * The `as unknown` cast is required because monaco-editor v0.55 types `.languages.typescript`
     * as `{ deprecated: true }` while the runtime API is fully functional.
     */
    const handleBeforeMount = useCallback((monaco) => {
        const { typescriptDefaults, javascriptDefaults, JsxEmit } = monaco.languages
            .typescript;
        const diagnosticsOff = { noSemanticValidation: true, noSyntaxValidation: true };
        const compilerBase = { allowNonTsExtensions: true, allowJs: true, jsx: JsxEmit.React };
        typescriptDefaults.setDiagnosticsOptions(diagnosticsOff);
        javascriptDefaults.setDiagnosticsOptions(diagnosticsOff);
        typescriptDefaults.setCompilerOptions(compilerBase);
        javascriptDefaults.setCompilerOptions(compilerBase);
    }, []);
    const handleMount = useCallback((ed) => {
        monacoRef.current = ed;
        prevContentRef.current = ed.getModel()?.getValue() ?? artifact.content ?? '';
        if (readOnly) {
            const model = ed.getModel();
            if (model) {
                ed.revealLine(model.getLineCount());
            }
        }
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monacoRef]);
    const language = getMonacoLanguage(artifact.type, artifact.language);
    const editorOptions = useMemo(() => ({
        readOnly,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        fontSize: 13,
        tabSize: 2,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 8 },
        renderLineHighlight: readOnly ? 'none' : 'line',
        cursorStyle: readOnly ? 'underline-thin' : 'line',
        scrollbar: {
            vertical: 'visible',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
        },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        folding: false,
        glyphMargin: false,
        colorDecorators: !readOnly,
        occurrencesHighlight: readOnly ? 'off' : 'singleFile',
        selectionHighlight: !readOnly,
        renderValidationDecorations: readOnly ? 'off' : 'editable',
        quickSuggestions: !readOnly,
        suggestOnTriggerCharacters: !readOnly,
        parameterHints: { enabled: !readOnly },
        hover: { enabled: !readOnly },
        matchBrackets: readOnly ? 'never' : 'always',
    }), [readOnly]);
    if (!artifact.content) {
        return null;
    }
    return (<div className="h-full w-full bg-[#1e1e1e]">
      <MonacoEditor height="100%" language={readOnly ? 'plaintext' : language} theme="vs-dark" defaultValue={artifact.content} onChange={handleChange} beforeMount={handleBeforeMount} onMount={handleMount} options={editorOptions}/>
    </div>);
};
