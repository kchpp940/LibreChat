import { useMemo, useRef, useEffect } from 'react';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import {
  EModelEndpoint,
  isModelInfoArray,
  findModelCapability,
  resolveCapability,
  stripUnsupportedByCapability,
  detectCapabilityChange,
  type TModelCapability,
  type TModelInfo,
  type StripTarget,
} from 'librechat-data-provider';

export { detectCapabilityChange, stripUnsupportedByCapability };
export type { StripTarget };

export function useCapabilityStripper(
  capability: TModelCapability | null,
  target: StripTarget | null,
): StripTarget | null {
  return useMemo(() => {
    if (!capability || !target) {
      return target;
    }
    return stripUnsupportedByCapability(target, capability);
  }, [capability, target]);
}

export function useCapabilityChange(
  capability: TModelCapability | null,
  onStrip: (change: {
    needStripVision: boolean;
    needStripTools: boolean;
    needStripFileSearch: boolean;
    needStripParams: boolean;
  }) => void,
  deps: React.DependencyList = [],
) {
  const prevCapability = useRef<TModelCapability | null>(null);

  useEffect(() => {
    if (!capability) {
      prevCapability.current = null;
      return;
    }
    const change = detectCapabilityChange(prevCapability.current, capability);
    prevCapability.current = capability;
    const needAction =
      change.needStripVision ||
      change.needStripTools ||
      change.needStripFileSearch ||
      change.needStripParams;
    if (needAction) {
      onStrip(change);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capability, ...deps]);
}

export default function useModelCapability(
  endpoint: string | null | undefined,
  model: string | null | undefined,
  endpointType?: string | null,
): TModelCapability | null {
  const modelsQuery = useGetModelsQuery();

  const resolvedEndpoint = endpointType ?? endpoint ?? EModelEndpoint.custom;

  const capability = useMemo(() => {
    if (!resolvedEndpoint) {
      return null;
    }

    const endpointModels = modelsQuery.data?.[resolvedEndpoint];
    if (isModelInfoArray(endpointModels as unknown as string[] | TModelInfo[] | undefined)) {
      const found = findModelCapability(endpointModels, model);
      if (found) {
        return found;
      }
    }

    return resolveCapability({
      endpoint: resolvedEndpoint,
      model: model ?? '',
    });
  }, [resolvedEndpoint, model, modelsQuery.data]);

  return capability;
}
