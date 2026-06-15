import { specialVariables } from 'librechat-data-provider';
/**
 * Detects the presence of variables in the given text, excluding those found in `specialVariables`.
 */
export const detectVariables = (text) => {
    // Extract all variables with a simple regex
    const allVariablesRegex = /{{([^{}]+?)}}/gi;
    const matches = Array.from(text.matchAll(allVariablesRegex)).map((match) => match[1].trim().toLowerCase());
    // Check if any non-special variables exist
    return matches.some((variable) => !specialVariables[variable]);
};
export const wrapVariable = (variable) => `{{${variable}}}`;
export const extractUniqueVariables = (text) => {
    const regex = /{{(.*?)}}/g;
    let match;
    const variables = new Set();
    while ((match = regex.exec(text)) !== null) {
        variables.add(match[1]);
    }
    return Array.from(variables);
};
export const extractVariableInfo = (text) => {
    const regex = /{{(.*?)}}/g;
    let match;
    const allVariables = [];
    const uniqueVariables = [];
    const repeatedVariables = new Set();
    const variableCount = new Map();
    const variableIndexMap = new Map();
    while ((match = regex.exec(text)) !== null) {
        const variable = match[1];
        allVariables.push(variable);
        const count = variableCount.get(variable) ?? 0;
        variableCount.set(variable, count + 1);
        if (count > 0) {
            repeatedVariables.add(variable);
        }
        else {
            uniqueVariables.push(variable);
            variableIndexMap.set(variable, uniqueVariables.length - 1);
        }
    }
    return {
        allVariables,
        uniqueVariables,
        repeatedVariables,
        variableIndexMap,
    };
};
export function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedDate = `${month}/${day}/${year}`;
    const formattedTime = `${formattedHours}:${formattedMinutes}:${formattedSeconds} ${ampm}`;
    return `${formattedDate}, ${formattedTime}`;
}
export const mapPromptGroups = (groups) => {
    return groups.reduce((acc, group) => {
        if (!group._id) {
            return acc;
        }
        acc[group._id] = group;
        return acc;
    }, {});
};
