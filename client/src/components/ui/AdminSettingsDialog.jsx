import { useEffect, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { ShieldEllipsis } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { Permissions, SystemRoles } from 'librechat-data-provider';
import { OGDialog, OGDialogTitle, OGDialogContent, OGDialogTrigger, Button, Switch, DropdownPopup, } from '@librechat/client';
import { useLocalize, useAuthContext, useRoleSelector } from '~/hooks';
const LabelController = ({ control, permission, label, onConfirm, }) => (<div className="mb-4 flex items-center justify-between gap-2">
    {label}
    <Controller name={permission} control={control} render={({ field }) => (<Switch {...field} checked={field.value} onCheckedChange={(val) => {
            if (val === false && onConfirm) {
                onConfirm(val, field.onChange);
            }
            else {
                field.onChange(val);
            }
        }} value={field.value?.toString()} aria-label={label}/>)}/>
  </div>);
const AdminSettingsDialog = ({ permissionType, sectionKey, permissions, menuId, mutation, showAdminWarning = true, trigger, dialogContentClassName, onPermissionConfirm, confirmPermissions = [], extraContent, }) => {
    const localize = useLocalize();
    const { user } = useAuthContext();
    const { mutate, isLoading } = mutation;
    const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
    const { selectedRole, isSelectedCustomRole, isCustomRoleLoading, isCustomRoleError, defaultValues, roleDropdownItems, } = useRoleSelector(permissionType);
    const { reset, control, setValue, getValues, handleSubmit, formState: { isSubmitting }, } = useForm({
        mode: 'onChange',
        defaultValues,
    });
    useEffect(() => {
        if (isSelectedCustomRole && (isCustomRoleLoading || isCustomRoleError)) {
            return;
        }
        reset(defaultValues);
    }, [isSelectedCustomRole, isCustomRoleLoading, isCustomRoleError, defaultValues, reset]);
    if (user?.role !== SystemRoles.ADMIN) {
        return null;
    }
    const onSubmit = (data) => {
        mutate({ roleName: selectedRole, updates: data });
    };
    const defaultTrigger = (<Button size="sm" variant="outline" className="relative h-9 w-full gap-2 rounded-lg border-border-light font-medium focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary" aria-label={localize('com_ui_admin_settings')}>
      <ShieldEllipsis className="size-5 cursor-pointer" aria-hidden="true"/>
      {localize('com_ui_admin_settings')}
    </Button>);
    return (<>
      <OGDialog>
        <OGDialogTrigger asChild>{trigger ?? defaultTrigger}</OGDialogTrigger>
        <OGDialogContent className={dialogContentClassName ??
            'w-11/12 max-w-lg border-border-light bg-surface-primary text-text-primary'}>
          <OGDialogTitle>
            {localize('com_ui_admin_settings_section', { section: localize(sectionKey) })}
          </OGDialogTitle>

          {/* Role selection dropdown */}
          <div className="flex items-center gap-2">
            <span className="font-medium">{localize('com_ui_role_select')}:</span>
            <DropdownPopup unmountOnHide={true} menuId={menuId} isOpen={isRoleMenuOpen} setIsOpen={setIsRoleMenuOpen} trigger={<Ariakit.MenuButton className="inline-flex min-w-[6rem] items-center justify-center rounded-lg border border-border-light bg-transparent px-2 py-1 text-text-primary transition-all ease-in-out hover:bg-surface-tertiary">
                  {selectedRole}
                </Ariakit.MenuButton>} items={roleDropdownItems} itemClassName="items-center justify-center" sameWidth={true}/>
          </div>
          {/* Permissions form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="py-5">
              {permissions.map(({ permission, labelKey }) => {
            const label = localize(labelKey);
            const needsConfirm = selectedRole === SystemRoles.ADMIN &&
                confirmPermissions.includes(permission) &&
                onPermissionConfirm;
            return (<div key={permission}>
                    <LabelController control={control} permission={permission} label={label} getValues={getValues} setValue={setValue} onConfirm={needsConfirm
                    ? (newValue, onChange) => onPermissionConfirm(permission, newValue, onChange)
                    : undefined}/>
                    {showAdminWarning &&
                    selectedRole === SystemRoles.ADMIN &&
                    permission === Permissions.USE && (<div className="mb-2 max-w-full whitespace-normal break-words text-sm text-red-600">
                          <span>{localize('com_ui_admin_access_warning')}</span>
                          {'\n'}
                          <a href="https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/interface" target="_blank" rel="noreferrer" className="text-blue-500 underline">
                            {localize('com_ui_more_info')}
                          </a>
                        </div>)}
                  </div>);
        })}
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="submit" disabled={isSubmitting ||
            isLoading ||
            (isSelectedCustomRole && (isCustomRoleLoading || isCustomRoleError))} aria-label={localize('com_ui_save')}>
                {localize('com_ui_save')}
              </Button>
            </div>
          </form>
        </OGDialogContent>
      </OGDialog>
      {extraContent}
    </>);
};
export default AdminSettingsDialog;
