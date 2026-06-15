import React, { memo, useMemo } from 'react';
import { SandpackPreview, SandpackProvider } from '@codesandbox/sandpack-react/unstyled';
import { sharedFiles, buildSandpackOptions } from '~/utils/artifacts';
export const ArtifactPreview = memo(function ({ files, fileKey, template, sharedProps, previewRef, currentCode, startupConfig, }) {
    const artifactFiles = useMemo(() => {
        if (Object.keys(files).length === 0) {
            return files;
        }
        const code = currentCode ?? '';
        if (!code) {
            return files;
        }
        return {
            ...files,
            [fileKey]: { code },
        };
    }, [currentCode, files, fileKey]);
    const options = useMemo(() => buildSandpackOptions(template, startupConfig), [startupConfig, template]);
    if (Object.keys(artifactFiles).length === 0) {
        return null;
    }
    return (<SandpackProvider files={{ ...artifactFiles, ...sharedFiles }} options={options} {...sharedProps} template={template}>
      <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton={false} tabIndex={0} ref={previewRef}/>
    </SandpackProvider>);
});
