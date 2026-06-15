import React from 'react';
import { useApiErrorBoundary } from '~/hooks/ApiErrorBoundaryContext';
import { useNavigate } from 'react-router-dom';
import { isServerError } from 'librechat-data-provider';

const ApiErrorWatcher = () => {
  const { error } = useApiErrorBoundary();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (isServerError(error)) {
      // do something with error
      // navigate('/login');
    }
  }, [error, navigate]);

  return null;
};

export default ApiErrorWatcher;
