import { useForm, FormProvider } from 'react-hook-form';
import { createContext, useContext } from 'react';
import { defaultAssistantFormValues } from 'librechat-data-provider';
export const AssistantsContext = createContext({});
export function useAssistantsContext() {
    const context = useContext(AssistantsContext);
    if (context === undefined) {
        throw new Error('useAssistantsContext must be used within an AssistantsProvider');
    }
    return context;
}
export default function AssistantsProvider({ children }) {
    const methods = useForm({
        defaultValues: defaultAssistantFormValues,
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
}
