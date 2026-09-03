import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SavedSettingsProfile,
  SettingsProfileExportFile,
  SettingsProfileStore,
  SettingsWorkspaceId,
} from '../../shared/settingsProfiles';
import {
  isDuplicateProfileName,
  loadSettingsProfileStore,
  mergeImportedProfiles,
  normalizeProfileName,
  parseSettingsProfileExportFile,
  saveSettingsProfileStore,
} from '../utils/settingsProfileStorage';

export interface SettingsProfilesResult<T> {
  workspaceId: SettingsWorkspaceId;
  profiles: SavedSettingsProfile<T>[];
  activeProfileId: string | null;
  activeProfileName: string | null;
  selectProfile: (profileId: string | null) => void;
  createProfile: (name: string) => { ok: true } | { ok: false; error: string };
  renameProfile: (
    profileId: string,
    name: string,
  ) => { ok: true } | { ok: false; error: string };
  deleteProfile: (profileId: string) => boolean;
  exportProfiles: () => Promise<{ ok: true } | { ok: false; error: string }>;
  importProfiles: () => Promise<
    { ok: true; importedCount: number } | { ok: false; error: string }
  >;
}

interface UseSettingsProfilesOptions<T> {
  workspaceId: SettingsWorkspaceId;
  defaults: T;
  mergeStored: (raw: Partial<T> | null | undefined, defaults: T) => T;
  currentData: T;
  applyData: (data: T) => void;
}

export function useSettingsProfiles<T>({
  workspaceId,
  defaults,
  mergeStored,
  currentData,
  applyData,
}: UseSettingsProfilesOptions<T>): SettingsProfilesResult<T> {
  const [store, setStore] = useState<SettingsProfileStore<T>>(() =>
    loadSettingsProfileStore<T>(workspaceId),
  );
  const isApplyingRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const currentDataRef = useRef(currentData);

  useEffect(() => {
    currentDataRef.current = currentData;
  }, [currentData]);

  const selectProfile = useCallback(
    (profileId: string | null) => {
      setStore((current) => {
        if (profileId === null) {
          const next = { ...current, activeProfileId: null };
          saveSettingsProfileStore(workspaceId, next);
          return next;
        }

        const profile = current.profiles.find((item) => item.id === profileId);
        if (!profile) {
          return current;
        }

        isApplyingRef.current = true;
        applyData(mergeStored(profile.data as Partial<T>, defaults));
        const next = { ...current, activeProfileId: profileId };
        saveSettingsProfileStore(workspaceId, next);
        queueMicrotask(() => {
          isApplyingRef.current = false;
        });
        return next;
      });
    },
    [applyData, defaults, mergeStored, workspaceId],
  );

  const createProfile = useCallback(
    (name: string) => {
      const trimmed = normalizeProfileName(name);
      if (!trimmed) {
        return { ok: false as const, error: 'Enter a profile name.' };
      }

      let duplicate = false;
      setStore((current) => {
        if (isDuplicateProfileName(current.profiles, trimmed)) {
          duplicate = true;
          return current;
        }

        const profile: SavedSettingsProfile<T> = {
          id: crypto.randomUUID(),
          name: trimmed,
          data: currentDataRef.current,
          updatedAt: Date.now(),
        };

        const next = {
          activeProfileId: profile.id,
          profiles: [...current.profiles, profile],
        };
        saveSettingsProfileStore(workspaceId, next);
        return next;
      });

      if (duplicate) {
        return { ok: false as const, error: 'A profile with this name already exists.' };
      }

      return { ok: true as const };
    },
    [workspaceId],
  );

  const renameProfile = useCallback(
    (profileId: string, name: string) => {
      const trimmed = normalizeProfileName(name);
      if (!trimmed) {
        return { ok: false as const, error: 'Enter a profile name.' };
      }

      let duplicate = false;
      setStore((current) => {
        if (isDuplicateProfileName(current.profiles, trimmed, profileId)) {
          duplicate = true;
          return current;
        }

        const next = {
          ...current,
          profiles: current.profiles.map((profile) =>
            profile.id === profileId
              ? { ...profile, name: trimmed, updatedAt: Date.now() }
              : profile,
          ),
        };
        saveSettingsProfileStore(workspaceId, next);
        return next;
      });

      if (duplicate) {
        return { ok: false as const, error: 'A profile with this name already exists.' };
      }

      return { ok: true as const };
    },
    [workspaceId],
  );

  const deleteProfile = useCallback(
    (profileId: string) => {
      let deleted = false;

      setStore((current) => {
        const profile = current.profiles.find((item) => item.id === profileId);
        if (!profile) {
          return current;
        }

        const confirmed = window.confirm(`Delete saved settings "${profile.name}"?`);
        if (!confirmed) {
          return current;
        }

        deleted = true;
        const next = {
          activeProfileId: current.activeProfileId === profileId ? null : current.activeProfileId,
          profiles: current.profiles.filter((item) => item.id !== profileId),
        };
        saveSettingsProfileStore(workspaceId, next);
        return next;
      });

      return deleted;
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!store.activeProfileId || isApplyingRef.current) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      setStore((current) => {
        const activeId = current.activeProfileId;
        if (!activeId) {
          return current;
        }

        const next: SettingsProfileStore<T> = {
          ...current,
          profiles: current.profiles.map((profile) =>
            profile.id === activeId
              ? { ...profile, data: currentDataRef.current, updatedAt: Date.now() }
              : profile,
          ),
        };

        saveSettingsProfileStore(workspaceId, next);
        return next;
      });
    }, 300);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentData, store.activeProfileId, workspaceId]);

  const activeProfileName = useMemo(() => {
    if (!store.activeProfileId) {
      return null;
    }
    return store.profiles.find((profile) => profile.id === store.activeProfileId)?.name ?? null;
  }, [store.activeProfileId, store.profiles]);

  const exportProfiles = useCallback(async () => {
    if (store.profiles.length === 0) {
      return { ok: false as const, error: 'No profiles to export.' };
    }

    const payload: SettingsProfileExportFile = {
      version: 1,
      workspaceId,
      exportedAt: Date.now(),
      activeProfileId: store.activeProfileId,
      profiles: store.profiles,
    };

    try {
      const saved = await window.api.saveSettingsProfileFile({
        defaultName: `frame-studio-${workspaceId}-settings.json`,
        contents: JSON.stringify(payload, null, 2),
      });
      if (!saved) {
        return { ok: false as const, error: 'Export cancelled.' };
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: 'Unable to export settings.' };
    }
  }, [store.activeProfileId, store.profiles, workspaceId]);

  const importProfiles = useCallback(async () => {
    try {
      const raw = await window.api.readSettingsProfileFile();
      if (!raw) {
        return { ok: false as const, error: 'Import cancelled.' };
      }

      const parsed = parseSettingsProfileExportFile(JSON.parse(raw) as unknown);
      if (parsed.workspaceId !== workspaceId) {
        return {
          ok: false as const,
          error: `This file is for ${parsed.workspaceId}, not ${workspaceId}.`,
        };
      }

      let importedCount = 0;
      setStore((current) => {
        const merged = mergeImportedProfiles(current, parsed.profiles);
        importedCount = merged.importedCount;
        saveSettingsProfileStore(workspaceId, merged.store);
        return merged.store;
      });

      return { ok: true as const, importedCount };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Unable to import settings.',
      };
    }
  }, [workspaceId]);

  return {
    workspaceId,
    profiles: store.profiles,
    activeProfileId: store.activeProfileId,
    activeProfileName,
    selectProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    exportProfiles,
    importProfiles,
  };
}
