import { atom } from 'recoil';
const user = atom({
    key: 'user',
    default: undefined,
});
const availableTools = atom({
    key: 'availableTools',
    default: {},
});
export default {
    user,
    availableTools,
};
