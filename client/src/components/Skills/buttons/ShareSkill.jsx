import { memo } from 'react';
import { Share2Icon } from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import { Permissions, ResourceType, PermissionTypes } from 'librechat-data-provider';
import { useHasAccess, useLocalize, useSkillPermissions } from '~/hooks';
import { GenericGrantAccessDialog } from '~/components/Sharing';
function ShareSkill({ skill, disabled }) {
    const localize = useLocalize();
    const permissions = useSkillPermissions(skill);
    const hasAccessToShareSkills = useHasAccess({
        permissionType: PermissionTypes.SKILLS,
        permission: Permissions.SHARE,
    });
    if (permissions.isLoading || !hasAccessToShareSkills || !permissions.canShare) {
        return null;
    }
    return (<GenericGrantAccessDialog resourceDbId={skill._id} resourceName={skill.name} resourceType={ResourceType.SKILL} disabled={disabled}>
      <TooltipAnchor description={localize('com_ui_share')} side="bottom" render={<Button variant="outline" size="icon" className="size-9 border-border-medium" aria-label={localize('com_ui_share')} disabled={disabled}>
            <Share2Icon className="size-5" aria-hidden="true"/>
          </Button>}/>
    </GenericGrantAccessDialog>);
}
export default memo(ShareSkill);
