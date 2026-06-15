import { useMemo } from 'react';
import { ResourceType, PermissionBits, SystemRoles } from 'librechat-data-provider';
import useResourcePermissions from '~/hooks/useResourcePermissions';
import { useAuthContext } from '~/hooks/AuthContext';
/**
 * Single source of truth for per-skill permission checks. Used by every
 * edit/delete/share/file-tree UI so the permission model stays consistent.
 *
 * Precedence: owner or admin → full control. Otherwise falls back to the
 * ACL bits returned by `useResourcePermissions`.
 */
export default function useSkillPermissions(skill) {
    const { user } = useAuthContext();
    const { hasPermission, isLoading } = useResourcePermissions(ResourceType.SKILL, skill?._id ?? '');
    return useMemo(() => {
        const isOwner = skill != null && skill.author === user?.id;
        const isAdmin = user?.role === SystemRoles.ADMIN;
        const privileged = isOwner || isAdmin;
        return {
            isLoading,
            isOwner,
            isAdmin,
            canEdit: privileged || hasPermission(PermissionBits.EDIT),
            canDelete: privileged || hasPermission(PermissionBits.DELETE),
            canShare: privileged || hasPermission(PermissionBits.SHARE),
        };
    }, [skill, user?.id, user?.role, hasPermission, isLoading]);
}
