import type {
  SavedSettingsProfile,
  SettingsProfileExportFile,
  SettingsProfileStore,
  SettingsWorkspaceId,
} from '../../shared/settingsProfiles';
import {
  SETTINGS_PROFILE_NAME_MAX_LENGTH,
  SETTINGS_PROFILE_STORAGE_KEYS,
  SETTINGS_WORKSPACE_IDS,
} from '../../shared/settingsProfiles';

const LEGACY_COMPOSER_BRANDING_KEY = 'vfg-composer-branding';

function emptyStore<T>(): SettingsProfileStore<T> {
  return { activeProfileId: null, profiles: [] };
}

function parseStore<T>(raw: string): SettingsProfileStore<T> | null {
  const parsed = JSON.parse(raw) as Partial<SettingsProfileStore<T>>;
  if (!parsed || !Array.isArray(parsed.profiles)) {
    return null;
  }

  const profiles = parsed.profiles
    .filter(
      (profile): profile is SavedSettingsProfile<T> =>
        Boolean(profile) &&
        typeof profile.id === 'string' &&
        typeof profile.name === 'string' &&
        profile.data !== undefined &&
        typeof profile.updatedAt === 'number',
    )
    .map((profile) => ({
      id: profile.id,
      name: profile.name.trim(),
      data: profile.data,
      updatedAt: profile.updatedAt,
    }))
    .filter((profile) => profile.name.length > 0);

  const activeProfileId =
    typeof parsed.activeProfileId === 'string' &&
    profiles.some((profile) => profile.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : null;

  return { activeProfileId, profiles };
}

function migrateLegacyComposerStore<T>(): SettingsProfileStore<T> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_COMPOSER_BRANDING_KEY);
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw) as T;
    const profile: SavedSettingsProfile<T> = {
      id: crypto.randomUUID(),
      name: 'Default',
      data,
      updatedAt: Date.now(),
    };

    return {
      activeProfileId: profile.id,
      profiles: [profile],
    };
  } catch {
    return null;
  }
}

export function normalizeProfileName(name: string): string {
  return name.trim().slice(0, SETTINGS_PROFILE_NAME_MAX_LENGTH);
}

export function isDuplicateProfileName(
  profiles: SavedSettingsProfile<unknown>[],
  name: string,
  excludeId?: string,
): boolean {
  const normalized = normalizeProfileName(name).toLowerCase();
  if (!normalized) {
    return false;
  }

  return profiles.some(
    (profile) =>
      profile.id !== excludeId && profile.name.trim().toLowerCase() === normalized,
  );
}

export function loadSettingsProfileStore<T>(workspaceId: SettingsWorkspaceId): SettingsProfileStore<T> {
  if (typeof window === 'undefined') {
    return emptyStore();
  }

  const key = SETTINGS_PROFILE_STORAGE_KEYS[workspaceId];

  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = parseStore<T>(raw);
      if (parsed) {
        return parsed;
      }
    }
  } catch {
    // fall through to migration / empty store
  }

  if (workspaceId === 'composer') {
    const migrated = migrateLegacyComposerStore<T>();
    if (migrated) {
      saveSettingsProfileStore(workspaceId, migrated);
      try {
        window.localStorage.removeItem(LEGACY_COMPOSER_BRANDING_KEY);
      } catch {
        // ignore
      }
      return migrated;
    }
  }

  return emptyStore();
}

export function saveSettingsProfileStore<T>(
  workspaceId: SettingsWorkspaceId,
  store: SettingsProfileStore<T>,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      SETTINGS_PROFILE_STORAGE_KEYS[workspaceId],
      JSON.stringify(store),
    );
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function getInitialSettingsData<T>(
  workspaceId: SettingsWorkspaceId,
  defaults: T,
  mergeStored: (raw: Partial<T> | null | undefined, defaults: T) => T,
): T {
  const store = loadSettingsProfileStore<T>(workspaceId);
  if (!store.activeProfileId) {
    return defaults;
  }

  const profile = store.profiles.find((item) => item.id === store.activeProfileId);
  if (!profile) {
    return defaults;
  }

  return mergeStored(profile.data as Partial<T>, defaults);
}

function resolveUniqueImportedProfileName(
  existingProfiles: SavedSettingsProfile<unknown>[],
  baseName: string,
): string {
  const trimmedBase = normalizeProfileName(baseName);
  if (!isDuplicateProfileName(existingProfiles, trimmedBase)) {
    return trimmedBase;
  }

  for (let index = 1; index <= 99; index += 1) {
    const suffix = index === 1 ? ' (imported)' : ` (imported ${index})`;
    const maxBaseLength = Math.max(1, SETTINGS_PROFILE_NAME_MAX_LENGTH - suffix.length);
    const candidate = `${trimmedBase.slice(0, maxBaseLength)}${suffix}`;
    if (!isDuplicateProfileName(existingProfiles, candidate)) {
      return candidate;
    }
  }

  return `${trimmedBase.slice(0, 20)} (${crypto.randomUUID().slice(0, 6)})`;
}

export function parseSettingsProfileExportFile(raw: unknown): SettingsProfileExportFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid settings file');
  }

  const parsed = raw as Partial<SettingsProfileExportFile>;
  if (parsed.version !== 1) {
    throw new Error('Unsupported settings file version');
  }

  if (
    typeof parsed.workspaceId !== 'string' ||
    !SETTINGS_WORKSPACE_IDS.includes(parsed.workspaceId as SettingsWorkspaceId)
  ) {
    throw new Error('Invalid workspace in settings file');
  }

  if (!Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
    throw new Error('Settings file has no profiles');
  }

  const profiles = parsed.profiles
    .filter(
      (profile): profile is SavedSettingsProfile<unknown> =>
        Boolean(profile) &&
        typeof profile.id === 'string' &&
        typeof profile.name === 'string' &&
        profile.data !== undefined &&
        typeof profile.updatedAt === 'number',
    )
    .map((profile) => ({
      id: profile.id,
      name: normalizeProfileName(profile.name),
      data: profile.data,
      updatedAt: profile.updatedAt,
    }))
    .filter((profile) => profile.name.length > 0);

  if (profiles.length === 0) {
    throw new Error('Settings file has no valid profiles');
  }

  const activeProfileId =
    typeof parsed.activeProfileId === 'string' &&
    profiles.some((profile) => profile.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : null;

  return {
    version: 1,
    workspaceId: parsed.workspaceId as SettingsWorkspaceId,
    exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
    activeProfileId,
    profiles,
  };
}

export function mergeImportedProfiles<T>(
  store: SettingsProfileStore<T>,
  importedProfiles: SavedSettingsProfile<unknown>[],
): { store: SettingsProfileStore<T>; importedCount: number } {
  const nextProfiles = [...store.profiles];

  for (const imported of importedProfiles) {
    const name = resolveUniqueImportedProfileName(nextProfiles, imported.name);
    nextProfiles.push({
      id: crypto.randomUUID(),
      name,
      data: imported.data as T,
      updatedAt: Date.now(),
    });
  }

  return {
    store: {
      activeProfileId: store.activeProfileId,
      profiles: nextProfiles,
    },
    importedCount: importedProfiles.length,
  };
}
