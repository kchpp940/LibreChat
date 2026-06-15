import { LocalStorageKeys } from 'librechat-data-provider';
export default function useSetFilesToDelete() {
    const setFilesToDelete = (files) => localStorage.setItem(LocalStorageKeys.FILES_TO_DELETE, JSON.stringify(files));
    return setFilesToDelete;
}
