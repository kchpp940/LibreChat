import { useForm, FormProvider } from 'react-hook-form';
import { createContext, useContext } from 'react';
import { getDefaultAgentFormValues } from '~/utils';
export const AgentsContext = createContext({});
export function useAgentsContext() {
    const context = useContext(AgentsContext);
    if (context === undefined) {
        throw new Error('useAgentsContext must be used within an AgentsProvider');
    }
    return context;
}
export default function AgentsProvider({ children }) {
    const methods = useForm({
        defaultValues: getDefaultAgentFormValues(),
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
}
