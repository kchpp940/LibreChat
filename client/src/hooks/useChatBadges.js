import { useMemo } from 'react';
import { useRecoilCallback } from 'recoil';
import { useRecoilValue } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';
const badgeConfig = [
// {
//   id: '1',
//   icon: Box,
//   label: 'com_ui_artifacts',
//   atom: store.codeArtifacts,
// },
// TODO: add more badges here (missing store atoms)
];
export default function useChatBadges() {
    const localize = useLocalize();
    const activeBadges = useRecoilValue(store.chatBadges);
    const activeBadgeIds = useMemo(() => new Set(activeBadges.map((badge) => badge.id)), [activeBadges]);
    const allBadges = useMemo(() => {
        return (badgeConfig.map((cfg) => ({
            id: cfg.id,
            label: localize(cfg.label),
            icon: cfg.icon,
            atom: cfg.atom,
            isAvailable: activeBadgeIds.has(cfg.id),
        })) || []);
    }, [activeBadgeIds, localize]);
    return allBadges;
}
export function useResetChatBadges() {
    return useRecoilCallback(({ reset }) => () => {
        badgeConfig.forEach(({ atom }) => reset(atom));
        reset(store.chatBadges);
    }, []);
}
