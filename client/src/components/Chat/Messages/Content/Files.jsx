import { useMemo, useState, useCallback, memo } from 'react';
import FileContainer from '~/components/Chat/Input/Files/FileContainer';
import FilePreviewDialog from './FilePreviewDialog';
import Image from './Image';
const Files = ({ message }) => {
    const imageFiles = useMemo(() => {
        return message?.files?.filter((file) => file.type?.startsWith('image/')) || [];
    }, [message?.files]);
    const otherFiles = useMemo(() => {
        return message?.files?.filter((file) => !file.type?.startsWith('image/')) || [];
    }, [message?.files]);
    const [selectedFile, setSelectedFile] = useState(null);
    const handleClose = useCallback((open) => {
        if (!open) {
            setSelectedFile(null);
        }
    }, []);
    return (<>
      {otherFiles.length > 0 &&
            otherFiles.map((file) => (<FileContainer key={file.file_id} file={file} onClick={() => setSelectedFile(file)}/>))}
      {imageFiles.length > 0 &&
            imageFiles.map((file) => (<Image key={file.file_id} imagePath={file.preview ?? file.filepath ?? ''} height={file.height ?? 1920} width={file.width ?? 1080} altText={file.filename ?? 'Uploaded Image'}/>))}
      <FilePreviewDialog open={selectedFile !== null} onOpenChange={handleClose} fileName={selectedFile?.filename ?? ''} fileId={selectedFile?.file_id} fileType={selectedFile?.type ?? undefined} fileSize={selectedFile?.bytes}/>
    </>);
};
export default memo(Files);
