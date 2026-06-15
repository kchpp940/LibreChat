export enum ToolType {
  builtin = 'builtin',
  mcp = 'mcp',
  action = 'action',
  plugin = 'plugin',
  system = 'system',
}

export enum ToolUnavailableReason {
  capability_disabled = 'capability_disabled',
  permission_denied = 'permission_denied',
  mcp_server_unavailable = 'mcp_server_unavailable',
  mcp_not_authorized = 'mcp_not_authorized',
  mcp_oauth_required = 'mcp_oauth_required',
  mcp_missing_user_vars = 'mcp_missing_user_vars',
  mcp_not_connected = 'mcp_not_connected',
  mcp_malformed_key = 'mcp_malformed_key',
  model_not_supported = 'model_not_supported',
  not_found = 'not_found',
  malformed_key = 'malformed_key',
  domain_not_allowed = 'domain_not_allowed',
  admin_filtered = 'admin_filtered',
  registry_unavailable = 'registry_unavailable',
}

export enum MCPAuthStatus {
  authorized = 'authorized',
  not_authorized = 'not_authorized',
  oauth_pending = 'oauth_pending',
  oauth_required = 'oauth_required',
  user_vars_required = 'user_vars_required',
  not_applicable = 'not_applicable',
}

export enum ToolPermissionStatus {
  allowed = 'allowed',
  denied = 'denied',
  requires_auth = 'requires_auth',
  unknown = 'unknown',
}

export enum MCPConnectionState {
  disconnected = 'disconnected',
  connecting = 'connecting',
  connected = 'connected',
  error = 'error',
  unknown = 'unknown',
}

export interface ToolAvailability {
  toolKey: string;
  toolType: ToolType;
  isAvailable: boolean;
  reason?: ToolUnavailableReason;
  message?: string;
  permissionStatus: ToolPermissionStatus;
  mcpAuthStatus?: MCPAuthStatus;
  mcpServerName?: string;
  mcpConnectionState?: MCPConnectionState;
  requiresUserVars?: boolean;
  missingUserVars?: string[];
  capability?: string;
  capabilityEnabled?: boolean;
  authenticated?: boolean;
  authConfig?: unknown[];
  domain?: string;
  domainAllowed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolAvailabilityResult {
  tools: Record<string, ToolAvailability>;
  availableToolKeys: string[];
  unavailableToolKeys: string[];
  summary: {
    total: number;
    available: number;
    unavailable: number;
    byReason: Partial<Record<ToolUnavailableReason, string[]>>;
  };
}

export interface ResolveToolAvailabilityOptions {
  userId?: string;
  userRole?: string;
  agentId?: string;
  tools?: string[];
  model?: string;
  provider?: string;
  endpoint?: string;
  enabledCapabilities?: Set<string> | string[];
  checkMCPConnection?: boolean;
  checkMCPPermissions?: boolean;
}

export interface ToolValidationIssue {
  toolKey: string;
  category: 'tool_permissions' | 'mcp_status' | 'model_availability' | 'file_index';
  severity: 'error' | 'warning';
  message: string;
  reason?: ToolUnavailableReason;
  detail?: string;
  field?: string;
}

export interface ResolveToolAvailabilityParams {
  tools: string[];
  agent_id?: string;
  endpoint?: string;
  model?: string;
  provider?: string;
  enabledCapabilities?: string[];
  /** Per-tool overrides currently selected in the agent form */
  selectedTools?: string[];
}
