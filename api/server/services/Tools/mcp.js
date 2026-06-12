const { logger } = require('@librechat/data-schemas');
const { getMissingCustomUserVars, requiresEphemeralUserConnection } = require('@librechat/api');
const { CacheKeys, Constants } = require('librechat-data-provider');
const { getMCPManager, getMCPServersRegistry, getFlowStateManager } = require('~/config');
const { findToken, createToken, updateToken, deleteTokens } = require('~/models');
const { getGraphApiToken } = require('~/server/services/GraphTokenService');
const { exchangeOboToken } = require('~/server/services/OboTokenService');
const { createOboTrustChecker } = require('~/server/services/OboPolicyService');
const { updateMCPServerTools } = require('~/server/services/Config');
const { getLogStores } = require('~/cache');

/**
 * @typedef {Object} MCPServerAvailability
 * @property {boolean} available - Whether the server is fully available for use
 * @property {'ok'|'permission_denied'|'not_found'|'inspection_failed'|'oauth_unauthorized'|'registry_unavailable'} reason - Machine-readable reason code
 * @property {string} [details] - Human-readable details
 */

/**
 * Unified MCP server availability check.
 * Combines inspectionFailed state and OAuth authorization status.
 * Returns a structured result with availability flag and reason code.
 *
 * @param {object} [serverConfig] - The parsed MCP server config from registry
 * @param {boolean | undefined} [oauthAuthorized] - Whether the user has valid OAuth authorization
 * @param {boolean} [canUseServers=true] - Whether the user has global MCP server use permission
 * @returns {MCPServerAvailability} Structured availability result
 */
function getMCPServerAvailability(serverConfig, oauthAuthorized, canUseServers = true) {
  if (!canUseServers) {
    return { available: false, reason: 'permission_denied' };
  }
  if (!serverConfig) {
    return { available: false, reason: 'not_found' };
  }
  if (serverConfig.inspectionFailed) {
    return { available: false, reason: 'inspection_failed' };
  }
  if (serverConfig.requiresOAuth && oauthAuthorized === false) {
    return { available: false, reason: 'oauth_unauthorized' };
  }
  return { available: true, reason: 'ok' };
}

/**
 * @deprecated Use getMCPServerAvailability() for structured result with reason code.
 * Unified MCP server availability check.
 * Combines inspectionFailed state and OAuth authorization status.
 * Returns true only if the server is fully available for use.
 *
 * @param {object} [serverConfig] - The parsed MCP server config from registry
 * @param {boolean | undefined} [oauthAuthorized] - Whether the user has valid OAuth authorization
 * @returns {boolean} True if the server is available, false otherwise
 */
function isMCPServerAvailable(serverConfig, oauthAuthorized) {
  return getMCPServerAvailability(serverConfig, oauthAuthorized).available;
}

/**
 * Build a map of server availability for all referenced servers.
 * Takes pre-fetched registry configs and OAuth status to avoid duplicate lookups.
 *
 * @param {Record<string, object>} serverConfigs - Map of serverName -> config from registry
 * @param {Map<string, boolean>} oauthStatus - Map of serverName -> oauthAuthorized boolean
 * @param {boolean} [canUseServers=true] - Whether the user has global MCP permission
 * @returns {Map<string, MCPServerAvailability>} Map of serverName -> availability result
 */
function buildMCPServerAvailabilityMap(serverConfigs, oauthStatus, canUseServers = true) {
  const result = new Map();
  if (!serverConfigs) {
    return result;
  }
  for (const [serverName, config] of Object.entries(serverConfigs)) {
    const oauthAuthorized = config?.requiresOAuth
      ? (oauthStatus?.get(serverName) ?? false)
      : undefined;
    result.set(serverName, getMCPServerAvailability(config, oauthAuthorized, canUseServers));
  }
  return result;
}

/**
 * Bulk check OAuth authorization status for multiple MCP servers for a given user.
 * Returns a map of serverName -> isAuthorized (boolean).
 * Checks for valid access tokens first, falls back to refresh token existence.
 *
 * @param {string} userId - The user ID to check tokens for
 * @param {string[]} serverNames - Array of MCP server names that require OAuth
 * @param {{ findToken: Function }} [tokenModel] - Token model injection (defaults to ~/models findToken)
 * @returns {Promise<Map<string, boolean>>} Map of serverName to authorization status
 */
async function getMCPServersOAuthStatus(
  userId,
  serverNames,
  tokenModel = { findToken },
) {
  const oauthStatus = new Map();
  if (!serverNames || serverNames.length === 0 || !userId) {
    return oauthStatus;
  }

  const oauthServers = serverNames.filter((name) => name);
  if (oauthServers.length === 0) {
    return oauthStatus;
  }

  const now = new Date();
  for (const serverName of oauthServers) {
    try {
      const identifier = `mcp:${serverName}`;
      const accessTokenData = await tokenModel.findToken({
        userId,
        type: 'mcp_oauth',
        identifier,
      });

      const hasValidAccessToken =
        accessTokenData &&
        accessTokenData.expiresAt &&
        new Date(accessTokenData.expiresAt) > now;

      if (hasValidAccessToken) {
        oauthStatus.set(serverName, true);
        continue;
      }

      const refreshTokenData = await tokenModel.findToken({
        userId,
        type: 'mcp_oauth_refresh',
        identifier: `${identifier}:refresh`,
      });

      oauthStatus.set(serverName, !!refreshTokenData);
    } catch (e) {
      logger.warn(
        `[getMCPServersOAuthStatus] Failed to check OAuth status for server "${serverName}":`,
        e.message,
      );
      oauthStatus.set(serverName, false);
    }
  }

  return oauthStatus;
}

/**
 * Collects all referenced MCP server names from a tool list.
 * @param {string[]} tools - Array of tool identifiers
 * @returns {Set<string>} Unique set of MCP server names referenced by tools
 */
function collectMCPServerNames(tools) {
  const serverNames = new Set();
  for (const tool of tools ?? []) {
    if (typeof tool !== 'string' || !tool.includes(Constants.mcp_delimiter)) {
      continue;
    }
    const parts = tool.split(Constants.mcp_delimiter);
    if (parts.length === 2 && parts[1]) {
      serverNames.add(parts[1]);
    }
  }
  return serverNames;
}

/**
 * Reinitializes an MCP server connection and discovers available tools.
 * When OAuth is required, uses discovery mode to list tools without full authentication
 * (per MCP spec, tool listing should be possible without auth).
 * @param {Object} params
 * @param {IUser} params.user - The user from the request object.
 * @param {string} params.serverName - The name of the MCP server
 * @param {boolean} params.returnOnOAuth - Whether to initiate OAuth and return, or wait for OAuth flow to finish
 * @param {AbortSignal} [params.signal] - The abort signal to handle cancellation.
 * @param {boolean} [params.forceNew]
 * @param {number} [params.connectionTimeout]
 * @param {FlowStateManager<any>} [params.flowManager]
 * @param {(authURL: string, options?: { expiresAt?: number }) => Promise<void>} [params.oauthStart]
 * @param {() => Promise<void>} [params.oauthEnd]
 * @param {import('@librechat/api').RequestBody} [params.requestBody]
 * @param {import('@librechat/api').RequestScopedMCPConnectionStore} [params.requestScopedConnections]
 * @param {Record<string, Record<string, string>>} [params.userMCPAuthMap]
 */
async function reinitMCPServer({
  user,
  signal,
  forceNew,
  serverName,
  configServers,
  userMCPAuthMap,
  connectionTimeout,
  returnOnOAuth = true,
  oauthStart: _oauthStart,
  flowManager: _flowManager,
  serverConfig: providedConfig,
  requestBody,
  requestScopedConnections,
  oauthEnd,
}) {
  /** @type {MCPConnection | null} */
  let connection = null;
  let serverConfig = providedConfig;
  /** @type {LCAvailableTools | null} */
  let availableTools = null;
  /** @type {ReturnType<MCPConnection['fetchTools']> | null} */
  let tools = null;
  let oauthRequired = false;
  let oauthUrl = null;
  let ephemeralServer = false;

  try {
    const registry = getMCPServersRegistry();
    serverConfig =
      serverConfig ?? (await registry.getServerConfig(serverName, user?.id, configServers));
    ephemeralServer = serverConfig ? requiresEphemeralUserConnection(serverConfig) : false;
    if (serverConfig?.inspectionFailed) {
      if (serverConfig.source === 'config') {
        logger.info(
          `[MCP Reinitialize] Config-source server ${serverName} has inspectionFailed — retry handled by config cache`,
        );
        return {
          availableTools: null,
          success: false,
          message: `MCP server '${serverName}' is still unreachable`,
          oauthRequired: false,
          serverName,
          oauthUrl: null,
          tools: null,
        };
      } else {
        logger.info(
          `[MCP Reinitialize] Server ${serverName} had failed inspection, attempting reinspection`,
        );
        try {
          const storageLocation = serverConfig.source === 'user' ? 'DB' : 'CACHE';
          await registry.reinspectServer(serverName, storageLocation, user?.id);
          logger.info(`[MCP Reinitialize] Reinspection succeeded for server: ${serverName}`);
        } catch (reinspectError) {
          logger.error(
            `[MCP Reinitialize] Reinspection failed for server ${serverName}:`,
            reinspectError,
          );
          return {
            availableTools: null,
            success: false,
            message: `MCP server '${serverName}' is still unreachable`,
            oauthRequired: false,
            serverName,
            oauthUrl: null,
            tools: null,
          };
        }
      }
    }

    const customUserVars = userMCPAuthMap?.[`${Constants.mcp_prefix}${serverName}`];

    const missingUserVars = getMissingCustomUserVars(serverConfig ?? {}, customUserVars);
    if (missingUserVars.length > 0) {
      logger.warn(
        `[MCP Reinitialize] Skipping server '${serverName}': required user-provided variable(s) not set: ${missingUserVars.join(
          ', ',
        )}. Tools will not be exposed until the user configures them.`,
      );
      return {
        availableTools: null,
        success: false,
        message: `MCP server '${serverName}' requires user-provided variable(s) [${missingUserVars.join(
          ', ',
        )}] which are not set`,
        oauthRequired: false,
        serverName,
        oauthUrl: null,
        tools: null,
      };
    }

    const flowManager = _flowManager ?? getFlowStateManager(getLogStores(CacheKeys.FLOWS));
    const mcpManager = getMCPManager();
    const tokenMethods = { findToken, updateToken, createToken, deleteTokens };

    const oauthStart =
      _oauthStart ??
      (async (authURL) => {
        logger.info(`[MCP Reinitialize] OAuth URL received for ${serverName}`);
        oauthUrl = authURL;
        oauthRequired = true;
      });

    try {
      connection = await mcpManager.getConnection({
        user,
        signal,
        forceNew,
        oauthStart,
        serverName,
        flowManager,
        tokenMethods,
        returnOnOAuth,
        oauthEnd,
        customUserVars,
        requestBody,
        requestScopedConnections,
        connectionTimeout,
        serverConfig,
        graphTokenResolver: getGraphApiToken,
        oboTokenResolver: exchangeOboToken,
        oboTrustChecker: createOboTrustChecker(),
      });

      logger.info(`[MCP Reinitialize] Successfully established connection for ${serverName}`);
    } catch (err) {
      logger.info(`[MCP Reinitialize] getConnection threw error: ${err.message}`);
      logger.info(
        `[MCP Reinitialize] OAuth state - oauthRequired: ${oauthRequired}, oauthUrl: ${oauthUrl ? 'present' : 'null'}`,
      );

      const isOAuthError =
        err.message?.includes('OAuth') ||
        err.message?.includes('authentication') ||
        err.message?.includes('401');

      const isOAuthFlowInitiated = err.message === 'OAuth flow initiated - return early';

      if (isOAuthError || oauthRequired || isOAuthFlowInitiated) {
        logger.info(
          `[MCP Reinitialize] OAuth required for ${serverName}, attempting tool discovery without auth`,
        );
        oauthRequired = true;

        try {
          const discoveryResult = await mcpManager.discoverServerTools({
            user,
            signal,
            serverName,
            flowManager,
            tokenMethods,
            oauthStart,
            customUserVars,
            requestBody,
            connectionTimeout,
            configServers,
            graphTokenResolver: getGraphApiToken,
            oboTokenResolver: exchangeOboToken,
            oboTrustChecker: createOboTrustChecker(),
          });

          if (discoveryResult.tools && discoveryResult.tools.length > 0) {
            tools = discoveryResult.tools;
            logger.info(
              `[MCP Reinitialize] Discovered ${tools.length} tools for ${serverName} without full auth`,
            );
          }
        } catch (discoveryErr) {
          logger.debug(
            `[MCP Reinitialize] Tool discovery failed for ${serverName}: ${discoveryErr?.message ?? String(discoveryErr)}`,
          );
        }
      } else {
        logger.error(
          `[MCP Reinitialize] Error initializing MCP server ${serverName} for user:`,
          err,
        );
      }
    }

    if (connection && !oauthRequired) {
      tools = await connection.fetchTools();
    }

    if (tools && tools.length > 0) {
      availableTools = await updateMCPServerTools({
        userId: user.id,
        serverName,
        tools,
        skipCache: ephemeralServer,
      });
    }

    logger.debug(
      `[MCP Reinitialize] Sending response for ${serverName} - oauthRequired: ${oauthRequired}, oauthUrl: ${oauthUrl ? 'present' : 'null'}`,
    );

    const getResponseMessage = () => {
      if (oauthRequired && tools && tools.length > 0) {
        return `MCP server '${serverName}' tools discovered, OAuth required for execution`;
      }
      if (oauthRequired) {
        return `MCP server '${serverName}' ready for OAuth authentication`;
      }
      if (connection) {
        return `MCP server '${serverName}' reinitialized successfully`;
      }
      return `Failed to reinitialize MCP server '${serverName}'`;
    };

    const result = {
      availableTools,
      success: Boolean(
        (connection && !oauthRequired) ||
          (oauthRequired && oauthUrl) ||
          (tools && tools.length > 0),
      ),
      message: getResponseMessage(),
      oauthRequired,
      serverName,
      oauthUrl,
      tools,
    };

    logger.debug(`[MCP Reinitialize] Response for ${serverName}:`, {
      success: result.success,
      oauthRequired: result.oauthRequired,
      oauthUrl: result.oauthUrl ? 'present' : null,
      toolsCount: tools?.length ?? 0,
    });

    return result;
  } catch (error) {
    logger.error(
      '[MCP Reinitialize] Error loading MCP Tools, servers may still be initializing:',
      error,
    );
  } finally {
    if (connection && ephemeralServer && !requestScopedConnections) {
      try {
        await connection.disconnect();
      } catch (error) {
        logger.warn(
          `[MCP Reinitialize] Failed to disconnect ephemeral server ${serverName}`,
          error,
        );
      }
    }
  }
}

module.exports = {
  reinitMCPServer,
  isMCPServerAvailable,
  getMCPServerAvailability,
  buildMCPServerAvailabilityMap,
  getMCPServersOAuthStatus,
  collectMCPServerNames,
};
