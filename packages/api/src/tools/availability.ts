import { logger } from '@librechat/data-schemas';
import {
  Tools,
  Constants,
  AgentCapabilities,
  isActionTool,
  actionDelimiter,
  EModelEndpoint,
  type TPlugin,
  ToolType,
  ToolUnavailableReason,
  MCPAuthStatus,
  ToolPermissionStatus,
  MCPConnectionState,
  type ToolAvailability,
  type ToolAvailabilityResult,
  type ResolveToolAvailabilityOptions,
  type ToolValidationIssue,
} from 'librechat-data-provider';

const systemTools = new Set([
  Tools.execute_code,
  Tools.file_search,
  Tools.web_search,
]);

const capabilityMap: Record<string, string> = {
  [Tools.file_search]: AgentCapabilities.file_search,
  [Tools.execute_code]: AgentCapabilities.execute_code,
  [Tools.web_search]: AgentCapabilities.web_search,
};

export interface ToolAvailabilityDeps {
  getCachedTools?: () => Promise<Record<string, TPlugin> | undefined | null>;
  isActionDomainAllowed?: (domain: string, allowedDomains?: string[], allowedAddresses?: string[]) => Promise<boolean>;
  canUseMCPServers?: (user?: { id: string; role?: string }) => Promise<boolean>;
  getAllMCPServerConfigs?: (
    userId: string,
    configServers?: Record<string, unknown>,
    role?: string,
  ) => Promise<Record<string, unknown>>;
  getMCPConnectionStatus?: (
    userId: string,
    serverNames: string[],
  ) => Promise<Record<string, { connectionState: string }>>;
  getMCPUserAuthMap?: (params: {
    tools: string[];
    userId: string;
  }) => Promise<Record<string, Record<string, string>>>;
  getMissingMCPCustomUserVars?: (
    serverConfig: unknown,
    customUserVars?: Record<string, string>,
  ) => string[];
  appConfig?: {
    actions?: {
      allowedDomains?: string[];
      allowedAddresses?: string[];
    };
    endpoints?: {
      [EModelEndpoint.agents]?: {
        capabilities?: string[];
      };
    };
    filteredTools?: string[];
    includedTools?: string[];
  };
  endpointsConfig?: Record<string, { capabilities?: string[] }>;
  getEndpointsConfig?: () => Promise<Record<string, { capabilities?: string[] }>>;
  resolveConfigServers?: () => Promise<Record<string, unknown>>;
  isEphemeralAgentId?: (agentId?: string) => boolean;
  defaultAgentCapabilities?: string[];
  supportsToolCalling?: (model: string, provider: string, endpoint?: string) => boolean;
}

function normalizeCapabilities(
  caps?: Set<string> | string[],
): Set<string> {
  if (caps instanceof Set) {
    return caps;
  }
  if (Array.isArray(caps)) {
    return new Set(caps);
  }
  return new Set();
}

function getToolType(toolKey: string): ToolType {
  if (typeof toolKey !== 'string') {
    return ToolType.builtin;
  }
  if (systemTools.has(toolKey as Tools)) {
    return ToolType.system;
  }
  if (toolKey.includes(Constants.mcp_delimiter) && !isActionTool(toolKey)) {
    return ToolType.mcp;
  }
  if (isActionTool(toolKey)) {
    return ToolType.action;
  }
  return ToolType.builtin;
}

function buildEmptyResult(): ToolAvailabilityResult {
  return {
    tools: {},
    availableToolKeys: [],
    unavailableToolKeys: [],
    summary: {
      total: 0,
      available: 0,
      unavailable: 0,
      byReason: {},
    },
  };
}

function addToResult(
  result: ToolAvailabilityResult,
  availability: ToolAvailability,
): void {
  result.tools[availability.toolKey] = availability;
  result.summary.total++;
  if (availability.isAvailable) {
    result.availableToolKeys.push(availability.toolKey);
    result.summary.available++;
  } else {
    result.unavailableToolKeys.push(availability.toolKey);
    result.summary.unavailable++;
    if (availability.reason) {
      if (!result.summary.byReason[availability.reason]) {
        result.summary.byReason[availability.reason] = [];
      }
      result.summary.byReason[availability.reason]!.push(availability.toolKey);
    }
  }
}

function baseAvailability(toolKey: string): ToolAvailability {
  return {
    toolKey,
    toolType: getToolType(toolKey),
    isAvailable: false,
    permissionStatus: ToolPermissionStatus.unknown,
  };
}

export async function resolveAgentCapabilities(
  agentId: string | undefined,
  deps: ToolAvailabilityDeps,
): Promise<Set<string>> {
  const appConfig = deps.appConfig;
  const endpointsAgentConfig = deps.endpointsConfig?.[EModelEndpoint.agents];
  let capabilities = new Set(endpointsAgentConfig?.capabilities ?? []);

  if (capabilities.size === 0 && deps.isEphemeralAgentId?.(agentId)) {
    capabilities = new Set(
      appConfig?.endpoints?.[EModelEndpoint.agents]?.capabilities ??
        deps.defaultAgentCapabilities ??
        [],
    );
  }
  return capabilities;
}

export async function resolveToolAvailability(
  options: ResolveToolAvailabilityOptions,
  deps: ToolAvailabilityDeps,
): Promise<ToolAvailabilityResult> {
  const result = buildEmptyResult();
  const tools = options.tools ?? [];

  if (tools.length === 0) {
    return result;
  }

  let enabledCapabilities: Set<string>;
  if (options.enabledCapabilities) {
    enabledCapabilities = normalizeCapabilities(options.enabledCapabilities);
  } else {
    enabledCapabilities = await resolveAgentCapabilities(options.agentId, deps);
  }

  const checkCapability = (cap: string): boolean =>
    enabledCapabilities.size === 0 ? true : enabledCapabilities.has(cap);
  const areToolsEnabled = checkCapability(AgentCapabilities.tools);
  const actionsEnabled = checkCapability(AgentCapabilities.actions);

  let modelSupportsToolCalling = true;
  if (
    options.model &&
    options.provider &&
    deps.supportsToolCalling &&
    !deps.supportsToolCalling(options.model, options.provider, options.endpoint)
  ) {
    modelSupportsToolCalling = false;
  }

  const hasMCPTools = tools.some(
    (t) => typeof t === 'string' && t.includes(Constants.mcp_delimiter) && !isActionTool(t),
  );
  let canUseMCP = true;
  if (hasMCPTools && options.checkMCPPermissions !== false && deps.canUseMCPServers && options.userId) {
    canUseMCP = await deps.canUseMCPServers({
      id: options.userId,
      role: options.userRole,
    });
  }

  let availableTools: Record<string, TPlugin> = {};
  if (deps.getCachedTools) {
    availableTools = (await deps.getCachedTools()) ?? {};
  }

  const filteredToolsSet = new Set(deps.appConfig?.filteredTools ?? []);
  const includedToolsSet = new Set(deps.appConfig?.includedTools ?? []);

  let mcpServerConfigs: Record<string, unknown> | undefined;
  let registryUnavailable = false;
  if (hasMCPTools && deps.getAllMCPServerConfigs && canUseMCP) {
    try {
      let configServers: Record<string, unknown> | undefined;
      if (deps.resolveConfigServers) {
        configServers = await deps.resolveConfigServers();
      }
      mcpServerConfigs = options.userRole
        ? ((await deps.getAllMCPServerConfigs(options.userId!, configServers, options.userRole)) ??
          {})
        : ((await deps.getAllMCPServerConfigs(options.userId!, configServers)) ?? {});
    } catch (e) {
      logger.warn(
        '[ToolAvailability] MCP registry unavailable, cannot verify MCP tool access',
        e instanceof Error ? e.message : String(e),
      );
      registryUnavailable = true;
      mcpServerConfigs = {};
    }
  }

  let connectionStatus: Record<string, { connectionState: string }> = {};
  if (
    hasMCPTools &&
    canUseMCP &&
    options.checkMCPConnection !== false &&
    deps.getMCPConnectionStatus &&
    options.userId
  ) {
    const serverNames = new Set<string>();
    for (const tool of tools) {
      if (
        typeof tool === 'string' &&
        tool.includes(Constants.mcp_delimiter) &&
        !isActionTool(tool)
      ) {
        const parts = tool.split(Constants.mcp_delimiter);
        if (parts.length === 2) {
          serverNames.add(parts[1]);
        }
      }
    }
    if (serverNames.size > 0) {
      try {
        connectionStatus = await deps.getMCPConnectionStatus(
          options.userId,
          Array.from(serverNames),
        );
      } catch (e) {
        logger.warn(
          '[ToolAvailability] Failed to fetch MCP connection status',
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  let userMCPAuthMap: Record<string, Record<string, string>> | undefined;
  if (hasMCPTools && canUseMCP && deps.getMCPUserAuthMap && options.userId) {
    try {
      userMCPAuthMap = await deps.getMCPUserAuthMap({
        tools,
        userId: options.userId,
      });
    } catch (e) {
      logger.warn(
        '[ToolAvailability] Failed to fetch MCP user auth map',
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  for (const toolKey of tools) {
    if (typeof toolKey !== 'string' || !toolKey) {
      continue;
    }
    const availability = baseAvailability(toolKey);

    if (filteredToolsSet.size > 0 && filteredToolsSet.has(toolKey) && !includedToolsSet.has(toolKey)) {
      availability.reason = ToolUnavailableReason.admin_filtered;
      availability.message = `Tool "${toolKey}" is disabled by admin configuration`;
      availability.permissionStatus = ToolPermissionStatus.denied;
      addToResult(result, availability);
      continue;
    }

    const toolType = availability.toolType;

    if (toolType === ToolType.system) {
      const capability = capabilityMap[toolKey];
      availability.capability = capability;
      availability.capabilityEnabled = capability ? checkCapability(capability) : true;
      if (capability && !availability.capabilityEnabled) {
        availability.reason = ToolUnavailableReason.capability_disabled;
        availability.message = `Capability "${capability}" is not enabled for this agent`;
        availability.permissionStatus = ToolPermissionStatus.denied;
        addToResult(result, availability);
        continue;
      }
      availability.isAvailable = true;
      availability.permissionStatus = ToolPermissionStatus.allowed;
      addToResult(result, availability);
      continue;
    }

    if (!modelSupportsToolCalling) {
      availability.reason = ToolUnavailableReason.model_not_supported;
      availability.message = `Model "${options.model ?? 'unknown'}" does not support tool calling`;
      availability.permissionStatus = ToolPermissionStatus.denied;
      addToResult(result, availability);
      continue;
    }

    if (toolType === ToolType.action) {
      availability.capability = AgentCapabilities.actions;
      availability.capabilityEnabled = actionsEnabled;
      if (!actionsEnabled) {
        availability.reason = ToolUnavailableReason.capability_disabled;
        availability.message = `Capability "actions" is not enabled for this agent`;
        availability.permissionStatus = ToolPermissionStatus.denied;
        addToResult(result, availability);
        continue;
      }

      if (deps.isActionDomainAllowed && deps.appConfig?.actions) {
        const domainMatch = toolKey.split(actionDelimiter);
        const domain = domainMatch.length > 1 ? domainMatch[domainMatch.length - 1] : undefined;
        if (domain) {
          availability.domain = domain;
          const domainAllowed = await deps.isActionDomainAllowed(
            domain,
            deps.appConfig.actions.allowedDomains,
            deps.appConfig.actions.allowedAddresses,
          );
          availability.domainAllowed = domainAllowed;
          if (!domainAllowed) {
            availability.reason = ToolUnavailableReason.domain_not_allowed;
            availability.message = `Domain "${domain}" is not in the allowed domains list`;
            availability.permissionStatus = ToolPermissionStatus.denied;
            addToResult(result, availability);
            continue;
          }
        }
      }

      availability.isAvailable = true;
      availability.permissionStatus = ToolPermissionStatus.allowed;
      addToResult(result, availability);
      continue;
    }

    if (toolType === ToolType.mcp) {
      const parts = toolKey.split(Constants.mcp_delimiter);
      if (parts.length !== 2) {
        availability.reason = ToolUnavailableReason.mcp_malformed_key;
        availability.message = `MCP tool key "${toolKey}" is malformed — expected format: {toolName}${Constants.mcp_delimiter}{serverName}`;
        availability.permissionStatus = ToolPermissionStatus.denied;
        addToResult(result, availability);
        continue;
      }

      const [, serverName] = parts;
      availability.mcpServerName = serverName;
      availability.capability = AgentCapabilities.tools;
      availability.capabilityEnabled = areToolsEnabled;

      if (!areToolsEnabled) {
        availability.reason = ToolUnavailableReason.capability_disabled;
        availability.message = `Capability "tools" is not enabled for this agent`;
        availability.permissionStatus = ToolPermissionStatus.denied;
        addToResult(result, availability);
        continue;
      }

      if (!canUseMCP) {
        availability.reason = ToolUnavailableReason.permission_denied;
        availability.message = `You do not have permission to use MCP servers`;
        availability.permissionStatus = ToolPermissionStatus.denied;
        availability.mcpAuthStatus = MCPAuthStatus.not_authorized;
        addToResult(result, availability);
        continue;
      }

      if (registryUnavailable) {
        availability.reason = ToolUnavailableReason.registry_unavailable;
        availability.message = `MCP server registry is currently unavailable — cannot verify access to "${serverName}"`;
        availability.permissionStatus = ToolPermissionStatus.unknown;
        addToResult(result, availability);
        continue;
      }

      if (mcpServerConfigs && !Object.prototype.hasOwnProperty.call(mcpServerConfigs, serverName)) {
        availability.reason = ToolUnavailableReason.mcp_server_unavailable;
        availability.message = `MCP server "${serverName}" is not accessible or does not exist`;
        availability.permissionStatus = ToolPermissionStatus.denied;
        addToResult(result, availability);
        continue;
      }

      const serverConfig = mcpServerConfigs?.[serverName] as
        | { customUserVars?: Record<string, { title: string; description: string }>; requiresOAuth?: boolean }
        | undefined;
      const customUserVars = userMCPAuthMap?.[`${Constants.mcp_prefix}${serverName}`];
      const missingVars = deps.getMissingMCPCustomUserVars
        ? deps.getMissingMCPCustomUserVars(serverConfig, customUserVars)
        : [];
      if (missingVars.length > 0) {
        availability.requiresUserVars = true;
        availability.missingUserVars = missingVars;
        availability.reason = ToolUnavailableReason.mcp_missing_user_vars;
        availability.message = `MCP server "${serverName}" requires user-provided variable(s): ${missingVars.join(', ')}`;
        availability.permissionStatus = ToolPermissionStatus.requires_auth;
        availability.mcpAuthStatus = MCPAuthStatus.user_vars_required;
        addToResult(result, availability);
        continue;
      }

      if (serverConfig?.requiresOAuth) {
        availability.reason = ToolUnavailableReason.mcp_oauth_required;
        availability.message = `MCP server "${serverName}" requires OAuth authentication`;
        availability.permissionStatus = ToolPermissionStatus.requires_auth;
        availability.mcpAuthStatus = MCPAuthStatus.oauth_required;
        addToResult(result, availability);
        continue;
      }

      const connState = connectionStatus[serverName]?.connectionState;
      if (connState) {
        availability.mcpConnectionState =
          (connState as MCPConnectionState) ?? MCPConnectionState.unknown;
        if (availability.mcpConnectionState !== MCPConnectionState.connected) {
          availability.reason = ToolUnavailableReason.mcp_not_connected;
          availability.message = `MCP server "${serverName}" is not currently connected (state: ${connState})`;
        }
      }

      availability.isAvailable = true;
      availability.permissionStatus = ToolPermissionStatus.allowed;
      availability.mcpAuthStatus = MCPAuthStatus.authorized;
      addToResult(result, availability);
      continue;
    }

    if (!areToolsEnabled) {
      availability.reason = ToolUnavailableReason.capability_disabled;
      availability.message = `Capability "tools" is not enabled for this agent`;
      availability.capability = AgentCapabilities.tools;
      availability.capabilityEnabled = false;
      availability.permissionStatus = ToolPermissionStatus.denied;
      addToResult(result, availability);
      continue;
    }

    if (availableTools[toolKey]) {
      const plugin = availableTools[toolKey];
      availability.authenticated = Boolean(plugin.authenticated);
      availability.authConfig = plugin.authConfig as unknown[] | undefined;
      availability.metadata = { plugin };
      if (plugin.authConfig && plugin.authConfig.length > 0 && !plugin.authenticated) {
        availability.permissionStatus = ToolPermissionStatus.requires_auth;
        availability.reason = ToolUnavailableReason.permission_denied;
        availability.message = `Tool "${toolKey}" requires authentication`;
        addToResult(result, availability);
        continue;
      }
      availability.isAvailable = true;
      availability.permissionStatus = ToolPermissionStatus.allowed;
      addToResult(result, availability);
      continue;
    }

    availability.reason = ToolUnavailableReason.not_found;
    availability.message = `Tool "${toolKey}" is not registered or not available`;
    availability.permissionStatus = ToolPermissionStatus.denied;
    addToResult(result, availability);
  }

  return result;
}

export function availabilityToValidationIssues(
  result: ToolAvailabilityResult,
): ToolValidationIssue[] {
  const issues: ToolValidationIssue[] = [];

  for (const key of result.unavailableToolKeys) {
    const av = result.tools[key];
    if (!av) {
      continue;
    }

    let category: ToolValidationIssue['category'] = 'tool_permissions';
    let severity: ToolValidationIssue['severity'] = 'error';

    if (av.toolType === ToolType.mcp) {
      if (
        av.reason === ToolUnavailableReason.mcp_not_connected ||
        av.reason === ToolUnavailableReason.registry_unavailable
      ) {
        category = 'mcp_status';
        severity = 'warning';
      } else if (av.reason === ToolUnavailableReason.mcp_oauth_required) {
        category = 'mcp_status';
        severity = 'warning';
      }
    }

    if (av.reason === ToolUnavailableReason.mcp_missing_user_vars) {
      category = 'mcp_status';
      severity = 'warning';
    }

    issues.push({
      toolKey: av.toolKey,
      category,
      severity,
      message: av.message ?? `Tool "${av.toolKey}" is not available`,
      reason: av.reason,
      detail: av.mcpServerName ?? av.domain,
      field: 'tools',
    });
  }

  return issues;
}

export function filterAuthorizedToolsFromResult(
  result: ToolAvailabilityResult,
  existingTools?: string[],
): string[] {
  const authorized: string[] = [];
  const existingToolSet = existingTools?.length ? new Set(existingTools) : null;

  for (const key of Object.keys(result.tools)) {
    const av = result.tools[key];
    if (!av) {
      continue;
    }
    if (av.isAvailable) {
      authorized.push(key);
      continue;
    }
    if (
      existingToolSet?.has(key) &&
      av.toolType === ToolType.mcp &&
      av.reason === ToolUnavailableReason.registry_unavailable
    ) {
      authorized.push(key);
    }
  }

  return authorized;
}
