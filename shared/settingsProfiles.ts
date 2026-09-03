export type SettingsWorkspaceId = 'composer' | 'branding' | 'image-editor';

export const SETTINGS_WORKSPACE_IDS: SettingsWorkspaceId[] = [
  'composer',
  'branding',
  'image-editor',
];

export interface SavedSettingsProfile<T> {
  id: string;
  name: string;
  data: T;
  updatedAt: number;
}

export interface SettingsProfileStore<T> {
  activeProfileId: string | null;
  profiles: SavedSettingsProfile<T>[];
}

export interface SettingsProfileExportFile {
  version: 1;
  workspaceId: SettingsWorkspaceId;
  exportedAt: number;
  activeProfileId: string | null;
  profiles: SavedSettingsProfile<unknown>[];
}

export const SETTINGS_PROFILE_NAME_MAX_LENGTH = 40;

export const SETTINGS_PROFILE_STORAGE_KEYS: Record<SettingsWorkspaceId, string> = {
  composer: 'vfg-settings-profiles-composer',
  branding: 'vfg-settings-profiles-branding',
  'image-editor': 'vfg-settings-profiles-image-editor',
};
