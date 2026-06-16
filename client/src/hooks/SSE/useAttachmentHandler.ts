import { useSetRecoilState } from 'recoil';
import type { QueryClient } from '@tanstack/react-query';
import { QueryKeys, Tools } from 'librechat-data-provider';
import type {
  MemoriesResponse,
  EventSubmission,
  TAttachment,
  PublicFileAssetDescriptor,
} from 'librechat-data-provider';
import { handleMemoryArtifact } from '~/utils/memory';
import store from '~/store';

export default function useAttachmentHandler(queryClient?: QueryClient) {
  const setAttachmentsMap = useSetRecoilState(store.messageAttachmentsMap);

  return ({ data }: { data: TAttachment; submission: EventSubmission }) => {
    const { messageId } = data;
    const fileId = (data as Partial<PublicFileAssetDescriptor>).file_id;

    const fileData = data as PublicFileAssetDescriptor;
    if (
      queryClient &&
      fileData?.file_id &&
      fileData?.url &&
      !fileData.url.includes('/api/files')
    ) {
      queryClient.setQueryData([QueryKeys.files], (oldData: PublicFileAssetDescriptor[] | undefined) => {
        if (!oldData) {
          return [fileData];
        }
        const existingIndex = oldData.findIndex((file) => file.file_id === fileData.file_id);
        if (existingIndex > -1) {
          const updated = [...oldData];
          updated[existingIndex] = { ...oldData[existingIndex], ...fileData };
          return updated;
        }
        return [fileData, ...oldData];
      });
    }

    if (queryClient && data.type === Tools.memory && data[Tools.memory]) {
      const memoryArtifact = data[Tools.memory];

      queryClient.setQueryData([QueryKeys.memories], (oldData: MemoriesResponse | undefined) => {
        if (!oldData) {
          return oldData;
        }

        return handleMemoryArtifact({ memoryArtifact, currentData: oldData }) || oldData;
      });
    }

    if (queryClient && fileId) {
      queryClient.removeQueries([QueryKeys.filePreview, fileId]);
    }

    setAttachmentsMap((prevMap) => {
      const messageAttachments =
        (prevMap as Record<string, TAttachment[] | undefined>)[messageId] || [];
      if (fileId) {
        const existingIndex = messageAttachments.findIndex(
          (a) => (a as Partial<PublicFileAssetDescriptor>).file_id === fileId,
        );
        if (existingIndex > -1) {
          const existing = messageAttachments[existingIndex] as Partial<PublicFileAssetDescriptor>;
          const incoming = data as Partial<PublicFileAssetDescriptor>;
          const next = { ...existing, ...data } as TAttachment;
          if (
            (existing.status === 'ready' || existing.status === 'failed') &&
            incoming.status === 'pending'
          ) {
            (next as Partial<PublicFileAssetDescriptor>).status = existing.status;
            (next as Partial<PublicFileAssetDescriptor>).textFormat = existing.textFormat;
            (next as Partial<PublicFileAssetDescriptor>).previewError = existing.previewError;
          }
          const merged = [...messageAttachments];
          merged[existingIndex] = next;
          return { ...prevMap, [messageId]: merged };
        }
      }
      return {
        ...prevMap,
        [messageId]: [...messageAttachments, data],
      };
    });
  };
}
