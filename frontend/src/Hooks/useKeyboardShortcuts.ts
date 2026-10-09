import { useEffect, useState, useCallback } from 'react';
import { APP_ROUTES } from '../Config/routes';
import type { AppRoutePath } from '../Config/routes';

export interface ShortcutDefinition {
  id: string;
  label: string;
  category: 'Navigation' | 'Action' | 'View';
  keyCombo: string; // e.g. "Ctrl+1", "Ctrl+K", "Ctrl+B"
  description: string;
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'nav_chat',
    label: 'Open Chat',
    category: 'Navigation',
    keyCombo: 'Ctrl+1',
    description: 'Switch to Assistant Chat view',
  },
  {
    id: 'nav_files',
    label: 'Open Files',
    category: 'Navigation',
    keyCombo: 'Ctrl+2',
    description: 'Switch to Files view',
  },
  {
    id: 'nav_tasks',
    label: 'Open Tasks',
    category: 'Navigation',
    keyCombo: 'Ctrl+3',
    description: 'Switch to Automations & Tasks view',
  },
  {
    id: 'nav_health',
    label: 'Open PC Health',
    category: 'Navigation',
    keyCombo: 'Ctrl+4',
    description: 'Switch to System Telemetry view',
  },
  {
    id: 'nav_settings',
    label: 'Open Settings',
    category: 'Navigation',
    keyCombo: 'Ctrl+5',
    description: 'Switch to Settings view',
  },
  {
    id: 'focus_input',
    label: 'Focus Input Bar',
    category: 'Action',
    keyCombo: 'Ctrl+K',
    description: 'Instantly focus the prompt input box',
  },
  {
    id: 'toggle_drawer',
    label: 'Toggle Side Panel',
    category: 'View',
    keyCombo: 'Ctrl+B',
    description: 'Show or hide the right PC status panel',
  },
  {
    id: 'approve_gate',
    label: 'Approve Permission Gate',
    category: 'Action',
    keyCombo: 'Ctrl+Y',
    description: 'Approve a paused safety confirmation',
  },
  {
    id: 'deny_gate',
    label: 'Deny Permission Gate',
    category: 'Action',
    keyCombo: 'Ctrl+N',
    description: 'Deny or halt a paused action',
  },
  {
    id: 'verify_step',
    label: 'Verify Manual Step',
    category: 'Action',
    keyCombo: 'Ctrl+R',
    description: 'Trigger automated check for manual task',
  },
];

const STORAGE_KEY = 'opendesk_keyboard_shortcuts';

export const getSavedShortcuts = (): ShortcutDefinition[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load keyboard shortcuts from storage:', err);
  }
  return DEFAULT_SHORTCUTS;
};

export const saveShortcuts = (shortcuts: ShortcutDefinition[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    window.dispatchEvent(new Event('opendesk_shortcuts_updated'));
  } catch (err) {
    console.warn('Failed to persist keyboard shortcuts:', err);
  }
};

interface UseKeyboardShortcutsProps {
  onNavigate?: (route: AppRoutePath) => void;
  onToggleDrawer?: () => void;
  onFocusInput?: () => void;
}

export const useKeyboardShortcuts = ({
  onNavigate,
  onToggleDrawer,
  onFocusInput,
}: UseKeyboardShortcutsProps = {}) => {
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>(getSavedShortcuts());

  useEffect(() => {
    const handleStorageUpdate = () => {
      setShortcuts(getSavedShortcuts());
    };

    window.addEventListener('opendesk_shortcuts_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('opendesk_shortcuts_updated', handleStorageUpdate);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when user is typing in regular inputs unless it's Ctrl or Alt combos
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toUpperCase();

      // Navigation Shortcuts: Ctrl+1 .. Ctrl+5
      if (ctrlOrMeta && onNavigate) {
        if (key === '1') {
          e.preventDefault();
          onNavigate(APP_ROUTES.CHAT);
          return;
        }
        if (key === '2') {
          e.preventDefault();
          onNavigate(APP_ROUTES.FILES);
          return;
        }
        if (key === '3') {
          e.preventDefault();
          onNavigate(APP_ROUTES.AUTOMATIONS);
          return;
        }
        if (key === '4') {
          e.preventDefault();
          onNavigate(APP_ROUTES.TELEMETRY);
          return;
        }
        if (key === '5') {
          e.preventDefault();
          onNavigate(APP_ROUTES.SETTINGS);
          return;
        }
      }

      // Focus input: Ctrl+K
      if (ctrlOrMeta && key === 'K') {
        e.preventDefault();
        onFocusInput?.();
        return;
      }

      // Toggle drawer: Ctrl+B
      if (ctrlOrMeta && key === 'B') {
        e.preventDefault();
        onToggleDrawer?.();
        return;
      }

      // Quick slash key '/' when not in input
      if (!isInput && e.key === '/') {
        e.preventDefault();
        onFocusInput?.();
        return;
      }

      // Escape key to blur active input
      if (e.key === 'Escape' && isInput) {
        (e.target as HTMLElement).blur();
      }
    },
    [onNavigate, onToggleDrawer, onFocusInput]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const updateShortcut = (id: string, newKeyCombo: string) => {
    const updated = shortcuts.map((s) =>
      s.id === id ? { ...s, keyCombo: newKeyCombo } : s
    );
    setShortcuts(updated);
    saveShortcuts(updated);
  };

  const resetToDefaults = () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    saveShortcuts(DEFAULT_SHORTCUTS);
  };

  return {
    shortcuts,
    updateShortcut,
    resetToDefaults,
  };
};
