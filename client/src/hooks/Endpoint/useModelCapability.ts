import { useMemo } from 'react';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { findModelCapability, type TModelCapability } from 'librechat-data-provider';

export default function useModelCapability(
  endpoint?: string | null,
  model?: string | null,
  endpointType?: string | null,
): TModelCapability | null {
  const { data: modelsConfig } = useGetModelsQuery();

  return useMemo(() => {
    const models = modelsConfig?.[endpoint ?? ''] ?? modelsConfig?.[endpointType ?? ''];
    return findModelCapability(models, model);
  }, [modelsConfig, endpoint, endpointType, model]);
}
