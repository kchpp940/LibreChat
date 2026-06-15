import React, { useState } from 'react';
const ApiErrorBoundaryContext = React.createContext(undefined);
export const ApiErrorBoundaryProvider = ({ value, children, }) => {
    const [error, setError] = useState(false);
    return (<ApiErrorBoundaryContext.Provider value={value ?? { error, setError }}>
      {children}
    </ApiErrorBoundaryContext.Provider>);
};
export const useApiErrorBoundary = () => {
    const context = React.useContext(ApiErrorBoundaryContext);
    if (context === undefined) {
        throw new Error('useApiErrorBoundary must be used inside ApiErrorBoundaryProvider');
    }
    return context;
};
