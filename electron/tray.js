"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTray = setupTray;
exports.refreshShortcuts = refreshShortcuts;
exports.destroyTray = destroyTray;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let tray = null;
/**
 * Initializes and registers the native system tray icon and global shortcuts.
 */
function setupTray(mainWindow, onQuit) {
    if (tray) {
        try {
            tray.destroy();
        }
        catch { }
        tray = null;
    }
    const iconPath = path_1.default.join(__dirname, 'assets', 'icon.png');
    let icon;
    if (fs_1.default.existsSync(iconPath)) {
        icon = electron_1.nativeImage.createFromPath(iconPath);
    }
    else {
        // 16x16 fallback in-memory PNG
        icon = electron_1.nativeImage.createFromBuffer(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAY0lEQVR42mNk+M9QzwABjAwMDIz//zP8Z2RkZGBg/M/AwMDACBUgxMDIiCwwasCgNQAEu58RXRyjBgzcAAbhQ6QfGf5jA+h+jOHHqAGDNwBkBEYNGLQGYNSAAe+AAX0cAMX5F2u4lBuhAAAAAElFTkSuQmCC', 'base64'));
    }
    // Windows system tray expects 16x16 or 32x32 icon
    tray = new electron_1.Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('OpenDesk AI Workstation (24/7 Background)');
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Show Workspace (Ctrl + Space)',
            click: () => {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
        },
        {
            label: 'Run Quick Task',
            click: () => {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.webContents.send('quick-task-trigger');
                }
            },
        },
        { type: 'separator' },
        {
            label: 'Quit OpenDesk AI',
            click: () => {
                if (onQuit)
                    onQuit();
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    const summonWindow = () => {
        if (mainWindow.isDestroyed())
            return;
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        // Pierce Windows 10/11 foreground lock
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
    };
    // Left click toggles visibility
    tray.on('click', () => {
        if (mainWindow.isDestroyed())
            return;
        const isShowingAndFocused = mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused();
        if (isShowingAndFocused) {
            mainWindow.hide();
        }
        else {
            summonWindow();
        }
    });
    // Global toggle handler: Ctrl + Space, Alt + Space, Alt + K, etc.
    const toggleWindow = () => {
        if (mainWindow.isDestroyed())
            return;
        const isShowingAndFocused = mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused();
        if (isShowingAndFocused) {
            console.log('[Shortcut] Hiding OpenDesk AI window via global shortcut');
            mainWindow.hide();
        }
        else {
            console.log('[Shortcut] Summoning OpenDesk AI window to foreground');
            summonWindow();
        }
    };
    const triggerQuickVoice = () => {
        if (mainWindow.isDestroyed())
            return;
        summonWindow();
        mainWindow.webContents.send('quick-task-trigger');
    };
    // Register shortcuts with diagnostic logging
    const tryRegister = (accelerator, handler, name) => {
        try {
            const ok = electron_1.globalShortcut.register(accelerator, handler);
            console.log(`[Shortcut] ${name} ('${accelerator}'): ${ok ? 'SUCCESS' : 'FAILED (Reserved by Windows OS)'}`);
            return ok;
        }
        catch (err) {
            console.warn(`[Shortcut] Could not bind ${accelerator}:`, err.message);
            return false;
        }
    };
    // Summon Window shortcuts
    tryRegister('CommandOrControl+Space', toggleWindow, 'Toggle Window');
    tryRegister('Control+Space', toggleWindow, 'Toggle Window');
    tryRegister('Alt+Space', toggleWindow, 'Toggle Window (Alt+Space)');
    tryRegister('Alt+K', toggleWindow, 'Toggle Window (Alt+K)');
    tryRegister('CommandOrControl+Shift+Space', toggleWindow, 'Toggle Window (Ctrl+Shift+Space)');
    // Quick Task / Voice hotkeys
    tryRegister('CommandOrControl+M', triggerQuickVoice, 'Quick Voice (Ctrl+M)');
    tryRegister('Alt+M', triggerQuickVoice, 'Quick Voice (Alt+M)');
    return tray;
}
/**
 * Re-registers global shortcuts when system resumes from sleep/hibernate or screen unlock.
 */
function refreshShortcuts(mainWindow) {
    try {
        electron_1.globalShortcut.unregisterAll();
    }
    catch { }
    const summonWindow = () => {
        if (mainWindow.isDestroyed())
            return;
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
    };
    const toggleWindow = () => {
        if (mainWindow.isDestroyed())
            return;
        const isShowingAndFocused = mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused();
        if (isShowingAndFocused) {
            mainWindow.hide();
        }
        else {
            summonWindow();
        }
    };
    const triggerQuickVoice = () => {
        if (mainWindow.isDestroyed())
            return;
        summonWindow();
        mainWindow.webContents.send('quick-task-trigger');
    };
    const tryRegister = (accelerator, handler, name) => {
        try {
            const ok = electron_1.globalShortcut.register(accelerator, handler);
            console.log(`[Shortcut Re-register] ${name} ('${accelerator}'): ${ok ? 'SUCCESS' : 'FAILED'}`);
            return ok;
        }
        catch {
            return false;
        }
    };
    tryRegister('CommandOrControl+Space', toggleWindow, 'Toggle Window');
    tryRegister('Control+Space', toggleWindow, 'Toggle Window');
    tryRegister('Alt+Space', toggleWindow, 'Toggle Window (Alt+Space)');
    tryRegister('Alt+K', toggleWindow, 'Toggle Window (Alt+K)');
    tryRegister('CommandOrControl+Shift+Space', toggleWindow, 'Toggle Window (Ctrl+Shift+Space)');
    tryRegister('CommandOrControl+M', triggerQuickVoice, 'Quick Voice (Ctrl+M)');
    tryRegister('Alt+M', triggerQuickVoice, 'Quick Voice (Alt+M)');
}
/**
 * Clean up tray icon and global shortcuts upon application exit.
 */
function destroyTray() {
    try {
        electron_1.globalShortcut.unregisterAll();
    }
    catch { }
    if (tray) {
        tray.destroy();
        tray = null;
    }
}
