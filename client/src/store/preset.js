import { atom } from 'recoil';
const defaultPreset = atom({
    key: 'defaultPreset',
    default: null,
});
const presetModalVisible = atom({
    key: 'presetModalVisible',
    default: false,
});
export default {
    defaultPreset,
    presetModalVisible,
};
