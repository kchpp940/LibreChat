import React from 'react';
import { useToastContext } from '@librechat/client';
import { useCodeOutputDownload } from '~/data-provider';
import { isHttpDownloadTarget, triggerDownload } from '~/utils';

interface LogLinkProps {
  href: string;
  filename: string;
  file_id?: string;
  children: React.ReactNode;
}

interface AttachmentLinkOptions {
  href: string;
  filename: string;
  file_id?: string;
}

export const useAttachmentLink = ({
  href,
  filename,
  file_id,
}: AttachmentLinkOptions) => {
  const { showToast } = useToastContext();

  const { refetch: downloadFromUrl } = useCodeOutputDownload(href);

  const handleDownload = async (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    event.preventDefault();
    try {
      if (isHttpDownloadTarget(href)) {
        triggerDownload(href, filename);
        return;
      }

      const stream = await downloadFromUrl();
      if (stream.data == null || stream.data === '') {
        console.error('Error downloading file: No data found');
        showToast({
          status: 'error',
          message: 'Error downloading file',
        });
        return;
      }
      triggerDownload(stream.data, filename);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return { handleDownload };
};

const LogLink: React.FC<LogLinkProps> = ({ href, filename, file_id, children }) => {
  const { handleDownload } = useAttachmentLink({ href, filename, file_id });
  return (
    <a
      href={href}
      onClick={handleDownload}
      target="_blank"
      rel="noopener noreferrer"
      className="!text-blue-400 visited:!text-purple-400 hover:underline"
    >
      {children}
    </a>
  );
};

export default LogLink;
