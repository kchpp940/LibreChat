const { logger } = require('@librechat/data-schemas');
const {
  Tools,
  Constants,
  isActionTool,
  EModelEndpoint,
  AgentCapabilities,
  isIndexed,
} = require('librechat-data-provider');

const {
  createMCPPermissionContext,
  resolveConfigServers,
  userCanUseMCPServers,
} = require('~/server/services/MCP');
const { getMCPServersRegistry, getMCPManager } = require('~/config');
const { getCachedTools } = require('~/server/services/Config');
const { getModelsConfig } = require('~/server/controllers/ModelController');
const { filterAuthorizedTools } = require('~/server/controllers/agents/v1');
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

const systemTools = {
  [Tools.execute_code]: true,
  [Tools.file_search]: true,
  [Tools.web_search]: true,
};

const isMCPTool = (t) =>
  typeof t === 'string' && t.includes(Constants.mcp_delimiter) && !isActionTool(t);

async function checkRequiredFields(data) {
  const items = [];
  if (!data.name) {
    items.push({
      category: PrecheckCategory.REQUIRED_FIELDS,
      severity: PrecheckSeverity.ERROR,
      message: 'Agent name is required',
      field: 'name',
    });
  }
  if (!data.provider) {
    items.push({
      category: PrecheckCategory.REQUIRED_FIELDS,
      severity: PrecheckSeverity.ERROR,
      message: 'Provider is required',
      field: 'provider',
    });
  }
  if (!data.model) {
    items.push({
      category: PrecheckCategory.REQUIRED_FIELDS,
      severity: PrecheckSeverity.ERROR,
      message: 'Model is required',
      field: 'model',
    });
  }
  if (!data.instructions) {
    items.push({
      category: PrecheckCategory.REQUIRED_FIELDS,
      severity: PrecheckSeverity.WARNING,
      message: 'System instructions are empty — the agent may not behave as expected',
      field: 'instructions',
    });
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
      items.push({
        category: PrecheckCategory.MODEL_AVAILABILITY,
        severity: PrecheckSeverity.ERROR,
        message: 'Models configuration not loaded',
        field: 'model',
      });
      return items;
    }
    const availableModels = modelsConfig[data.provider];
    if (!availableModels) {
      items.push({
        category: PrecheckCategory.MODEL_AVAILABILITY,
        severity: PrecheckSeverity.ERROR,
        message: `No models available for provider "${data.provider}"`,
        detail: data.provider,
        field: 'provider',
      });
      return items;
    }
    const modelExists = availableModels.some((m) => m === data.model);
    if (!modelExists) {
      items.push({
        category: PrecheckCategory.MODEL_AVAILABILITY,
        severity: PrecheckSeverity.ERROR,
        message: `Model "${data.model}" is not available for provider "${data.provider}"`,
        detail: `${data.provider}|${data.model}`,
        field: 'model',
      });
    }
  } catch (err) {
    items.push({
      category: PrecheckCategory.MODEL_AVAILABILITY,
      severity: PrecheckSeverity.WARNING,
      message: 'Could not verify model availability',
      detail: err.message,
      field: 'model',
    });
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
        items.push({
          category: PrecheckCategory.TOOL_PERMISSIONS,
          severity: PrecheckSeverity.ERROR,
          message: `Tool "${tool}" is not available or not authorized`,
          detail: tool,
          field: 'tools',
        });
      }
    }

    if (mcpTools.length === 0) {
      return items;
    }

    const mcpPermissionContext = createMCPPermissionContext(req);
    const canUseMCP = await mcpPermissionContext.canUseServers(req.user);
    if (!canUseMCP) {
      items.push({
        category: PrecheckCategory.TOOL_PERMISSIONS,
        severity: PrecheckSeverity.ERROR,
        message: 'You do not have permission to use MCP servers',
        field: 'tools',
      });
      return items;
    }

    let configServers;
    try {
      configServers = await resolveConfigServers(req);
    } catch (e) {
      items.push({
        category: PrecheckCategory.MCP_STATUS,
        severity: PrecheckSeverity.WARNING,
        message: 'MCP server registry is unavailable — cannot verify MCP tool access',
        detail: e.message,
        field: 'tools',
      });
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
      items.push({
        category: PrecheckCategory.MCP_STATUS,
        severity: PrecheckSeverity.WARNING,
        message: 'MCP server configs could not be loaded — cannot verify MCP tool access',
        detail: e.message,
        field: 'tools',
      });
      return items;
    }

    const rejectedMCPTools = [];
    for (const tool of mcpTools) {
      const parts = tool.split(Constants.mcp_delimiter);
      if (parts.length !== 2) {
        rejectedMCPTools.push(tool);
        items.push({
          category: PrecheckCategory.TOOL_PERMISSIONS,
          severity: PrecheckSeverity.ERROR,
          message: `MCP tool key "${tool}" is malformed`,
          detail: tool,
          field: 'tools',
        });
        continue;
      }
      const [, serverName] = parts;
      if (!serverName || !Object.hasOwn(mcpServerConfigs, serverName)) {
        rejectedMCPTools.push(tool);
        items.push({
          category: PrecheckCategory.TOOL_PERMISSIONS,
          severity: PrecheckSeverity.ERROR,
          message: `MCP server "${serverName}" is not accessible for tool "${tool}"`,
          detail: tool,
          field: 'tools',
        });
      }
    }
  } catch (err) {
    items.push({
      category: PrecheckCategory.TOOL_PERMISSIONS,
      severity: PrecheckSeverity.WARNING,
      message: 'Could not verify tool permissions',
      detail: err.message,
      field: 'tools',
    });
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

  try {
    const mcpPermissionContext = createMCPPermissionContext(req);
    const canUseMCP = await mcpPermissionContext.canUseServers(req.user);
    if (!canUseMCP) {
      return items;
    }

    const mcpManager = getMCPManager(req.user.id);
    if (!mcpManager) {
      return items;
    }

    let userConnections = new Map();
    let appConnections = new Map();
    try {
      userConnections = mcpManager.getUserConnections?.(req.user.id) || new Map();
    } catch (e) {
      // ignore
    }
    try {
      appConnections = (await mcpManager.appConnections?.getLoaded?.()) || new Map();
    } catch (e) {
      // ignore
    }

    for (const serverName of serverNames) {
      const userConn = userConnections.get?.(serverName);
      const appConn = appConnections.get?.(serverName);

      if (!userConn && !appConn) {
        items.push({
          category: PrecheckCategory.MCP_STATUS,
          severity: PrecheckSeverity.WARNING,
          message: `MCP server "${serverName}" has no active connection`,
          detail: serverName,
          field: 'tools',
        });
      }
    }
  } catch (err) {
    logger.warn('[precheck] MCP status check failed', err.message);
  }
  return items;
}

async function checkFileIndexStatus(data, existingAgentId) {
  const items = [];
  const toolResources = data.tool_resources;
  if (!toolResources) {
    return items;
  }

  const fileSearchResources = toolResources.file_search;
  if (!fileSearchResources) {
    return items;
  }

  const fileIds = fileSearchResources.file_ids ?? [];
  if (fileIds.length === 0) {
    return items;
  }

  try {
    const files = await db.getFiles({ file_id: { $in: fileIds } }, null, {
      file_id: 1,
      embedded: 1,
      indexingStatus: 1,
      filename: 1,
    });

    const filesById = new Map((files ?? []).map((f) => [f.file_id, f]));
    const unindexed = [];
    for (const fileId of fileIds) {
      const file = filesById.get(fileId);
      if (!file) {
        unindexed.push({ fileId, reason: 'not_found' });
      } else if (!isIndexed(file)) {
        unindexed.push({ fileId, reason: 'not_indexed', filename: file.filename });
      }
    }

    if (unindexed.length > 0) {
      const notFoundCount = unindexed.filter((f) => f.reason === 'not_found').length;
      const notIndexedCount = unindexed.filter((f) => f.reason === 'not_indexed').length;

      const parts = [];
      if (notIndexedCount > 0) {
        parts.push(`${notIndexedCount} file(s) not yet indexed for retrieval`);
      }
      if (notFoundCount > 0) {
        parts.push(`${notFoundCount} file reference(s) no longer exist`);
      }

      items.push({
        category: PrecheckCategory.FILE_INDEX,
        severity: PrecheckSeverity.WARNING,
        message: parts.join('; '),
        detail: unindexed.map((f) => f.fileId).join(', '),
        field: 'tool_resources.file_search',
      });
    }
  } catch (err) {
    items.push({
      category: PrecheckCategory.FILE_INDEX,
      severity: PrecheckSeverity.WARNING,
      message: 'Could not verify file index status',
      detail: err.message,
      field: 'tool_resources.file_search',
    });
  }
  return items;
}

async function checkAgentReferences(data, req) {
  const items = [];
  const { id: userId, role: userRole } = req.user;

  const edgeAgentIds = new Set();
  if (data.edges?.length) {
    for (const edge of data.edges) {
      const fromIds = Array.isArray(edge.from) ? edge.from : [edge.from];
      const toIds = Array.isArray(edge.to) ? edge.to : [edge.to];
      for (const id of [...fromIds, ...toIds]) {
        if (id && id !== data.agent_id) {
          edgeAgentIds.add(id);
        }
      }
    }
  }

  if (edgeAgentIds.size > 0) {
    const ids = [...edgeAgentIds];
    const agents = await db.getAgents({ id: { $in: ids } });
    const foundIds = new Set(agents.map((a) => a.id));
    const missing = ids.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      for (const id of missing) {
        items.push({
          category: PrecheckCategory.AGENT_REFERENCES,
          severity: PrecheckSeverity.WARNING,
          message: `Edge references agent "${id}" which does not exist yet`,
          detail: id,
          field: 'edges',
        });
      }
    }

    if (agents.length > 0) {
      const {
        getResourcePermissionsMap,
      } = require('~/server/services/PermissionService');
      const { ResourceType, PermissionBits } = require('librechat-data-provider');
      const permissionsMap = await getResourcePermissionsMap({
        userId,
        role: userRole,
        resourceType: ResourceType.AGENT,
        resourceIds: agents.map((a) => a._id),
      });

      for (const agent of agents) {
        const bits = permissionsMap.get(agent._id.toString()) ?? 0;
        if ((bits & PermissionBits.VIEW) === 0) {
          items.push({
            category: PrecheckCategory.AGENT_REFERENCES,
            severity: PrecheckSeverity.ERROR,
            message: `You do not have access to agent "${agent.id}" referenced in edges`,
            detail: agent.id,
            field: 'edges',
          });
        }
      }
    }
  }

  const capabilities = req.config?.endpoints?.[EModelEndpoint.agents]?.capabilities;
  const subagentsEnabled =
    Array.isArray(capabilities) && capabilities.includes(AgentCapabilities.subagents);

  if (
    subagentsEnabled &&
    data.subagents?.enabled === true &&
    data.subagents?.agent_ids?.length
  ) {
    const subAgentIds = data.subagents.agent_ids;
    const agents = await db.getAgents({ id: { $in: subAgentIds } });
    const foundIds = new Set(agents.map((a) => a.id));
    const missing = subAgentIds.filter((id) => !foundIds.has(id));

    for (const id of missing) {
      items.push({
        category: PrecheckCategory.AGENT_REFERENCES,
        severity: PrecheckSeverity.ERROR,
        message: `Subagent references agent "${id}" which does not exist`,
        detail: id,
        field: 'subagents',
      });
    }

    if (agents.length > 0) {
      const {
        getResourcePermissionsMap,
      } = require('~/server/services/PermissionService');
      const { ResourceType, PermissionBits } = require('librechat-data-provider');
      const permissionsMap = await getResourcePermissionsMap({
        userId,
        role: userRole,
        resourceType: ResourceType.AGENT,
        resourceIds: agents.map((a) => a._id),
      });

      for (const agent of agents) {
        const bits = permissionsMap.get(agent._id.toString()) ?? 0;
        if ((bits & PermissionBits.VIEW) === 0) {
          items.push({
            category: PrecheckCategory.AGENT_REFERENCES,
            severity: PrecheckSeverity.ERROR,
            message: `You do not have access to agent "${agent.id}" referenced in subagents`,
            detail: agent.id,
            field: 'subagents',
          });
        }
      }
    }
  }

  return items;
}

async function performAgentPrecheck(data, req, existingAgentId) {
  const allItems = [];

  const [required, model, tools, mcp, files, agents] = await Promise.all([
    checkRequiredFields(data),
    checkModelAvailability(data, req),
    checkToolPermissions(data, req),
    checkMCPStatus(data, req),
    checkFileIndexStatus(data, existingAgentId),
    checkAgentReferences(data, req),
  ]);

  allItems.push(...required, ...model, ...tools, ...mcp, ...files, ...agents);

  const hasErrors = allItems.some((item) => item.severity === PrecheckSeverity.ERROR);

  return {
    valid: !hasErrors,
    items: allItems,
  };
}

module.exports = {
  PrecheckSeverity,
  PrecheckCategory,
  performAgentPrecheck,
};
