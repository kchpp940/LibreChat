import React, { createContext, useContext, useMemo } from 'react';
import type { TRuntimeCapabilities } from 'librechat-data-provider';

const CapabilitiesContext = createContext<TRuntimeCapabilities | null>(null);

type CapabilitiesProviderProps = {
  capabilities: TRuntimeCapabilities | undefined;
  children: React.ReactNode;
};

export const defaultCapabilities: TRuntimeCapabilities = {
  models: { endpoints: {}, models: {} },
  files: { upload: true, download: true, preview: true, sharePointFilePickerEnabled: false, conversationImportMaxFileSize: 0 },
  artifacts: { enabled: false, codeExecution: false },
  sharedLinks: { enabled: false, publicEnabled: false },
  webSearch: { enabled: false },
  export: { conversation: true, messages: true },
  memory: { enabled: true },
  prompts: { use: true, create: true, share: false, public: false },
  agents: { use: true, create: true, share: false, public: false },
  skills: { use: true, create: true, share: false, public: false, defaultActiveOnShare: false },
  remoteAgents: { use: false, create: false, share: false, public: false },
  mcpServers: { use: true, create: true, share: false, public: false, configureObo: false, placeholder: undefined, trustCheckbox: undefined },
  marketplace: { use: false },
  interface: {
    modelSelect: true,
    parameters: true,
    multiConvo: true,
    bookmarks: true,
    memories: true,
    presets: true,
    temporaryChat: true,
    autoSubmitFromUrl: true,
    runCode: false,
    fileSearch: true,
    fileCitations: true,
    buildInfo: true,
    peoplePicker: { users: true, groups: true, roles: true },
  },
};

export function CapabilitiesProvider({
  capabilities,
  children,
}: CapabilitiesProviderProps) {
  const value = useMemo<TRuntimeCapabilities>(
    () => ({ ...defaultCapabilities, ...(capabilities ?? {}) } as TRuntimeCapabilities),
    [capabilities],
  );
  return (
    <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
  );
}

export function useCapabilities(): TRuntimeCapabilities {
  const ctx = useContext(CapabilitiesContext);
  if (!ctx) {
    return defaultCapabilities;
  }
  return ctx;
}

export function useCanUseModels() {
  const caps = useCapabilities();
  return Object.keys(caps.models.endpoints).length > 0;
}

export function useIsEndpointAvailable(endpoint: string) {
  const caps = useCapabilities();
  return !!caps.models.endpoints[endpoint];
}

export function useCanUploadFiles() {
  const caps = useCapabilities();
  return caps.files.upload;
}

export function useFileCapabilities() {
  const caps = useCapabilities();
  return caps.files;
}

export function useCanUseArtifacts() {
  const caps = useCapabilities();
  return caps.artifacts.enabled;
}

export function useCanRunCode() {
  const caps = useCapabilities();
  return caps.artifacts.codeExecution;
}

export function useArtifactBundlerURLs() {
  const caps = useCapabilities();
  return { bundlerURL: caps.artifacts.bundlerURL, staticBundlerURL: caps.artifacts.staticBundlerURL };
}

export function useCanShareConversations() {
  const caps = useCapabilities();
  return caps.sharedLinks.enabled;
}

export function useCanSharePublicly() {
  const caps = useCapabilities();
  return caps.sharedLinks.publicEnabled;
}

export function useCanUseWebSearch() {
  const caps = useCapabilities();
  return caps.webSearch.enabled;
}

export function useWebSearchCapabilities() {
  const caps = useCapabilities();
  return caps.webSearch;
}

export function useCanExportConversations() {
  const caps = useCapabilities();
  return caps.export.conversation;
}

export function useCanUseMemory() {
  const caps = useCapabilities();
  return caps.memory.enabled;
}

export function useCanUsePrompts() {
  const caps = useCapabilities();
  return caps.prompts.use;
}

export function useCanCreatePrompts() {
  const caps = useCapabilities();
  return caps.prompts.create;
}

export function useCanUseAgents() {
  const caps = useCapabilities();
  return caps.agents.use;
}

export function useCanCreateAgents() {
  const caps = useCapabilities();
  return caps.agents.create;
}

export function useCanUseSkills() {
  const caps = useCapabilities();
  return caps.skills.use;
}

export function useCanCreateSkills() {
  const caps = useCapabilities();
  return caps.skills.create;
}

export function useSkillCapabilities() {
  const caps = useCapabilities();
  return caps.skills;
}

export function useCanUseMCPServers() {
  const caps = useCapabilities();
  return caps.mcpServers.use;
}

export function useCanCreateMCPServers() {
  const caps = useCapabilities();
  return caps.mcpServers.create;
}

export function useMcpServerCapabilities() {
  const caps = useCapabilities();
  return caps.mcpServers;
}

export function useInterfaceFlags() {
  const caps = useCapabilities();
  return caps.interface;
}

export function useLegalPolicyLinks() {
  const caps = useCapabilities();
  return {
    privacyPolicy: caps.interface.privacyPolicy,
    termsOfService: caps.interface.termsOfService,
  };
}

export function useCanUseSharePoint() {
  const caps = useCapabilities();
  return caps.files.sharePointFilePickerEnabled;
}

export function useConversationImportMaxFileSize() {
  const caps = useCapabilities();
  return caps.files.conversationImportMaxFileSize;
}

export default CapabilitiesContext;
