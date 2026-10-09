import { APP_ROUTES } from './routes';
import type { AppRoutePath } from './routes';
import {
  MessageSquare,
  Folder,
  PlayCircle,
  Activity,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  path: AppRoutePath;
  icon: LucideIcon;
  shortcut: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    path: APP_ROUTES.CHAT,
    icon: MessageSquare,
    shortcut: 'Ctrl+1',
  },
  {
    id: 'files',
    label: 'Files',
    path: APP_ROUTES.FILES,
    icon: Folder,
    shortcut: 'Ctrl+2',
  },
  {
    id: 'automations',
    label: 'Tasks',
    path: APP_ROUTES.AUTOMATIONS,
    icon: PlayCircle,
    shortcut: 'Ctrl+3',
  },
  {
    id: 'telemetry',
    label: 'PC Health',
    path: APP_ROUTES.TELEMETRY,
    icon: Activity,
    shortcut: 'Ctrl+4',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: APP_ROUTES.SETTINGS,
    icon: Settings,
    shortcut: 'Ctrl+5',
  },
];

export const WORKSTATION_METADATA = {
  appTitle: 'OpenDesk',
  statusPill: 'PC Connected',
  version: 'Desktop',
};
