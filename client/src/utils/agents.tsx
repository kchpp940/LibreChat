import React, { useState, useEffect } from 'react';
import { Feather } from 'lucide-react';
import { Skeleton } from '@librechat/client';
import type t from 'librechat-data-provider';

/**
 * PublicFileAssetDescriptor boundary adapter for avatars — LEGACY ONLY.
 *
 * ⚠️  MIGRATION STATUS: All agent/assistant avatar serializers now return
 *     descriptors with `.url` populated (files/avatar.js route uses
 *     toPublicFileDescriptor). These helpers are ONLY for backward-compat
 *     with data saved before v0.8.x that may still have `filepath`/`source`.
 *
 *     New code should use `avatar.url` directly.
 *
 * SAFETY: This is the ONLY place in client code where `avatar.filepath` and
 * `avatar.source` may be accessed. All other components, hooks and
 * data-provider code are FORBIDDEN from reading these fields — enforcement
 * via `check:file-boundary` script.
 *
 * ❌ Never add `avatar.filepath` / `avatar.source` access anywhere else.
 * ✅ Use `avatar.url` / `getAvatarUrl(avatar)` only.
 *
 * Extracts the avatar URL from an agent's avatar property.
 * Handles both string (legacy raw URL) and object formats.
 */
export const getAgentAvatarUrl = (agent: t.Agent | null | undefined): string | null => {
  if (!agent?.avatar) {
    return null;
  }

  if (typeof agent.avatar === 'string') {
    return agent.avatar;
  }

  return getAvatarUrl(agent.avatar);
};

/**
 * ⚠️ LEGACY COMPAT ONLY — will be removed.
 *
 * Extracts the avatar URL from an avatar descriptor object.
 * For new code use `avatar.url` directly; this fallback handles only
 * pre-refactor cached data.
 *
 * @deprecated Use `avatar.url` directly — avatar route serializers now
 *             return PublicFileAssetDescriptor-compatible objects with
 *             `.url` populated.
 */
export const getAvatarUrl = (
  avatar: t.AgentAvatar | t.AssistantAvatar | undefined | null,
): string | null => {
  if (!avatar) return null;
  if (typeof avatar === 'string') return avatar;
  return avatar.url ?? avatar.filepath ?? null;
};

const LazyAgentAvatar = ({
  url,
  alt,
  imgClass,
}: {
  url: string;
  alt: string;
  imgClass: string;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [url]);

  return (
    <>
      <img
        src={url}
        alt={alt}
        className={imgClass}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(false)}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
      {!isLoaded && <Skeleton className="absolute inset-0 rounded-full" aria-hidden="true" />}
    </>
  );
};

/**
 * Renders an agent avatar with fallback to Bot icon
 * Consistent across all agent displays
 */
export const renderAgentAvatar = (
  agent: t.Agent | null | undefined,
  options: {
    size?: 'icon' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    showBorder?: boolean;
  } = {},
): React.ReactElement => {
  const { size = 'md', className = '', showBorder = true } = options;

  const avatarUrl = getAgentAvatarUrl(agent);

  // Size mappings for responsive design
  const sizeClasses = {
    icon: 'h-5 w-5',
    sm: 'h-12 w-12 sm:h-14 sm:w-14',
    md: 'h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24',
    lg: 'h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28',
    xl: 'h-24 w-24',
  };

  const iconSizeClasses = {
    icon: 'h-4 w-4',
    sm: 'h-6 w-6 sm:h-7 sm:w-7',
    md: 'h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10',
    lg: 'h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12',
    xl: 'h-10 w-10',
  };

  const placeholderSizeClasses = {
    icon: 'h-5 w-5',
    sm: 'h-10 w-10 sm:h-12 sm:w-12',
    md: 'h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20',
    lg: 'h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24',
    xl: 'h-20 w-20',
  };

  const borderClasses = showBorder ? 'border-1 border-border-medium' : '';

  if (avatarUrl) {
    return (
      <div
        className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`}
      >
        <LazyAgentAvatar
          url={avatarUrl}
          alt={`${agent?.name || 'Agent'} avatar`}
          imgClass={`${sizeClasses[size]} rounded-full object-cover shadow-lg ${borderClasses}`}
        />
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`}>
      <Feather className={`text-text-primary ${iconSizeClasses[size]}`} strokeWidth={1.5} />
    </div>
  );
};

/**
 * Gets the display name for a contact (prioritizes name over email)
 */
export const getContactDisplayName = (agent: t.Agent | null | undefined): string | null => {
  if (!agent) return null;

  const supportName = (agent as any).support_contact?.name;
  const supportEmail = (agent as any).support_contact?.email;
  const authorName = (agent as any).authorName;

  return supportName || authorName || supportEmail || null;
};

// All hardcoded category constants removed - now using database-driven categories
