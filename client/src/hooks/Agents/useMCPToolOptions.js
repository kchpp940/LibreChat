import { useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
export default function useMCPToolOptions() {
    const { getValues, setValue, control } = useFormContext();
    const formToolOptions = useWatch({ control, name: 'tool_options' });
    const isToolDeferred = useCallback((toolId) => formToolOptions?.[toolId]?.defer_loading === true, [formToolOptions]);
    const isToolProgrammatic = useCallback((toolId) => formToolOptions?.[toolId]?.allowed_callers?.includes('code_execution') === true, [formToolOptions]);
    const toggleToolDefer = useCallback((toolId) => {
        const currentOptions = getValues('tool_options') || {};
        const currentToolOptions = currentOptions[toolId] || {};
        const newDeferred = !currentToolOptions.defer_loading;
        const updatedOptions = { ...currentOptions };
        if (newDeferred) {
            updatedOptions[toolId] = {
                ...currentToolOptions,
                defer_loading: true,
            };
        }
        else {
            const { defer_loading: _, ...restOptions } = currentToolOptions;
            if (Object.keys(restOptions).length === 0) {
                delete updatedOptions[toolId];
            }
            else {
                updatedOptions[toolId] = restOptions;
            }
        }
        setValue('tool_options', updatedOptions, { shouldDirty: true });
    }, [getValues, setValue]);
    const toggleToolProgrammatic = useCallback((toolId) => {
        const currentOptions = getValues('tool_options') || {};
        const currentToolOptions = currentOptions[toolId] || {};
        const currentCallers = currentToolOptions.allowed_callers || [];
        const isProgrammatic = currentCallers.includes('code_execution');
        const updatedOptions = { ...currentOptions };
        if (isProgrammatic) {
            const newCallers = currentCallers.filter((c) => c !== 'code_execution');
            if (newCallers.length === 0) {
                const { allowed_callers: _, ...restOptions } = currentToolOptions;
                if (Object.keys(restOptions).length === 0) {
                    delete updatedOptions[toolId];
                }
                else {
                    updatedOptions[toolId] = restOptions;
                }
            }
            else {
                updatedOptions[toolId] = {
                    ...currentToolOptions,
                    allowed_callers: newCallers,
                };
            }
        }
        else {
            updatedOptions[toolId] = {
                ...currentToolOptions,
                allowed_callers: ['code_execution'],
            };
        }
        setValue('tool_options', updatedOptions, { shouldDirty: true });
    }, [getValues, setValue]);
    const areAllToolsDeferred = useCallback((tools) => tools.length > 0 &&
        tools.every((tool) => formToolOptions?.[tool.tool_id]?.defer_loading === true), [formToolOptions]);
    const areAllToolsProgrammatic = useCallback((tools) => tools.length > 0 &&
        tools.every((tool) => formToolOptions?.[tool.tool_id]?.allowed_callers?.includes('code_execution') === true), [formToolOptions]);
    const toggleDeferAll = useCallback((tools) => {
        if (tools.length === 0)
            return;
        const shouldDefer = !areAllToolsDeferred(tools);
        const currentOptions = getValues('tool_options') || {};
        const updatedOptions = { ...currentOptions };
        for (const tool of tools) {
            if (shouldDefer) {
                updatedOptions[tool.tool_id] = {
                    ...(updatedOptions[tool.tool_id] || {}),
                    defer_loading: true,
                };
            }
            else {
                if (updatedOptions[tool.tool_id]) {
                    delete updatedOptions[tool.tool_id].defer_loading;
                    if (Object.keys(updatedOptions[tool.tool_id]).length === 0) {
                        delete updatedOptions[tool.tool_id];
                    }
                }
            }
        }
        setValue('tool_options', updatedOptions, { shouldDirty: true });
    }, [getValues, setValue, areAllToolsDeferred]);
    const toggleProgrammaticAll = useCallback((tools) => {
        if (tools.length === 0)
            return;
        const shouldBeProgrammatic = !areAllToolsProgrammatic(tools);
        const currentOptions = getValues('tool_options') || {};
        const updatedOptions = { ...currentOptions };
        for (const tool of tools) {
            const currentToolOptions = updatedOptions[tool.tool_id] || {};
            if (shouldBeProgrammatic) {
                updatedOptions[tool.tool_id] = {
                    ...currentToolOptions,
                    allowed_callers: ['code_execution'],
                };
            }
            else {
                if (updatedOptions[tool.tool_id]) {
                    delete updatedOptions[tool.tool_id].allowed_callers;
                    if (Object.keys(updatedOptions[tool.tool_id]).length === 0) {
                        delete updatedOptions[tool.tool_id];
                    }
                }
            }
        }
        setValue('tool_options', updatedOptions, { shouldDirty: true });
    }, [getValues, setValue, areAllToolsProgrammatic]);
    return {
        formToolOptions,
        isToolDeferred,
        isToolProgrammatic,
        toggleToolDefer,
        toggleToolProgrammatic,
        areAllToolsDeferred,
        areAllToolsProgrammatic,
        toggleDeferAll,
        toggleProgrammaticAll,
    };
}
