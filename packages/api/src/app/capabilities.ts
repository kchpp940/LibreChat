import { isEnabled } from '~/utils';
import type { AppConfig } from '@librechat/data-schemas';
import type {
  TRuntimeCapabilities,
  TInterfaceConfig,
  TWebSearchConfig,
} from 'librechat-data-provider';

export const CAPABILITY_SCHEMA_VERSION = '1.0.0';

export type CapabilitySource = 'env' | 'yaml' | 'default' | 'merged';

export interface CapabilityMeta {
  schemaVersion: string;
  generatedAt: number;
  source: {
    env: boolean;
    yaml: boolean;
    defaults: boolean;
  };
  cacheTtlMs: number;
}

export interface CapabilitySnapshot {
  _meta: CapabilityMeta;
  capabilities: TRuntimeCapabilities;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeUseCreateShare(
  value: TInterfaceConfig['prompts'] | TInterfaceConfig['agents'] | TInterfaceConfig['skills'] | TInterfaceConfig['mcpServers'] | TInterfaceConfig['remoteAgents'] | TInterfaceConfig['sharedLinks'],
  defaults: { use: boolean; create: boolean; share: boolean; public: boolean },
): { use: boolean; create: boolean; share: boolean; public: boolean } {
  if (value === true) {
    return { use: true, create: true, share: defaults.share, public: defaults.public };
  }
  if (value === false) {
    return { use: false, create: false, share: false, public: false };
  }
  if (value && typeof value === 'object') {
    return {
      use: value.use ?? defaults.use,
      create: value.create ?? defaults.create,
      share: value.share ?? defaults.share,
      public: value.public ?? defaults.public,
    };
  }
  return defaults;
}

function normalizeSharedLinks(
  value: TInterfaceConfig['sharedLinks'],
  envSharedEnabled: boolean,
  envPublicEnabled: boolean,
): { enabled: boolean; publicEnabled: boolean } {
  if (value === false) {
    return { enabled: false, publicEnabled: false };
  }
  if (value === true) {
    return { enabled: envSharedEnabled, publicEnabled: envPublicEnabled };
  }
  if (value && typeof value === 'object') {
    const create = value.create ?? true;
    const share = value.share ?? true;
    const pub = value.public ?? true;
    const enabled = envSharedEnabled && (create || share);
    const publicEnabled = enabled && envPublicEnabled && pub;
    return { enabled, publicEnabled };
  }
  return { enabled: envSharedEnabled, publicEnabled: envPublicEnabled };
}

function normalizeMcpServers(
  value: TInterfaceConfig['mcpServers'],
  configureOboDefault: boolean,
): TRuntimeCapabilities['mcpServers'] {
  const base = normalizeUseCreateShare(value, { use: true, create: true, share: false, public: false });
  const trustCheckbox =
    value && typeof value === 'object' && value.trustCheckbox
      ? { label: value.trustCheckbox.label, subLabel: value.trustCheckbox.subLabel }
      : undefined;
  const placeholder =
    value && typeof value === 'object' ? value.placeholder : undefined;
  return {
    ...base,
    configureObo:
      value && typeof value === 'object' ? value.configureObo ?? configureOboDefault : configureOboDefault,
    placeholder,
    trustCheckbox,
  };
}

function normalizeSkills(
  value: TInterfaceConfig['skills'],
  defaults: { defaultActiveOnShare: boolean },
): TRuntimeCapabilities['skills'] {
  const base = normalizeUseCreateShare(value, { use: true, create: true, share: false, public: false });
  const defaultActiveOnShare =
    value && typeof value === 'object'
      ? value.defaultActiveOnShare ?? defaults.defaultActiveOnShare
      : defaults.defaultActiveOnShare;
  return { ...base, defaultActiveOnShare };
}

function normalizeWebSearch(
  webSearchConfig: TInterfaceConfig['webSearch'],
  ws: TWebSearchConfig | undefined,
): TRuntimeCapabilities['webSearch'] {
  const interfaceEnabled = webSearchConfig ?? true;
  const hasProvider = !!(ws?.searchProvider || ws?.scraperProvider || ws?.rerankerType);
  return {
    enabled: interfaceEnabled && hasProvider,
    searchProvider: ws?.searchProvider,
    scraperProvider: ws?.scraperProvider,
    rerankerType: ws?.rerankerType,
  };
}

function normalizeMemory(
  memoryConfig: TInterfaceConfig['memories'],
  memoryAppConfig: { tokenLimit?: number; disabled?: boolean } | undefined,
): TRuntimeCapabilities['memory'] {
  const interfaceEnabled = memoryConfig ?? true;
  const disabled = memoryAppConfig?.disabled ?? false;
  return {
    enabled: interfaceEnabled && !disabled,
    tokenLimit: memoryAppConfig?.tokenLimit,
  };
}

interface BuildCapabilitiesParams {
  appConfig?: AppConfig;
  endpointsConfig?: Record<string, unknown>;
  modelsConfig?: Record<string, unknown>;
}

/**
 * Builds a full TRuntimeCapabilities object by merging env vars,
 * librechat.yaml (appConfig), and hardcoded defaults.
 *
 * @deprecated Prefer `CapabilityRegistry.getCapabilities()` which provides
 * a cached, versioned snapshot with metadata. Use `buildCapabilities()` only
 * for one-off computation or tests.
 */
export function buildCapabilities({
  appConfig,
  endpointsConfig,
  modelsConfig,
}: BuildCapabilitiesParams = {}): TRuntimeCapabilities {
  const interfaceConfig = (appConfig?.interfaceConfig ?? {}) as TInterfaceConfig;

  const sharedLinksEnabled =
    process.env.ALLOW_SHARED_LINKS === undefined || isEnabled(process.env.ALLOW_SHARED_LINKS);
  const publicSharedLinksEnabled =
    sharedLinksEnabled && isEnabled(process.env.ALLOW_SHARED_LINKS_PUBLIC);

  const artifactsEnabled = !!(process.env.SANDPACK_BUNDLER_URL || process.env.SANDPACK_STATIC_BUNDLER_URL);
  const codeExecutionEnabled = (interfaceConfig.runCode ?? true) && artifactsEnabled;

  const sharePointFilePickerEnabled = isEnabled(process.env.ENABLE_SHAREPOINT_FILEPICKER);
  const conversationImportMaxFileSize = process.env.CONVERSATION_IMPORT_MAX_FILE_SIZE_BYTES
    ? parseInt(process.env.CONVERSATION_IMPORT_MAX_FILE_SIZE_BYTES, 10)
    : 0;

  const endpoints = endpointsConfig ?? {};
  const endpointMap: Record<string, boolean> = {};
  for (const key of Object.keys(endpoints)) {
    endpointMap[key] = true;
  }

  const models = modelsConfig ?? {};
  const modelMap: Record<string, boolean> = {};
  for (const key of Object.keys(models)) {
    modelMap[key] = true;
  }

  const prompts = normalizeUseCreateShare(interfaceConfig.prompts, {
    use: true,
    create: true,
    share: false,
    public: false,
  });

  const agents = normalizeUseCreateShare(interfaceConfig.agents, {
    use: true,
    create: true,
    share: false,
    public: false,
  });

  const remoteAgents = normalizeUseCreateShare(interfaceConfig.remoteAgents, {
    use: false,
    create: false,
    share: false,
    public: false,
  });

  const skills = normalizeSkills(interfaceConfig.skills, { defaultActiveOnShare: false });
  const mcpServers = normalizeMcpServers(interfaceConfig.mcpServers, false);

  const sharedLinks = normalizeSharedLinks(
    interfaceConfig.sharedLinks,
    sharedLinksEnabled,
    publicSharedLinksEnabled,
  );

  const webSearch = normalizeWebSearch(
    interfaceConfig.webSearch,
    appConfig?.webSearch as TWebSearchConfig | undefined,
  );

  const memory = normalizeMemory(
    interfaceConfig.memories,
    appConfig?.memory as { tokenLimit?: number; disabled?: boolean } | undefined,
  );

  return {
    models: {
      endpoints: endpointMap,
      models: modelMap,
    },
    files: {
      upload: true,
      download: true,
      preview: true,
      maxFileSize: conversationImportMaxFileSize || undefined,
      sharePointFilePickerEnabled,
      sharePointBaseUrl: process.env.SHAREPOINT_BASE_URL,
      sharePointPickerGraphScope: process.env.SHAREPOINT_PICKER_GRAPH_SCOPE,
      sharePointPickerSharePointScope: process.env.SHAREPOINT_PICKER_SHAREPOINT_SCOPE,
      conversationImportMaxFileSize,
    },
    artifacts: {
      enabled: artifactsEnabled,
      codeExecution: codeExecutionEnabled,
      bundlerURL: process.env.SANDPACK_BUNDLER_URL,
      staticBundlerURL: process.env.SANDPACK_STATIC_BUNDLER_URL,
    },
    sharedLinks,
    webSearch,
    export: {
      conversation: true,
      messages: true,
    },
    memory,
    prompts,
    agents,
    skills,
    remoteAgents,
    mcpServers,
    marketplace: {
      use: interfaceConfig.marketplace?.use ?? false,
    },
    interface: {
      modelSelect: interfaceConfig.modelSelect ?? true,
      parameters: interfaceConfig.parameters ?? true,
      multiConvo: interfaceConfig.multiConvo ?? true,
      bookmarks: interfaceConfig.bookmarks ?? true,
      memories: interfaceConfig.memories ?? true,
      presets: interfaceConfig.presets ?? true,
      temporaryChat: interfaceConfig.temporaryChat ?? true,
      autoSubmitFromUrl: interfaceConfig.autoSubmitFromUrl ?? true,
      runCode: codeExecutionEnabled,
      fileSearch: interfaceConfig.fileSearch ?? true,
      fileCitations: interfaceConfig.fileCitations ?? true,
      buildInfo: interfaceConfig.buildInfo ?? true,
      customWelcome: interfaceConfig.customWelcome,
      privacyPolicy: interfaceConfig.privacyPolicy,
      termsOfService: interfaceConfig.termsOfService,
      peoplePicker: {
        users: interfaceConfig.peoplePicker?.users ?? true,
        groups: interfaceConfig.peoplePicker?.groups ?? true,
        roles: interfaceConfig.peoplePicker?.roles ?? true,
      },
    },
  };
}

type LoaderFn = () => Promise<{
  appConfig?: AppConfig;
  endpointsConfig?: Record<string, unknown>;
  modelsConfig?: Record<string, unknown>;
}>;

/**
 * Singleton CapabilityRegistry — the single source of truth for runtime
 * capabilities on the server.
 *
 * Both `/api/capabilities` and `/api/config.capabilities` read from this
 * registry to guarantee consistent output under the same startup config.
 * The snapshot is cached with a TTL and can be invalidated on-demand
 * (e.g. when config files are reloaded).
 */
class CapabilityRegistry {
  private snapshot: CapabilitySnapshot | null = null;
  private cacheTtlMs: number = DEFAULT_CACHE_TTL_MS;
  private loader: LoaderFn | null = null;
  private refreshPromise: Promise<CapabilitySnapshot> | null = null;

  setCacheTtl(ttlMs: number) {
    this.cacheTtlMs = ttlMs;
  }

  /**
   * Register the async loader that fetches upstream configs (appConfig,
   * endpointsConfig, modelsConfig). The loader is called on cache miss.
   */
  setLoader(loader: LoaderFn) {
    this.loader = loader;
  }

  private isFresh(snapshot: CapabilitySnapshot): boolean {
    return Date.now() - snapshot._meta.generatedAt < this.cacheTtlMs;
  }

  private buildMeta(source: { env: boolean; yaml: boolean; defaults: boolean }): CapabilityMeta {
    return {
      schemaVersion: CAPABILITY_SCHEMA_VERSION,
      generatedAt: Date.now(),
      source,
      cacheTtlMs: this.cacheTtlMs,
    };
  }

  /**
   * Returns the current capabilities snapshot. If the cache is stale or
   * missing, it refreshes from the registered loader. Concurrent calls
   * share the same in-flight refresh promise.
   */
  async getSnapshot(): Promise<CapabilitySnapshot> {
    if (this.snapshot && this.isFresh(this.snapshot)) {
      return this.snapshot;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  /**
   * Convenience: returns only the capabilities payload (without _meta).
   * This is what most API consumers want.
   */
  async getCapabilities(): Promise<TRuntimeCapabilities> {
    const snapshot = await this.getSnapshot();
    return snapshot.capabilities;
  }

  /**
   * Force an immediate refresh from the loader, bypassing cache.
   * Useful after a config hot-reload or manual change.
   */
  async refresh(): Promise<CapabilitySnapshot> {
    this.snapshot = null;
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  /**
   * Invalidate the cache. The next call to getSnapshot() / getCapabilities()
   * will trigger a fresh build.
   */
  invalidate() {
    this.snapshot = null;
    this.refreshPromise = null;
  }

  private async doRefresh(): Promise<CapabilitySnapshot> {
    if (!this.loader) {
      throw new Error(
        'CapabilityRegistry loader not registered. Call registry.setLoader() before getCapabilities().',
      );
    }

    const { appConfig, endpointsConfig, modelsConfig } = await this.loader();

    const capabilities = buildCapabilities({ appConfig, endpointsConfig, modelsConfig });

    const source = {
      env: true,
      yaml: !!appConfig,
      defaults: true,
    };

    const snapshot: CapabilitySnapshot = {
      _meta: this.buildMeta(source),
      capabilities,
    };

    this.snapshot = snapshot;
    return snapshot;
  }
}

/**
 * The global singleton CapabilityRegistry instance.
 *
 * Both `/api/config` and `/api/capabilities` routes read from this instance
 * so they always return identical capability values for the same input.
 *
 * Usage:
 *   import { capabilityRegistry } from '~/app/capabilities';
 *   capabilityRegistry.setLoader(async () => { ... });
 *   const caps = await capabilityRegistry.getCapabilities();
 */
export const capabilityRegistry = new CapabilityRegistry();

export default capabilityRegistry;
