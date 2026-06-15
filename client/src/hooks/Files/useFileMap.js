import { useGetFiles } from '~/data-provider';
import { mapFiles } from '~/utils';
export default function useFileMap({ isAuthenticated }) {
    const { data: fileMap } = useGetFiles({
        select: mapFiles,
        enabled: isAuthenticated,
    });
    return fileMap;
}
