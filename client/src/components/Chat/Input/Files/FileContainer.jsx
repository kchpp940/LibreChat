import { getFileType, cn } from '~/utils';
import FilePreview from './FilePreview';
import RemoveFile from './RemoveFile';
const FileContainer = ({ file, overrideType, displayName, subtitle, buttonClassName, containerClassName, onDelete, onClick, }) => {
    const fileType = getFileType(overrideType ?? file.type);
    const visibleName = displayName ?? file.filename ?? '';
    return (<div className={cn('group relative inline-block text-sm text-text-primary', containerClassName)}>
      <button type="button" onClick={onClick} aria-label={visibleName} className={cn('relative overflow-hidden rounded-2xl border border-border-light bg-surface-hover-alt', buttonClassName)}>
        <div className="w-56 p-1.5">
          <div className="flex flex-row items-center gap-2">
            <FilePreview file={file} fileType={fileType} className="relative"/>
            <div className="overflow-hidden">
              <div className="truncate font-medium" title={visibleName}>
                {visibleName}
              </div>
              {subtitle != null ? (subtitle) : (<div className="truncate text-text-secondary" title={fileType.title}>
                  {fileType.title}
                </div>)}
            </div>
          </div>
        </div>
      </button>
      {onDelete && <RemoveFile onRemove={onDelete}/>}
    </div>);
};
export default FileContainer;
