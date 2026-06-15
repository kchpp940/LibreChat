import React, { createContext, useContext, useMemo } from 'react';
function createFormContext() {
    const context = createContext(undefined);
    const useCustomFormContext = () => {
        const value = useContext(context);
        if (!value) {
            throw new Error('useCustomFormContext must be used within a CustomFormProvider');
        }
        return value;
    };
    const CustomFormProvider = ({ register, control, setValue, 
    // errors,
    getValues, handleSubmit, reset, children, }) => {
        const value = useMemo(() => ({ register, control, getValues, setValue, handleSubmit, reset }), [register, control, setValue, getValues, handleSubmit, reset]);
        return <context.Provider value={value}>{children}</context.Provider>;
    };
    return { CustomFormProvider, useCustomFormContext };
}
export { createFormContext };
