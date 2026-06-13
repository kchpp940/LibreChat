import { useMemo } from 'react';
import {
  getSettingsKeys,
  presetSettings,
  filterSettingsByCapability,
  applyModelAwareDefaults,
} from 'librechat-data-provider';
import type { SettingDefinition, TModelCapability } from 'librechat-data-provider';
import type { TModelSelectProps } from '~/common';
import { componentMapping } from '~/components/SidePanel/Parameters/components';
import { useModelCapability } from '~/hooks';

export default function AnthropicSettings({
  conversation,
  setOption,
  models,
  readonly,
}: TModelSelectProps) {
  const endpoint = conversation?.endpointType ?? conversation?.endpoint ?? '';
  const model = conversation?.model ?? '';
  const capability = useModelCapability(conversation?.endpoint, conversation?.model, conversation?.endpointType);

  const parameters = useMemo(() => {
    const [combinedKey, endpointKey] = getSettingsKeys(endpoint, model);
    return presetSettings[combinedKey] ?? presetSettings[endpointKey] ?? null;
  }, [endpoint, model]);

  if (!parameters) {
    return null;
  }
  const filtered = {
    col1: filterSettingsByCapability(applyModelAwareDefaults(parameters.col1, endpoint, model), capability),
    col2: filterSettingsByCapability(applyModelAwareDefaults(parameters.col2, endpoint, model), capability),
  };

  const renderComponent = (setting: SettingDefinition | undefined) => {
    if (!setting) {
      return null;
    }
    const Component = componentMapping[setting.component];
    if (!Component) {
      return null;
    }
    const { key, default: defaultValue, ...rest } = setting;

    const props = {
      key,
      settingKey: key,
      defaultValue,
      ...rest,
      readonly,
      setOption,
      conversation,
    };

    if (key === 'model') {
      return <Component {...props} options={models} />;
    }

    return <Component {...props} />;
  };

  return (
    <div className="h-auto max-w-full overflow-x-hidden p-3">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="flex flex-col gap-6 md:col-span-3">
          {filtered.col1.map(renderComponent)}
        </div>
        <div className="flex flex-col gap-6 md:col-span-2">
          {filtered.col2.map(renderComponent)}
        </div>
      </div>
    </div>
  );
}
