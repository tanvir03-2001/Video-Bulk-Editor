import { useEffect, useState } from 'react';
import type { SettingsProfilesResult } from '../../hooks/useSettingsProfiles';
import { Button, Field, IconButton, Panel, Select, TextInput } from '../ui/ui';

const NEW_PROFILE_VALUE = '__new__';
const UNSAVED_VALUE = '';

interface SettingsProfilePickerProps<T> {
  profiles: SettingsProfilesResult<T>;
  disabled?: boolean;
}

export function SettingsProfilePicker<T>({
  profiles,
  disabled = false,
}: SettingsProfilePickerProps<T>) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);

  const selectValue = creating
    ? NEW_PROFILE_VALUE
    : (profiles.activeProfileId ?? UNSAVED_VALUE);

  useEffect(() => {
    if (!creating) {
      setNewName('');
      setCreateError(null);
    }
  }, [creating]);

  useEffect(() => {
    if (!renaming) {
      setRenameName('');
      setRenameError(null);
    }
  }, [renaming]);

  const handleSelectChange = (value: string) => {
    if (value === NEW_PROFILE_VALUE) {
      setCreating(true);
      setRenaming(false);
      return;
    }

    setCreating(false);
    profiles.selectProfile(value || null);
  };

  const handleCreate = () => {
    const result = profiles.createProfile(newName);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }

    setCreating(false);
    setNewName('');
    setCreateError(null);
  };

  const handleRename = () => {
    if (!profiles.activeProfileId) {
      return;
    }

    const result = profiles.renameProfile(profiles.activeProfileId, renameName);
    if (!result.ok) {
      setRenameError(result.error);
      return;
    }

    setRenaming(false);
    setRenameName('');
    setRenameError(null);
  };

  const handleDelete = () => {
    if (!profiles.activeProfileId) {
      return;
    }

    const deleted = profiles.deleteProfile(profiles.activeProfileId);
    if (deleted) {
      setRenaming(false);
      setCreating(false);
    }
  };

  const handleExport = async () => {
    setTransferBusy(true);
    setTransferMessage(null);
    setTransferError(null);
    const result = await profiles.exportProfiles();
    setTransferBusy(false);
    if (!result.ok) {
      if (result.error !== 'Export cancelled.') {
        setTransferError(result.error);
      }
      return;
    }
    setTransferMessage('Settings exported successfully.');
  };

  const handleImport = async () => {
    setTransferBusy(true);
    setTransferMessage(null);
    setTransferError(null);
    const result = await profiles.importProfiles();
    setTransferBusy(false);
    if (!result.ok) {
      if (result.error !== 'Import cancelled.') {
        setTransferError(result.error);
      }
      return;
    }
    setTransferMessage(
      `Imported ${result.importedCount} profile${result.importedCount === 1 ? '' : 's'}.`,
    );
  };

  return (
    <Panel className="space-y-3 bg-surface p-3.5">
      <div>
        <p className="text-sm font-semibold text-slate-100">Save settings</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Name and save editor settings. Select a profile to apply it instantly.
        </p>
      </div>

      <div className="flex items-end gap-2">
        <Field label="Profile" className="min-w-0 flex-1">
          <Select
            value={selectValue}
            disabled={disabled}
            onChange={(event) => {
              handleSelectChange(event.target.value);
            }}
          >
            <option value={UNSAVED_VALUE}>New (unsaved)</option>
            <option value={NEW_PROFILE_VALUE}>New…</option>
            {profiles.profiles.length > 0 ? <option disabled>──────────</option> : null}
            {profiles.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
        </Field>

        {profiles.activeProfileId ? (
          <>
            <IconButton
              icon="settings"
              label="Rename profile"
              disabled={disabled || creating}
              onClick={() => {
                setRenaming((open) => !open);
                setRenameName(profiles.activeProfileName ?? '');
                setCreating(false);
              }}
            />
            <IconButton
              icon="close"
              label="Delete profile"
              disabled={disabled || creating}
              onClick={handleDelete}
            />
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || transferBusy}
          onClick={() => {
            void handleImport();
          }}
        >
          Import
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || transferBusy || profiles.profiles.length === 0}
          onClick={() => {
            void handleExport();
          }}
        >
          Export
        </Button>
      </div>

      {transferError ? <p className="text-xs text-rose-400">{transferError}</p> : null}
      {transferMessage ? <p className="text-xs text-emerald-400">{transferMessage}</p> : null}

      {creating ? (
        <div className="space-y-2">
          <Field label="Profile name">
            <TextInput
              value={newName}
              disabled={disabled}
              placeholder="e.g. Tanvir"
              autoFocus
              onChange={(event) => {
                setNewName(event.target.value);
                setCreateError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleCreate();
                }
              }}
            />
          </Field>
          {createError ? <p className="text-xs text-rose-400">{createError}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={disabled} onClick={handleCreate}>
              Save profile
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setCreating(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {renaming && profiles.activeProfileId ? (
        <div className="space-y-2">
          <Field label="Rename profile">
            <TextInput
              value={renameName}
              disabled={disabled}
              autoFocus
              onChange={(event) => {
                setRenameName(event.target.value);
                setRenameError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleRename();
                }
              }}
            />
          </Field>
          {renameError ? <p className="text-xs text-rose-400">{renameError}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={disabled} onClick={handleRename}>
              Save name
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setRenaming(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {profiles.activeProfileName ? (
        <p className="text-[11px] text-slate-500">
          Active: <span className="text-slate-300">{profiles.activeProfileName}</span> — changes
          auto-save to this profile.
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">
          Choose <span className="text-slate-300">New…</span> to save current settings under a
          name.
        </p>
      )}
    </Panel>
  );
}
