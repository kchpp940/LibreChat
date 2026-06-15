import { isJson } from '~/utils/json';
export default function useMultipleKeys(setUserKey) {
    function getMultiKey(name, userKey) {
        if (isJson(userKey)) {
            const newKey = JSON.parse(userKey);
            return newKey[name];
        }
        else {
            return '';
        }
    }
    function setMultiKey(name, value, userKey) {
        let newKey = {};
        if (isJson(userKey)) {
            newKey = JSON.parse(userKey);
        }
        newKey[name] = value;
        setUserKey(JSON.stringify(newKey));
    }
    return { getMultiKey, setMultiKey };
}
