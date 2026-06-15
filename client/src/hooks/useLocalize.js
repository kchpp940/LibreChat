import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
export default function useLocalize() {
    const { t } = useTranslation();
    return useCallback((phraseKey, options) => t(phraseKey, options), [t]);
}
