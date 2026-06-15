import React, { useRef } from 'react';
import { OGDialogTemplate, OGDialog, Button, Spinner, useToastContext } from '@librechat/client';
import { useConversationTagMutation } from '~/data-provider';
import { NotificationSeverity } from '~/common';
import BookmarkForm from './BookmarkForm';
import { useLocalize } from '~/hooks';
import { logger } from '~/utils';
const BookmarkEditDialog = ({ open, setOpen, tags, setTags, context, bookmark, children, triggerRef, conversationId, }) => {
    const localize = useLocalize();
    const formRef = useRef(null);
    const { showToast } = useToastContext();
    const mutation = useConversationTagMutation({
        context,
        tag: bookmark?.tag,
        options: {
            onSuccess: (_data, vars) => {
                showToast({
                    message: bookmark
                        ? localize('com_ui_bookmarks_update_success')
                        : localize('com_ui_bookmarks_create_success'),
                });
                setOpen(false);
                logger.log('tag_mutation', 'tags before setting', tags);
                if (setTags && vars.addToConversation === true) {
                    const newTags = [...(tags || []), vars.tag].filter((tag) => tag !== undefined);
                    setTags(newTags);
                    logger.log('tag_mutation', 'tags after', newTags);
                    if (vars.tag == null || vars.tag === '') {
                        return;
                    }
                    setTimeout(() => {
                        const tagElement = document.getElementById(vars.tag ?? '');
                        console.log('tagElement', tagElement);
                        if (!tagElement) {
                            return;
                        }
                        tagElement.focus();
                    }, 5);
                }
            },
            onError: () => {
                showToast({
                    message: bookmark
                        ? localize('com_ui_bookmarks_update_error')
                        : localize('com_ui_bookmarks_create_error'),
                    severity: NotificationSeverity.ERROR,
                });
            },
        },
    });
    const handleSubmitForm = () => {
        if (formRef.current) {
            formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    };
    return (<OGDialog open={open} onOpenChange={setOpen} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate title={bookmark ? localize('com_ui_bookmarks_edit') : localize('com_ui_bookmarks_new')} showCloseButton={false} className="w-11/12 md:max-w-lg" main={<BookmarkForm tags={tags} setOpen={setOpen} mutation={mutation} conversationId={conversationId} bookmark={bookmark} formRef={formRef}/>} buttons={<Button variant="submit" type="submit" disabled={mutation.isLoading} onClick={handleSubmitForm} className="text-white">
            {mutation.isLoading ? <Spinner /> : localize('com_ui_save')}
          </Button>}/>
    </OGDialog>);
};
export default BookmarkEditDialog;
