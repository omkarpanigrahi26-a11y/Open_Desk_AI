import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronWindowAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  platform: string;
  onQuickTask: (callback: () => void) => () => void;
}

const electronAPI: ElectronWindowAPI = {
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  maximize: () => ipcRenderer.send('window-control', 'maximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  platform: process.platform,
  onQuickTask: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('quick-task-trigger', handler);
    return () => {
      ipcRenderer.removeListener('quick-task-trigger', handler);
    };
  },
};

// Securely expose window controls to React frontend
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
