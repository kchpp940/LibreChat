import { useEffect, useMemo, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateMCPServerMutation, useUpdateMCPServerMutation, useDeleteMCPServerMutation, } from '~/data-provider/MCP';
import { useToastContext } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { extractServerNameFromUrl, isValidUrl, normalizeUrl } from '../utils/urlUtils';
// Auth type enum
export var AuthTypeEnum;
(function (AuthTypeEnum) {
    AuthTypeEnum["None"] = "none";
    AuthTypeEnum["ServiceHttp"] = "service_http";
    AuthTypeEnum["OAuth"] = "oauth";
    AuthTypeEnum["OBO"] = "obo";
})(AuthTypeEnum || (AuthTypeEnum = {}));
// Authorization type enum
export var AuthorizationTypeEnum;
(function (AuthorizationTypeEnum) {
    AuthorizationTypeEnum["Basic"] = "basic";
    AuthorizationTypeEnum["Bearer"] = "bearer";
    AuthorizationTypeEnum["Custom"] = "custom";
})(AuthorizationTypeEnum || (AuthorizationTypeEnum = {}));
export function useMCPServerForm({ server, onSuccess, onClose }) {
    const localize = useLocalize();
    const { showToast } = useToastContext();
    // Mutations
    const createMutation = useCreateMCPServerMutation();
    const updateMutation = useUpdateMCPServerMutation();
    const deleteMutation = useDeleteMCPServerMutation();
    // State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    // Check if editing existing server
    const isEditMode = !!server;
    // Default form values
    const defaultValues = useMemo(() => {
        if (server) {
            let authType = AuthTypeEnum.None;
            if ('obo' in server.config && server.config.obo) {
                authType = AuthTypeEnum.OBO;
            }
            else if (server.config.oauth) {
                authType = AuthTypeEnum.OAuth;
            }
            else if ('apiKey' in server.config && server.config.apiKey) {
                authType = AuthTypeEnum.ServiceHttp;
            }
            const apiKeyConfig = 'apiKey' in server.config ? server.config.apiKey : undefined;
            return {
                title: server.config.title || '',
                description: server.config.description || '',
                url: 'url' in server.config ? server.config.url : '',
                type: server.config.type || 'streamable-http',
                icon: server.config.iconPath || '',
                auth: {
                    auth_type: authType,
                    api_key: '', // Never pre-fill secrets
                    api_key_source: apiKeyConfig?.source || 'admin',
                    api_key_authorization_type: apiKeyConfig?.authorization_type ||
                        AuthorizationTypeEnum.Bearer,
                    api_key_custom_header: apiKeyConfig?.custom_header || '',
                    oauth_client_id: server.config.oauth?.client_id || '',
                    oauth_client_secret: '', // Never pre-fill secrets
                    oauth_authorization_url: server.config.oauth?.authorization_url || '',
                    oauth_token_url: server.config.oauth?.token_url || '',
                    oauth_scope: server.config.oauth?.scope || '',
                    obo_scopes: 'obo' in server.config && server.config.obo ? server.config.obo.scopes : '',
                    server_id: server.serverName,
                },
                trust: true, // Pre-checked for existing servers
            };
        }
        return {
            title: '',
            description: '',
            url: '',
            type: 'streamable-http',
            icon: '',
            auth: {
                auth_type: AuthTypeEnum.None,
                api_key: '',
                api_key_source: 'admin',
                api_key_authorization_type: AuthorizationTypeEnum.Bearer,
                api_key_custom_header: '',
                oauth_client_id: '',
                oauth_client_secret: '',
                oauth_authorization_url: '',
                oauth_token_url: '',
                oauth_scope: '',
                obo_scopes: '',
            },
            trust: false,
        };
    }, [server]);
    // Form instance
    const methods = useForm({
        defaultValues,
        mode: 'onChange',
    });
    const { reset, watch, setValue, getValues } = methods;
    // Watch URL for auto-fill
    const watchedUrl = watch('url');
    // Auto-fill title from URL when title is empty
    const handleUrlChange = useCallback((url) => {
        const currentTitle = getValues('title');
        if (!currentTitle && url) {
            const normalizedUrl = normalizeUrl(url);
            if (isValidUrl(normalizedUrl)) {
                const suggestedName = extractServerNameFromUrl(normalizedUrl);
                if (suggestedName) {
                    setValue('title', suggestedName, { shouldValidate: true });
                }
            }
        }
    }, [getValues, setValue]);
    // Watch for URL changes
    useEffect(() => {
        handleUrlChange(watchedUrl);
    }, [watchedUrl, handleUrlChange]);
    // Reset form when dialog opens
    const resetForm = useCallback(() => {
        reset(defaultValues);
    }, [reset, defaultValues]);
    // Handle form submission
    const onSubmit = methods.handleSubmit(async (formData) => {
        setIsSubmitting(true);
        try {
            const config = {
                type: formData.type,
                url: formData.url,
                title: formData.title,
                ...(formData.description && { description: formData.description }),
                ...(formData.icon && { iconPath: formData.icon }),
            };
            // Add OAuth configuration
            if (formData.auth.auth_type === AuthTypeEnum.OAuth &&
                (formData.auth.oauth_client_id ||
                    formData.auth.oauth_client_secret ||
                    formData.auth.oauth_authorization_url ||
                    formData.auth.oauth_token_url ||
                    formData.auth.oauth_scope)) {
                config.oauth = {
                    ...(formData.auth.oauth_client_id && { client_id: formData.auth.oauth_client_id }),
                    ...(formData.auth.oauth_client_secret && {
                        client_secret: formData.auth.oauth_client_secret,
                    }),
                    ...(formData.auth.oauth_authorization_url && {
                        authorization_url: formData.auth.oauth_authorization_url,
                    }),
                    ...(formData.auth.oauth_token_url && { token_url: formData.auth.oauth_token_url }),
                    ...(formData.auth.oauth_scope && { scope: formData.auth.oauth_scope }),
                };
            }
            // Add API Key configuration
            if (formData.auth.auth_type === AuthTypeEnum.ServiceHttp) {
                const source = formData.auth.api_key_source || 'admin';
                const authorizationType = formData.auth.api_key_authorization_type || 'bearer';
                config.apiKey = {
                    source,
                    authorization_type: authorizationType,
                    ...(source === 'admin' && formData.auth.api_key && { key: formData.auth.api_key }),
                    ...(authorizationType === 'custom' &&
                        formData.auth.api_key_custom_header && {
                        custom_header: formData.auth.api_key_custom_header,
                    }),
                };
            }
            if (formData.auth.auth_type === AuthTypeEnum.OBO && formData.auth.obo_scopes) {
                config.obo = { scopes: formData.auth.obo_scopes };
            }
            const params = { config };
            const result = server
                ? await updateMutation.mutateAsync({ serverName: server.serverName, data: params })
                : await createMutation.mutateAsync(params);
            showToast({
                message: server
                    ? localize('com_ui_mcp_server_updated')
                    : localize('com_ui_mcp_server_created'),
                status: 'success',
            });
            const isOAuth = formData.auth.auth_type === AuthTypeEnum.OAuth;
            onSuccess?.(result.serverName, isOAuth && !server);
        }
        catch (error) {
            let errorMessage = localize('com_ui_error');
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                if (axiosError.response?.data?.error === 'MCP_INSPECTION_FAILED') {
                    errorMessage = localize('com_ui_mcp_server_connection_failed');
                }
                else if (axiosError.response?.data?.error === 'MCP_DOMAIN_NOT_ALLOWED') {
                    errorMessage = localize('com_ui_mcp_domain_not_allowed');
                }
                else if (axiosError.response?.data?.error) {
                    errorMessage = axiosError.response.data.error;
                }
            }
            else if (error instanceof Error) {
                errorMessage = error.message;
            }
            showToast({
                message: errorMessage,
                status: 'error',
            });
        }
        finally {
            setIsSubmitting(false);
        }
    });
    // Handle delete
    const handleDelete = useCallback(async () => {
        if (!server) {
            return;
        }
        setIsDeleting(true);
        try {
            await deleteMutation.mutateAsync(server.serverName);
            showToast({
                message: localize('com_ui_mcp_server_deleted'),
                status: 'success',
            });
            onClose?.();
        }
        catch (error) {
            let errorMessage = localize('com_ui_error');
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error;
                if (axiosError.response?.data?.error) {
                    errorMessage = axiosError.response.data.error;
                }
            }
            else if (error instanceof Error) {
                errorMessage = error.message;
            }
            showToast({
                message: errorMessage,
                status: 'error',
            });
        }
        finally {
            setIsDeleting(false);
        }
    }, [server, deleteMutation, showToast, localize, onClose]);
    return {
        methods,
        isEditMode,
        isSubmitting,
        isDeleting,
        onSubmit,
        handleDelete,
        resetForm,
        server,
    };
}
