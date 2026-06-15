import { ComponentTypes } from 'librechat-data-provider';
import { DynamicCombobox, DynamicDropdown, DynamicCheckbox, DynamicTextarea, DynamicSlider, DynamicSwitch, DynamicInput, DynamicTags, } from './';
export const componentMapping = {
    [ComponentTypes.Slider]: DynamicSlider,
    [ComponentTypes.Dropdown]: DynamicDropdown,
    [ComponentTypes.Switch]: DynamicSwitch,
    [ComponentTypes.Textarea]: DynamicTextarea,
    [ComponentTypes.Input]: DynamicInput,
    [ComponentTypes.Checkbox]: DynamicCheckbox,
    [ComponentTypes.Tags]: DynamicTags,
    [ComponentTypes.Combobox]: DynamicCombobox,
};
