/**
 * Centralized mapping for role localizations
 * Maps role IDs to their localization keys
 */
export const ROLE_LOCALIZATIONS = {
    agent_viewer: {
        name: 'com_ui_role_viewer',
        description: 'com_ui_role_viewer_desc',
    },
    agent_editor: {
        name: 'com_ui_role_editor',
        description: 'com_ui_role_editor_desc',
    },
    agent_manager: {
        name: 'com_ui_role_manager',
        description: 'com_ui_role_manager_desc',
    },
    agent_owner: {
        name: 'com_ui_role_owner',
        description: 'com_ui_role_owner_desc',
    },
    // PromptGroup roles
    promptGroup_viewer: {
        name: 'com_ui_role_viewer',
        description: 'com_ui_role_viewer_desc',
    },
    promptGroup_editor: {
        name: 'com_ui_role_editor',
        description: 'com_ui_role_editor_desc',
    },
    promptGroup_owner: {
        name: 'com_ui_role_owner',
        description: 'com_ui_role_owner_desc',
    },
    // MCPServer roles
    mcpServer_viewer: {
        name: 'com_ui_mcp_server_role_viewer',
        description: 'com_ui_mcp_server_role_viewer_desc',
    },
    mcpServer_editor: {
        name: 'com_ui_mcp_server_role_editor',
        description: 'com_ui_mcp_server_role_editor_desc',
    },
    mcpServer_owner: {
        name: 'com_ui_mcp_server_role_owner',
        description: 'com_ui_mcp_server_role_owner_desc',
    },
    remoteAgent_viewer: {
        name: 'com_ui_remote_agent_role_viewer',
        description: 'com_ui_remote_agent_role_viewer_desc',
    },
    remoteAgent_editor: {
        name: 'com_ui_remote_agent_role_editor',
        description: 'com_ui_remote_agent_role_editor_desc',
    },
    remoteAgent_owner: {
        name: 'com_ui_remote_agent_role_owner',
        description: 'com_ui_remote_agent_role_owner_desc',
    },
    // Skill roles — reuse the generic role names; descriptions are skill-specific.
    skill_viewer: {
        name: 'com_ui_role_viewer',
        description: 'com_ui_skill_role_viewer_desc',
    },
    skill_editor: {
        name: 'com_ui_role_editor',
        description: 'com_ui_skill_role_editor_desc',
    },
    skill_owner: {
        name: 'com_ui_role_owner',
        description: 'com_ui_skill_role_owner_desc',
    },
    // Shared link roles
    sharedLink_viewer: {
        name: 'com_ui_role_viewer',
        description: 'com_ui_role_viewer_desc',
    },
    sharedLink_owner: {
        name: 'com_ui_role_owner',
        description: 'com_ui_role_owner_desc',
    },
};
/**
 * Get localization keys for a given role ID
 * @param roleId - The role ID to get localization keys for
 * @returns Object with name and description localization keys, or unknown keys if not found
 */
export const getRoleLocalizationKeys = (roleId) => {
    return ROLE_LOCALIZATIONS[roleId] || { name: 'com_ui_unknown', description: 'com_ui_unknown' };
};
