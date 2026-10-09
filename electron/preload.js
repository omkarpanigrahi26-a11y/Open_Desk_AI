"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    minimize: () => electron_1.ipcRenderer.send('window-control', 'minimize'),
    maximize: () => electron_1.ipcRenderer.send('window-control', 'maximize'),
    close: () => electron_1.ipcRenderer.send('window-control', 'close'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window-is-maximized'),
    platform: process.platform,
    onQuickTask: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('quick-task-trigger', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('quick-task-trigger', handler);
        };
    },
};
// Securely expose window controls to React frontend
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
