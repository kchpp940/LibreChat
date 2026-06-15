const { logger } = require('@librechat/data-schemas');
const {
  resolveToolAvailability,
  availabilityToValidationIssues,
  isActionDomainAllowed,
  getUserMCPAuthMap,
  getMissingCustomUserVars,
} = require('@librechat/api');
const {
  EModelEndpoint,
  AgentCapabilities,
  isEphemeralAgentId,
  defaultAgentCapabilities,
} = require('librechat-data-provider');
const {
  createMCPPermissionContext,
  resolveConfigServers,
} = require('~/server/services/MCP');
const { getMCPServersRegistry, getMCPManager } = require('~/config');
const { getCachedTools } = require('~/server/services/Config');
const { getModelsConfig } = require('~/server/controllers/ModelController');
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

function buildToolAvailabilityDeps(req) {
  return {
    getCachedTools: () => getCachedTools().then((t) => t ?? {}),
    isActionDomainAllowed: (domain, allowedDomains, allowedAddresses) =>
      isActionDomainAllowed(domain, allowedDomains, allowedAddresses),
    canUseMCPServers: (user) => {
      const mcpPermissionContext = createMCPPermissionContext(req);
      return mcpPermissionContext.canUseServers(user ?? req.user);
    },
    getAllMCPServerConfigs: async (userId, configServers, role) => {
      const registry = getMCPServersRegistry();
      const resolved = configServers ?? (await resolveConfigServers(req));
      if (role !== undefined) {
        return (await registry.getAllServerConfigs(userId, resolved, role)) ?? {};
      }
      return (await registry.getAllServerConfigs(userId, resolved)) ?? {};
    },
    getMCPConnectionStatus: async (userId, serverNames) => {
      const result = {};
      try {
        const mcpManager = getMCPManager(userId);
        if (!mcpManager) {
          return result;
        }
        let userConnections = new Map();
        let appConnections = new Map();
        try {
          userConnections = mcpManager.getUserConnections?.(userId) || new Map();
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
          const conn = userConn || appConn;
          if (conn) {
            result[serverName] = {
              connectionState: conn.connectionState || 'connected',
            };
          }
        }
      } catch (e) {
        logger.warn('[precheck] Failed to get MCP connection status', e.message);
      }
      return result;
    },
    getMCPUserAuthMap: (params) =>
      getUserMCPAuthMap({
        ...params,
        findPluginAuthsByKeys: db.findPluginAuthsByKeys,
      }),
    getMissingMCPCustomUserVars: getMissingCustomUserVars,
    appConfig: req.config,
    endpointsConfig: req.config?.endpoints,
    resolveConfigServers: () => resolveConfigServers(req),
    isEphemeralAgentId,
    defaultAgentCapabilities,
  };
}

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

async function checkToolAvailability(data, req) {
  const tools = data.tools ?? [];
  if (tools.length === 0) {
    return [];
  }
  try {
    const deps = buildToolAvailabilityDeps(req);
    const result = await resolveToolAvailability(
      {
        tools,
        userId: req.user.id,
        userRole: req.user.role,
        agentId: data.agent_id,
      },
      deps,
    );
    return availabilityToValidationIssues(result);
  } catch (err) {
    logger.warn('[precheck] Tool availability check failed', err.message);
    return [];
  }
}

async function checkFileIndexStatus(data, _existingAgentId) {
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
      filename: 1,
    });

    const filesById = new Map((files ?? []).map((f) => [f.file_id, f]));
    const unindexed = [];
    for (const fileId of fileIds) {
      const file = filesById.get(fileId);
      if (!file) {
        unindexed.push({ fileId, reason: 'not_found' });
      } else if (file.embedded !== true) {
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
      const { getResourcePermissionsMap } = require('~/server/services/PermissionService');
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

  if (subagentsEnabled && data.subagents?.enabled === true && data.subagents?.agent_ids?.length) {
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
      const { getResourcePermissionsMap } = require('~/server/services/PermissionService');
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

  const [required, model, tools, files, agents] = await Promise.all([
    checkRequiredFields(data),
    checkModelAvailability(data, req),
    checkToolAvailability(data, req),
    checkFileIndexStatus(data, existingAgentId),
    checkAgentReferences(data, req),
  ]);

  allItems.push(...required, ...model, ...tools, ...files, ...agents);

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
