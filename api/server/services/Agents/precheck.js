const { logger } = require('@librechat/data-schemas');
const {
  Tools,
  Constants,
  isActionTool,
  EModelEndpoint,
  AgentCapabilities,
} = require('librechat-data-provider');
const {
  createMCPPermissionContext,
  resolveConfigServers,
  userCanUseMCPServers,
  getServerConnectionStatus,
} = require('~/server/services/MCP');
const { getMCPServersRegistry, getMCPManager } = require('~/config');
const { getCachedTools } = require('~/server/services/Config');
const { getModelsConfig } = require('~/server/controllers/ModelController');
const {
  filterAuthorizedTools,
  classifyAgentReferences,
  isSubagentsCapabilityEnabled,
} = require('~/server/controllers/agents/v1');
const { collectEdgeAgentIds } = require('@librechat/data-schemas');
const { getResourcePermissionsMap } = require('~/server/services/PermissionService');
const { PermissionBits, ResourceType } = require('librechat-data-provider');
const db = require('~/models');

const PrecheckSeverity = {
  ERROR: 'error',
  WARNING: 'warning',
};

const PrecheckCategory = {
  REQUIRED_FIELDS: 'required_fields',
  MODEL_AVAILABILITY: 'model_availability',
  TOOL_PERMISSIONS: 'tool_permissions',
  MCP_STATUS: 'mcp_status',
  FILE_INDEX: 'file_index',
  AGENT_REFERENCES: 'agent_references',
};

const PrecheckCode = {
  REQUIRED_NAME_MISSING: 'required.name_missing',
  REQUIRED_PROVIDER_MISSING: 'required.provider_missing',
  REQUIRED_MODEL_MISSING: 'required.model_missing',
  REQUIRED_CATEGORY_EMPTY: 'required.category_empty',
  REQUIRED_INSTRUCTIONS_EMPTY: 'required.instructions_empty',
  MODEL_CONFIG_NOT_LOADED: 'model.config_not_loaded',
  MODEL_PROVIDER_UNAVAILABLE: 'model.provider_unavailable',
  MODEL_NOT_AVAILABLE: 'model.not_available',
  MODEL_VERIFY_FAILED: 'model.verify_failed',
  TOOL_NOT_AVAILABLE: 'tool.not_available',
  TOOL_MCP_PERMISSION_DENIED: 'tool.mcp_permission_denied',
  TOOL_MCP_REGISTRY_UNAVAILABLE: 'tool.mcp_registry_unavailable',
  TOOL_MCP_CONFIG_LOAD_FAILED: 'tool.mcp_config_load_failed',
  TOOL_MCP_MALFORMED_KEY: 'tool.mcp_malformed_key',
  TOOL_MCP_SERVER_NOT_ACCESSIBLE: 'tool.mcp_server_not_accessible',
  TOOL_VERIFY_FAILED: 'tool.verify_failed',
  MCP_NO_CONNECTION: 'mcp.no_connection',
  MCP_DISCONNECTED: 'mcp.disconnected',
  MCP_CONNECTING: 'mcp.connecting',
  MCP_OAUTH_FAILED: 'mcp.oauth_failed',
  MCP_OAUTH_REQUIRED: 'mcp.oauth_required',
  MCP_INSPECTION_FAILED: 'mcp.inspection_failed',
  MCP_STATUS_CHECK_FAILED: 'mcp.status_check_failed',
  FILE_NOT_FOUND: 'file.not_found',
  FILE_PERMISSION_DENIED: 'file.permission_denied',
  FILE_INDEX_PENDING: 'file.index_pending',
  FILE_INDEX_FAILED: 'file.index_failed',
  FILE_INDEX_SKIPPED: 'file.index_skipped',
  FILE_NOT_INDEXED: 'file.not_indexed',
  FILE_VERIFY_FAILED: 'file.verify_failed',
  SKILL_INVALID_ID: 'skill.invalid_id',
  SKILL_NOT_FOUND: 'skill.not_found',
  SKILL_PERMISSION_DENIED: 'skill.permission_denied',
  SKILL_VERIFY_FAILED: 'skill.verify_failed',
  AGENT_EDGE_MISSING: 'agent.edge_missing',
  AGENT_EDGE_UNAUTHORIZED: 'agent.edge_unauthorized',
  AGENT_SUBAGENT_MISSING: 'agent.subagent_missing',
  AGENT_SUBAGENT_UNAUTHORIZED: 'agent.subagent_unauthorized',
};

const systemTools = {
  [Tools.execute_code]: true,
  [Tools.file_search]: true,
  [Tools.web_search]: true,
};

const isMCPTool = (t) =>
  typeof t === 'string' && t.includes(Constants.mcp_delimiter) && !isActionTool(t);

function errorItem(category, code, message, options = {}) {
  return {
    category,
    severity: PrecheckSeverity.ERROR,
    code,
    message,
    ...options,
  };
}

function warningItem(category, code, message, options = {}) {
  return {
    category,
    severity: PrecheckSeverity.WARNING,
    code,
    message,
    ...options,
  };
}

async function checkRequiredFields(data) {
  const items = [];
  if (!data.name) {
    items.push(errorItem(
      PrecheckCategory.REQUIRED_FIELDS,
      PrecheckCode.REQUIRED_NAME_MISSING,
      'Agent name is required',
      { field: 'name' },
    ));
  }
  if (!data.provider) {
    items.push(errorItem(
      PrecheckCategory.REQUIRED_FIELDS,
      PrecheckCode.REQUIRED_PROVIDER_MISSING,
      'Provider is required',
      { field: 'provider' },
    ));
  }
  if (!data.model) {
    items.push(errorItem(
      PrecheckCategory.REQUIRED_FIELDS,
      PrecheckCode.REQUIRED_MODEL_MISSING,
      'Model is required',
      { field: 'model' },
    ));
  }
  if (!data.category) {
    items.push(warningItem(
      PrecheckCategory.REQUIRED_FIELDS,
      PrecheckCode.REQUIRED_CATEGORY_EMPTY,
      'Category is not set — will default to "general"',
      { field: 'category' },
    ));
  }
  if (!data.instructions) {
    items.push(warningItem(
      PrecheckCategory.REQUIRED_FIELDS,
      PrecheckCode.REQUIRED_INSTRUCTIONS_EMPTY,
      'System instructions are empty — the agent may not behave as expected',
      { field: 'instructions' },
    ));
  }
  return items;
}

async function checkModelAvailability(data, req) {
  const items = [];
  if (!data.provider || !data.model) {
    return items;
  }
  try {
    const modelsConfig = await getModelsConfig(req);
    if (!modelsConfig) {
      items.push(errorItem(
        PrecheckCategory.MODEL_AVAILABILITY,
        PrecheckCode.MODEL_CONFIG_NOT_LOADED,
        'Models configuration not loaded',
        { field: 'model' },
      ));
      return items;
    }
    const availableModels = modelsConfig[data.provider];
    if (!availableModels) {
      items.push(errorItem(
        PrecheckCategory.MODEL_AVAILABILITY,
        PrecheckCode.MODEL_PROVIDER_UNAVAILABLE,
        `No models available for provider "${data.provider}"`,
        { detail: data.provider, field: 'provider' },
      ));
      return items;
    }
    const modelExists = availableModels.some((m) => m === data.model);
    if (!modelExists) {
      items.push(errorItem(
        PrecheckCategory.MODEL_AVAILABILITY,
        PrecheckCode.MODEL_NOT_AVAILABLE,
        `Model "${data.model}" is not available for provider "${data.provider}"`,
        { detail: `${data.provider}|${data.model}`, field: 'model' },
      ));
    }
  } catch (err) {
    items.push(warningItem(
      PrecheckCategory.MODEL_AVAILABILITY,
      PrecheckCode.MODEL_VERIFY_FAILED,
      'Could not verify model availability',
      { detail: err.message, field: 'model' },
    ));
  }
  return items;
}

async function checkToolPermissions(data, req) {
  const items = [];
  const tools = data.tools ?? [];
  if (tools.length === 0) {
    return items;
  }
  try {
    const availableTools = await getCachedTools().then((t) => t ?? {});
    const mcpTools = tools.filter(isMCPTool);
    const nonMcpTools = tools.filter((t) => !isMCPTool(t));

    for (const tool of nonMcpTools) {
      if (!availableTools[tool] && !systemTools[tool] && !isActionTool(tool)) {
        items.push(errorItem(
          PrecheckCategory.TOOL_PERMISSIONS,
          PrecheckCode.TOOL_NOT_AVAILABLE,
          `Tool "${tool}" is not available or not authorized`,
          { detail: tool, field: 'tools' },
        ));
      }
    }

    if (mcpTools.length === 0) {
      return items;
    }

    const mcpPermissionContext = createMCPPermissionContext(req);
    const canUseMCP = await mcpPermissionContext.canUseServers(req.user);
    if (!canUseMCP) {
      items.push(errorItem(
        PrecheckCategory.TOOL_PERMISSIONS,
        PrecheckCode.TOOL_MCP_PERMISSION_DENIED,
        'You do not have permission to use MCP servers',
        { field: 'tools' },
      ));
      return items;
    }

    let configServers;
    try {
      configServers = await resolveConfigServers(req);
    } catch (e) {
      items.push(warningItem(
        PrecheckCategory.MCP_STATUS,
        PrecheckCode.TOOL_MCP_REGISTRY_UNAVAILABLE,
        'MCP server registry is unavailable — cannot verify MCP tool access',
        { detail: e.message, field: 'tools' },
      ));
      return items;
    }

    let mcpServerConfigs;
    try {
      mcpServerConfigs =
        (req.user.role
          ? await getMCPServersRegistry().getAllServerConfigs(
              req.user.id,
              configServers,
              req.user.role,
            )
          : await getMCPServersRegistry().getAllServerConfigs(
              req.user.id,
              configServers,
            )) ?? {};
    } catch (e) {
      items.push(warningItem(
        PrecheckCategory.MCP_STATUS,
        PrecheckCode.TOOL_MCP_CONFIG_LOAD_FAILED,
        'MCP server configs could not be loaded — cannot verify MCP tool access',
        { detail: e.message, field: 'tools' },
      ));
      return items;
    }

    for (const tool of mcpTools) {
      const parts = tool.split(Constants.mcp_delimiter);
      if (parts.length !== 2) {
        items.push(errorItem(
          PrecheckCategory.TOOL_PERMISSIONS,
          PrecheckCode.TOOL_MCP_MALFORMED_KEY,
          `MCP tool key "${tool}" is malformed`,
          { detail: tool, field: 'tools' },
        ));
        continue;
      }
      const [, serverName] = parts;
      if (!serverName || !Object.hasOwn(mcpServerConfigs, serverName)) {
        items.push(errorItem(
          PrecheckCategory.TOOL_PERMISSIONS,
          PrecheckCode.TOOL_MCP_SERVER_NOT_ACCESSIBLE,
          `MCP server "${serverName}" is not accessible for tool "${tool}"`,
          { detail: tool, field: 'tools' },
        ));
      }
    }
  } catch (err) {
    items.push(warningItem(
      PrecheckCategory.TOOL_PERMISSIONS,
      PrecheckCode.TOOL_VERIFY_FAILED,
      'Could not verify tool permissions',
      { detail: err.message, field: 'tools' },
    ));
  }
  return items;
}

async function checkMCPStatus(data, req) {
  const items = [];
  const tools = data.tools ?? [];
  const mcpTools = tools.filter(isMCPTool);
  if (mcpTools.length === 0) {
    return items;
  }

  const serverNames = new Set(
    mcpTools
      .map((tool) => {
        const parts = tool.split(Constants.mcp_delimiter);
        return parts.length === 2 ? parts[1] : null;
      })
      .filter(Boolean),
  );

  if (serverNames.size === 0) {
    return items;
  }

  try {
    const mcpPermissionContext = createMCPPermissionContext(req);
    const canUseMCP = await mcpPermissionContext.canUseServers(req.user);
    if (!canUseMCP) {
      return items;
    }

    let configServers;
    try {
      configServers = await resolveConfigServers(req);
    } catch (e) {
      return items;
    }

    let mcpServerConfigs;
    try {
      mcpServerConfigs =
        (req.user.role
          ? await getMCPServersRegistry().getAllServerConfigs(
              req.user.id,
              configServers,
              req.user.role,
            )
          : await getMCPServersRegistry().getAllServerConfigs(
              req.user.id,
              configServers,
            )) ?? {};
    } catch (e) {
      return items;
    }

    const mcpManager = getMCPManager(req.user.id);
    let userConnections = new Map();
    let appConnections = new Map();
    let oauthServers = new Set();

    if (mcpManager) {
      try {
        userConnections = mcpManager.getUserConnections?.(req.user.id) || new Map();
      } catch (e) { /* ignore */ }
      try {
        appConnections = (await mcpManager.appConnections?.getLoaded?.()) || new Map();
      } catch (e) { /* ignore */ }
      try {
        oauthServers = (await mcpManager.getOAuthServers?.()) || new Set();
      } catch (e) { /* ignore */ }
    }

    for (const serverName of serverNames) {
      const config = mcpServerConfigs[serverName];
      if (!config) {
        continue;
      }

      try {
        const { requiresOAuth, connectionState } = await getServerConnectionStatus(
          req.user.id,
          serverName,
          config,
          appConnections,
          userConnections,
          oauthServers,
        );

        if (connectionState === 'disconnected') {
          if (requiresOAuth) {
            items.push(warningItem(
              PrecheckCategory.MCP_STATUS,
              PrecheckCode.MCP_OAUTH_REQUIRED,
              `MCP server "${serverName}" requires OAuth authorization`,
              { detail: serverName, field: 'tools' },
            ));
          } else {
            items.push(warningItem(
              PrecheckCategory.MCP_STATUS,
              PrecheckCode.MCP_DISCONNECTED,
              `MCP server "${serverName}" is disconnected`,
              { detail: serverName, field: 'tools' },
            ));
          }
        } else if (connectionState === 'connecting') {
          items.push(warningItem(
            PrecheckCategory.MCP_STATUS,
            PrecheckCode.MCP_CONNECTING,
            `MCP server "${serverName}" is connecting — may not be immediately available`,
            { detail: serverName, field: 'tools' },
          ));
        } else if (connectionState === 'error') {
          if (requiresOAuth) {
            items.push(warningItem(
              PrecheckCategory.MCP_STATUS,
              PrecheckCode.MCP_OAUTH_FAILED,
              `MCP server "${serverName}" OAuth authorization failed or expired`,
              { detail: serverName, field: 'tools' },
            ));
          } else {
            items.push(warningItem(
              PrecheckCategory.MCP_STATUS,
              PrecheckCode.MCP_INSPECTION_FAILED,
              `MCP server "${serverName}" connection inspection failed`,
              { detail: serverName, field: 'tools' },
            ));
          }
        }
      } catch (err) {
        items.push(warningItem(
          PrecheckCategory.MCP_STATUS,
          PrecheckCode.MCP_STATUS_CHECK_FAILED,
          `Could not verify MCP server "${serverName}" connection status`,
          { detail: err.message, field: 'tools' },
        ));
      }
    }
  } catch (err) {
    logger.warn('[precheck] MCP status check failed', err.message);
  }
  return items;
}

async function checkFileIndexStatus(data, req, existingAgentId) {
  const items = [];
  const toolResources = data.tool_resources;
  if (!toolResources) {
    return items;
  }

  const resourceKeys = ['file_search', 'context', 'execute_code', 'image_edit'];
  const allFileIds = [];
  const fileIdToResource = new Map();

  for (const key of resourceKeys) {
    const resource = toolResources[key];
    if (!resource) {
      continue;
    }
    const fileIds = resource.file_ids ?? [];
    for (const fileId of fileIds) {
      allFileIds.push(fileId);
      if (!fileIdToResource.has(fileId)) {
        fileIdToResource.set(fileId, []);
      }
      fileIdToResource.get(fileId).push(key);
    }
  }

  if (allFileIds.length === 0) {
    return items;
  }

  try {
    const files = await db.getFiles({ file_id: { $in: allFileIds } }, null, {
      file_id: 1,
      embedded: 1,
      filename: 1,
      user: 1,
      status: 1,
    });

    const filesById = new Map((files ?? []).map((f) => [f.file_id, f]));
    const fileStatuses = [];

    for (const fileId of allFileIds) {
      const file = filesById.get(fileId);
      const resources = fileIdToResource.get(fileId);
      if (!file) {
        fileStatuses.push({
          fileId,
          status: 'not_found',
          resources,
        });
        continue;
      }

      if (String(file.user) !== String(req.user.id)) {
        fileStatuses.push({
          fileId,
          status: 'permission_denied',
          filename: file.filename,
          resources,
        });
        continue;
      }

      if (file.status === 'failed') {
        fileStatuses.push({
          fileId,
          status: 'failed',
          filename: file.filename,
          resources,
        });
      } else if (file.status === 'pending') {
        fileStatuses.push({
          fileId,
          status: 'pending',
          filename: file.filename,
          resources,
        });
      } else if (file.embedded !== true) {
        fileStatuses.push({
          fileId,
          status: 'skipped',
          filename: file.filename,
          resources,
        });
      } else {
        fileStatuses.push({
          fileId,
          status: 'indexed',
          filename: file.filename,
          resources,
        });
      }
    }

    const notFound = fileStatuses.filter((f) => f.status === 'not_found');
    const permissionDenied = fileStatuses.filter((f) => f.status === 'permission_denied');
    const pending = fileStatuses.filter((f) => f.status === 'pending');
    const failed = fileStatuses.filter((f) => f.status === 'failed');
    const skipped = fileStatuses.filter((f) => f.status === 'skipped');

    const affectedResources = new Set();
    for (const f of [...notFound, ...permissionDenied, ...pending, ...failed, ...skipped]) {
      for (const r of f.resources ?? []) {
        affectedResources.add(r);
      }
    }

    for (const f of notFound) {
      items.push(warningItem(
        PrecheckCategory.FILE_INDEX,
        PrecheckCode.FILE_NOT_FOUND,
        `File reference "${f.fileId}" no longer exists`,
        {
          detail: f.fileId,
          field: [...new Set(f.resources)].map((r) => `tool_resources.${r}`).join(', '),
        },
      ));
    }

    for (const f of permissionDenied) {
      items.push(errorItem(
        PrecheckCategory.FILE_INDEX,
        PrecheckCode.FILE_PERMISSION_DENIED,
        `You do not have permission to use file "${f.filename}"`,
        {
          detail: f.fileId,
          field: [...new Set(f.resources)].map((r) => `tool_resources.${r}`).join(', '),
        },
      ));
    }

    for (const f of pending) {
      items.push(warningItem(
        PrecheckCategory.FILE_INDEX,
        PrecheckCode.FILE_INDEX_PENDING,
        `File "${f.filename}" is still being indexed`,
        {
          detail: f.fileId,
          field: [...new Set(f.resources)].map((r) => `tool_resources.${r}`).join(', '),
        },
      ));
    }

    for (const f of failed) {
      items.push(warningItem(
        PrecheckCategory.FILE_INDEX,
        PrecheckCode.FILE_INDEX_FAILED,
        `File "${f.filename}" failed to index`,
        {
          detail: f.fileId,
          field: [...new Set(f.resources)].map((r) => `tool_resources.${r}`).join(', '),
        },
      ));
    }

    for (const f of skipped) {
      items.push(warningItem(
        PrecheckCategory.FILE_INDEX,
        PrecheckCode.FILE_INDEX_SKIPPED,
        `File "${f.filename}" was skipped during indexing`,
        {
          detail: f.fileId,
          field: [...new Set(f.resources)].map((r) => `tool_resources.${r}`).join(', '),
        },
      ));
    }
  } catch (err) {
    items.push(warningItem(
      PrecheckCategory.FILE_INDEX,
      PrecheckCode.FILE_VERIFY_FAILED,
      'Could not verify file index status',
      { detail: err.message, field: 'tool_resources' },
    ));
  }
  return items;
}

async function checkSkills(data, req) {
  const items = [];
  if (data.skills_enabled !== true) {
    return items;
  }

  const { isValidObjectIdString } = require('@librechat/data-schemas');

  const skillIds = Array.isArray(data.skills) ? data.skills : [];
  if (skillIds.length === 0) {
    return items;
  }

  const validSkillIds = [];
  for (const id of skillIds) {
    if (!isValidObjectIdString(id)) {
      items.push(errorItem(
        PrecheckCategory.TOOL_PERMISSIONS,
        PrecheckCode.SKILL_INVALID_ID,
        `Skill reference "${id}" is not a valid ID`,
        { detail: id, field: 'skills' },
      ));
    } else {
      validSkillIds.push(id);
    }
  }

  if (validSkillIds.length === 0) {
    return items;
  }

  try {
    const skills = await Promise.all(validSkillIds.map((id) => db.getSkillById(id)));
    const foundSkills = skills.filter(Boolean);
    const foundIds = new Set(foundSkills.map((s) => s._id.toString()));
    const missing = validSkillIds.filter((id) => !foundIds.has(id));

    for (const id of missing) {
      items.push(errorItem(
        PrecheckCategory.TOOL_PERMISSIONS,
        PrecheckCode.SKILL_NOT_FOUND,
        `Skill "${id}" referenced no longer exists`,
        { detail: id, field: 'skills' },
      ));
    }

    if (foundSkills.length > 0) {
      const permissionsMap = await getResourcePermissionsMap({
        userId: req.user.id,
        role: req.user.role,
        resourceType: ResourceType.SKILL,
        resourceIds: foundSkills.map((s) => s._id),
      });

      for (const skill of foundSkills) {
        const skillIdStr = skill._id.toString();
        const bits = permissionsMap.get(skillIdStr) ?? 0;
        if ((bits & PermissionBits.USE) === 0) {
          items.push(errorItem(
            PrecheckCategory.TOOL_PERMISSIONS,
            PrecheckCode.SKILL_PERMISSION_DENIED,
            `You do not have USE permission for skill "${skill.metadata?.display_name ?? skill.name ?? skill._id}"`,
            { detail: skillIdStr, field: 'skills' },
          ));
        }
      }
    }
  } catch (err) {
    logger.warn('[precheck] Skills validation failed', err.message);
    items.push(warningItem(
      PrecheckCategory.TOOL_PERMISSIONS,
      PrecheckCode.SKILL_VERIFY_FAILED,
      'Could not verify skill access permissions',
      { detail: err.message, field: 'skills' },
    ));
  }

  return items;
}

async function checkAgentReferences(data, req) {
  const items = [];
  const { id: userId, role: userRole } = req.user;

  const edgeAgentIdSet = collectEdgeAgentIds(data.edges);
  if (edgeAgentIdSet.size > 0) {
    const edgeAgentIds = [...edgeAgentIdSet].filter((id) => id !== data.agent_id);
    if (edgeAgentIds.length > 0) {
      const { missing, unauthorized } = await classifyAgentReferences(
        edgeAgentIds,
        userId,
        userRole,
      );

      for (const id of missing) {
        items.push(warningItem(
          PrecheckCategory.AGENT_REFERENCES,
          PrecheckCode.AGENT_EDGE_MISSING,
          `Edge references agent "${id}" which does not exist yet`,
          { detail: id, field: 'edges' },
        ));
      }

      for (const id of unauthorized) {
        items.push(errorItem(
          PrecheckCategory.AGENT_REFERENCES,
          PrecheckCode.AGENT_EDGE_UNAUTHORIZED,
          `You do not have access to agent "${id}" referenced in edges`,
          { detail: id, field: 'edges' },
        ));
      }
    }
  }

  const subagentsEnabled = isSubagentsCapabilityEnabled(req);
  if (
    subagentsEnabled &&
    data.subagents?.enabled === true &&
    data.subagents?.agent_ids?.length
  ) {
    const { missing, unauthorized } = await classifyAgentReferences(
      data.subagents.agent_ids,
      userId,
      userRole,
    );

    for (const id of missing) {
      items.push(errorItem(
        PrecheckCategory.AGENT_REFERENCES,
        PrecheckCode.AGENT_SUBAGENT_MISSING,
        `Subagent references agent "${id}" which does not exist`,
        { detail: id, field: 'subagents' },
      ));
    }

    for (const id of unauthorized) {
      items.push(errorItem(
        PrecheckCategory.AGENT_REFERENCES,
        PrecheckCode.AGENT_SUBAGENT_UNAUTHORIZED,
        `You do not have access to agent "${id}" referenced in subagents`,
        { detail: id, field: 'subagents' },
      ));
    }
  }

  return items;
}

async function performAgentPrecheck(data, req, existingAgentId) {
  const [required, model, tools, mcp, files, skills, agents] = await Promise.all([
    checkRequiredFields(data),
    checkModelAvailability(data, req),
    checkToolPermissions(data, req),
    checkMCPStatus(data, req),
    checkFileIndexStatus(data, req, existingAgentId),
    checkSkills(data, req),
    checkAgentReferences(data, req),
  ]);

  const allItems = [...required, ...model, ...tools, ...mcp, ...files, ...skills, ...agents];

  const blockingErrors = allItems.filter((item) => item.severity === PrecheckSeverity.ERROR);
  const warnings = allItems.filter((item) => item.severity === PrecheckSeverity.WARNING);

  return {
    valid: blockingErrors.length === 0,
    items: allItems,
    blockingErrors,
    warnings,
  };
}

module.exports = {
  PrecheckSeverity,
  PrecheckCategory,
  PrecheckCode,
  performAgentPrecheck,
};
