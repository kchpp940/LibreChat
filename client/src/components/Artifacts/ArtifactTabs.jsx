import { useRef, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useCodeState } from '~/Providers/EditorContext';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { ArtifactCodeEditor } from './ArtifactCodeEditor';
import { useArtifactBundlerURLs } from '~/Providers/CapabilitiesContext';
import { ArtifactPreview } from './ArtifactPreview';
export default function ArtifactTabs({ artifact, previewRef, isSharedConvo, }) {
    const { currentCode, setCurrentCode } = useCodeState();
    const bundlerURLs = useArtifactBundlerURLs();
    const monacoRef = useRef(null);
    const lastIdRef = useRef(null);
    useEffect(() => {
        if (artifact.id !== lastIdRef.current) {
            setCurrentCode(undefined);
        }
        lastIdRef.current = artifact.id;
    }, [setCurrentCode, artifact.id]);
    const { files, fileKey, template, sharedProps } = useArtifactProps({ artifact });
    return (<div className="flex h-full w-full flex-col">
      <Tabs.Content value="code" id="artifacts-code" className="h-full w-full flex-grow overflow-auto" tabIndex={-1}>
        <ArtifactCodeEditor artifact={artifact} monacoRef={monacoRef} readOnly={isSharedConvo}/>
      </Tabs.Content>

      <Tabs.Content value="preview" className="h-full w-full flex-grow overflow-hidden" tabIndex={-1}>
        <ArtifactPreview files={files} fileKey={fileKey} template={template} previewRef={previewRef} sharedProps={sharedProps} currentCode={currentCode} bundlerURLs={bundlerURLs}/>
      </Tabs.Content>
    </div>);
}
