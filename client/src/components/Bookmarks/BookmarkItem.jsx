import { useState } from 'react';
import { Spinner } from '@librechat/client';
import { MenuItem } from '@headlessui/react';
import { BookmarkFilledIcon, BookmarkIcon } from '@radix-ui/react-icons';
const BookmarkItem = ({ tag, selected, handleSubmit, icon, ...rest }) => {
    const [isLoading, setIsLoading] = useState(false);
    const clickHandler = async () => {
        if (tag === 'New Bookmark') {
            handleSubmit();
            return;
        }
        setIsLoading(true);
        handleSubmit(tag);
        setIsLoading(false);
    };
    const breakWordStyle = {
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
    };
    const renderIcon = () => {
        if (icon != null) {
            return icon;
        }
        if (isLoading) {
            return <Spinner className="size-4"/>;
        }
        if (selected) {
            return <BookmarkFilledIcon aria-hidden="true" className="size-4"/>;
        }
        return <BookmarkIcon aria-hidden="true" className="size-4"/>;
    };
    return (<MenuItem aria-label={tag} className="group flex w-full gap-2 rounded-lg p-2.5 text-sm text-text-primary transition-colors duration-200 focus:outline-none data-[focus]:bg-surface-hover data-[focus-visible]:ring-2 data-[focus-visible]:ring-primary" {...rest} as="button" onClick={clickHandler}>
      <div className="flex grow items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {renderIcon()}
          <div style={breakWordStyle}>{tag}</div>
        </div>
      </div>
    </MenuItem>);
};
export default BookmarkItem;
