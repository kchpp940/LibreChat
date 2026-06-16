import { memo, useCallback, useEffect } from 'react';
import { useToastContext } from '@librechat/client';
import { useFormContext, useWatch } from 'react-hook-form';
import { mergeFileConfig, fileConfig as defaultFileConfig } from 'librechat-data-provider';
import type { AgentAvatar } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { AgentAvatarRender, NoImage, AvatarMenu } from './Images';
import { useGetFileConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { getAvatarUrl } from '~/utils';

function Avatar({ avatar }: { avatar: AgentAvatar | null }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { control, setValue } = useFormContext<AgentForm>();
  const avatarPreview = useWatch({ control, name: 'avatar_preview' }) ?? '';
  const avatarAction = useWatch({ control, name: 'avatar_action' });
  const { data: fileConfig = defaultFileConfig } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  // Derive whether agent has a remote avatar from the avatar prop
  const hasRemoteAvatar = Boolean(getAvatarUrl(avatar));

  useEffect(() => {
    if (avatarAction) {
      return;
    }

    if (getAvatarUrl(avatar) && avatarPreview !== getAvatarUrl(avatar)) {
      setValue('avatar_preview', getAvatarUrl(avatar));
    }

    if (!getAvatarUrl(avatar) && avatarPreview !== '') {
      setValue('avatar_preview', '');
    }
  }, [getAvatarUrl(avatar), avatarAction, avatarPreview, setValue]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const sizeLimit = fileConfig.avatarSizeLimit ?? 0;

      if (!file) {
        return;
      }

      if (sizeLimit && file.size > sizeLimit) {
        const limitInMb = sizeLimit / (1024 * 1024);
        const displayLimit = Number.isInteger(limitInMb)
          ? limitInMb
          : parseFloat(limitInMb.toFixed(1));
        showToast({
          message: localize('com_ui_upload_invalid_var', { 0: displayLimit }),
          status: 'error',
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setValue('avatar_file', file, { shouldDirty: true });
        setValue('avatar_preview', (reader.result as string) ?? '', { shouldDirty: true });
        setValue('avatar_action', 'upload', { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    },
    [fileConfig.avatarSizeLimit, localize, setValue, showToast],
  );

  const handleReset = useCallback(() => {
    const remoteAvatarExists = Boolean(getAvatarUrl(avatar));
    setValue('avatar_preview', '', { shouldDirty: true });
    setValue('avatar_file', null, { shouldDirty: true });
    setValue('avatar_action', remoteAvatarExists ? 'reset' : null, { shouldDirty: true });
  }, [getAvatarUrl(avatar), setValue]);

  const hasIcon = Boolean(avatarPreview) || hasRemoteAvatar;
  const canReset = hasIcon;

  return (
    <>
      <div className="flex w-full items-center justify-center gap-4">
        <AvatarMenu
          trigger={
            <button
              type="button"
              className="f h-20 w-20 outline-none ring-offset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={localize('com_ui_upload_agent_avatar_label')}
            >
              {avatarPreview ? <AgentAvatarRender url={avatarPreview} /> : <NoImage />}
            </button>
          }
          handleFileChange={handleFileChange}
          onReset={handleReset}
          canReset={canReset}
        />
      </div>
    </>
  );
}

const MemoizedAvatar = memo(
  Avatar,
  (prevProps, nextProps) => getAvatarUrl(prevProps.avatar) === getAvatarUrl(nextProps.avatar),
);
MemoizedAvatar.displayName = 'Avatar';

export default MemoizedAvatar;
