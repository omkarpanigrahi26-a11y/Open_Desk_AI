import { app, BrowserWindow, ipcMain, session, powerMonitor } from 'electron';
import { spawn, ChildProcess, exec } from 'child_process';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { setupTray, destroyTray, refreshShortcuts } from './tray';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let isQuitting = false;
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

async function checkBackendAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      const req2 = http.get('http://localhost:8000/api/health', (res2) => {
        resolve(res2.statusCode === 200);
      });
      req2.on('error', () => resolve(false));
      req2.setTimeout(400, () => {
        req2.destroy();
        resolve(false);
      });
    });
    req.setTimeout(400, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 1. Spawns the Node backend server directly via child_process.spawn.
 */
async function startBackendServer(): Promise<void> {
  const isAlive = await checkBackendAlive();
  if (isAlive) {
    console.log('[Electron] Backend server is already running. Skipping spawn.');
    return;
  }

  const rootDir = path.resolve(__dirname, '..');
  const backendDistPath = path.join(rootDir, 'backend', 'dist', 'server.js');

  const useCompiled = !isDev && fs.existsSync(backendDistPath);

  if (useCompiled) {
    console.log('[Electron] Launching compiled backend server:', backendDistPath);
    backendProcess = spawn('node', [backendDistPath], {
      cwd: path.join(rootDir, 'backend'),
      env: {
        ...process.env,
        PORT: process.env.PORT || '8000',
      },
      stdio: 'pipe',
    });
  } else {
    console.log('[Electron] Launching dev backend server (npm --prefix backend run dev)');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    backendProcess = spawn(npmCmd, ['--prefix', 'backend', 'run', 'dev'], {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: process.env.PORT || '8000',
      },
      shell: true,
      stdio: 'pipe',
    });
  }

  backendProcess.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[Backend stdout] ${msg}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[Backend stderr] ${msg}`);
  });

  backendProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend process:', err);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Electron] Backend process exited with code ${code}, signal ${signal}`);
    backendProcess = null;
  });
}

/**
 * 2. Health-polling check against http://127.0.0.1:8000/api/health (with 3000 fallback).
 */
function pollHealth(targetUrl = 'http://localhost:8000/api/health', maxAttempts = 30, intervalMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = (url: string) => {
      attempts++;
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          console.log(`[Electron] Health check passed on ${url}`);
          resolve(true);
        } else {
          tryFallbackOrRetry();
        }
      });

      const tryFallbackOrRetry = () => {
        if (url.includes(':8000')) {
          const fallbackReq = http.get('http://localhost:3000/api/health', (fallbackRes) => {
            if (fallbackRes.statusCode === 200) {
              console.log('[Electron] Health check passed on http://localhost:3000/api/health');
              resolve(true);
            } else {
              retry();
            }
          });
          fallbackReq.on('error', () => retry());
          fallbackReq.setTimeout(400, () => {
            fallbackReq.destroy();
            retry();
          });
        } else {
          retry();
        }
      };

      req.on('error', () => tryFallbackOrRetry());
      req.setTimeout(500, () => {
        req.destroy();
        tryFallbackOrRetry();
      });
    };

    const retry = () => {
      if (attempts >= maxAttempts) {
        console.warn('[Electron] Backend health-check polling timeout reached. Revealing window anyway.');
        resolve(false);
      } else {
        setTimeout(() => check(targetUrl), intervalMs);
      }
    };

    check(targetUrl);
  });
}

async function checkViteActive(retries = 4, delayMs = 500): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    const isUp = await new Promise<boolean>((resolve) => {
      const req = http.get('http://localhost:5173', (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 304);
      });
      req.on('error', () => {
        const req2 = http.get('http://127.0.0.1:5173', (res2) => {
          resolve(res2.statusCode === 200 || res2.statusCode === 304);
        });
        req2.on('error', () => resolve(false));
        req2.setTimeout(350, () => {
          req2.destroy();
          resolve(false);
        });
      });
      req.setTimeout(350, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (isUp) return true;
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

/**
 * 3. Creates the frameless BrowserWindow with native title controls.
 */
async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#090d16',
      symbolColor: '#94a3b8',
      height: 36,
    } : false,
    backgroundColor: '#070a12',
    show: false, // Initially hidden until backend passes health check
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Ensures local static assets & file:// bundles load without CORS blocks
    },
  });

  // Prevent app exit when closing window - hide to tray for 24/7 background operation
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
  });

  // Setup system tray and global shortcuts
  setupTray(mainWindow, () => {
    isQuitting = true;
  });

  const prodIndex = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');

  // Enable F12 (DevTools) and Ctrl+R/F5 (Intelligent Reload)
  mainWindow.webContents.on('before-input-event', async (event, input) => {
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      event.preventDefault();
      const isUp = await checkViteActive(1, 200);
      if (isUp) {
        mainWindow?.loadURL('http://localhost:5173');
      } else {
        mainWindow?.loadURL('http://localhost:8000');
      }
    }
    if ((input.control && (input.key === ' ' || input.code === 'Space')) || 
        (input.alt && (input.key === ' ' || input.code === 'Space')) || 
        (input.control && input.key.toLowerCase() === 'm')) {
      mainWindow?.webContents.send('quick-task-trigger');
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('console-message', (_, level, message) => {
    console.log(`[Renderer] ${message}`);
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const info = await mainWindow?.webContents.executeJavaScript(`({
        title: document.title,
        url: window.location.href,
        rootChildren: document.getElementById('root')?.children.length || 0,
        bodyTextLength: document.body.innerText.length
      })`);
      console.log(`[Electron] Window content verified:`, JSON.stringify(info));
    } catch (err: any) {
      console.warn(`[Electron] Error querying DOM:`, err.message);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Renderer Load Error] ${errorDescription} (${errorCode}) for ${validatedURL}`);
    // Progressive fallback: Vite -> Backend (8000) -> Local File
    if (validatedURL.includes('5173')) {
      console.log('[Electron] Vite unavailable, redirecting to local backend server (http://localhost:8000)');
      mainWindow?.loadURL('http://localhost:8000');
    } else if (fs.existsSync(prodIndex) && !validatedURL.includes('index.html')) {
      console.log(`[Electron] Backend page failed, loading static build: ${prodIndex}`);
      mainWindow?.loadFile(prodIndex);
    }
  });

  // Ensure backend server is healthy before loading interface
  await pollHealth('http://localhost:8000/api/health', 15, 300);

  const isViteActive = await checkViteActive(2, 200);
  if (isViteActive) {
    console.log('[Electron] Loading active Vite dev server: http://localhost:5173');
    try {
      await mainWindow.loadURL('http://localhost:5173');
    } catch {
      await mainWindow.loadURL('http://localhost:8000');
    }
  } else {
    console.log('[Electron] Loading backend application shell: http://localhost:8000');
    try {
      await mainWindow.loadURL('http://localhost:8000');
    } catch {
      if (fs.existsSync(prodIndex)) {
        await mainWindow.loadFile(prodIndex);
      }
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

/**
 * Register IPC listeners for window controls exposed via preload.ts
 */
function registerIpcHandlers(): void {
  ipcMain.on('window-control', (_, action: 'minimize' | 'maximize' | 'close') => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'close':
        // Hide to system tray for 24/7 background readiness
        mainWindow.hide();
        break;
    }
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
  });
}

/**
 * 4. Gracefully terminate backend process upon quit.
 */
function killBackendProcess(): void {
  if (backendProcess) {
    console.log('[Electron] Terminating backend server process...');
    try {
      const pid = backendProcess.pid;
      backendProcess.kill('SIGTERM');
      if (pid && process.platform === 'win32') {
        const { exec } = require('child_process');
        exec(`taskkill /PID ${pid} /T /F`, () => {});
      }
    } catch (err) {
      console.error('[Electron] Error terminating backend process:', err);
    }
    backendProcess = null;
  }
}

/**
 * Automatically configures Windows to start OpenDesk AI on boot & laptop reopen.
 * Registers in Windows Startup folder and HKCU Run Registry key for 100% reliability.
 */
function setupWindowsAutoStart(): void {
  if (process.platform !== 'win32') return;

  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  } catch (err) {
    console.warn('[AutoLaunch] Could not configure login item:', err);
  }

  try {
    const appData = process.env.APPDATA;
    if (!appData) return;

    const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    if (!fs.existsSync(startupDir)) return;

    const rootDir = path.resolve(__dirname, '..');
    const startupVbsTarget = path.join(startupDir, 'OpenDeskAI.vbs');

    // Create persistent silent background launch script inside Windows Startup folder
    const vbsContent = `' OpenDesk AI Windows Boot Autostart
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${rootDir.replace(/\\/g, '\\\\')}"
WshShell.Run "cmd.exe /c npm run dev", 0, False
`;

    fs.writeFileSync(startupVbsTarget, vbsContent, 'utf-8');
    console.log('[AutoLaunch] Registered Windows Startup script:', startupVbsTarget);

    // Also register Windows Registry Run key for double reliability
    const escapedVbs = startupVbsTarget.replace(/"/g, '\\"');
    exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "OpenDeskAI" /t REG_SZ /d "wscript.exe \\"${escapedVbs}\\"" /f`, (err) => {
      if (err) {
        console.warn('[AutoLaunch] Registry registration note:', err.message);
      } else {
        console.log('[AutoLaunch] Registered Windows Registry Run key: HKCU\\...\\Run\\OpenDeskAI');
      }
    });
  } catch (startupErr: any) {
    console.warn('[AutoLaunch] Startup configuration error:', startupErr.message);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  // Explicitly allow media permissions (microphone) for speech recognition in desktop mode
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });

  // Configure Windows auto-start on boot & reopen
  setupWindowsAutoStart();

  // Handle laptop sleep / reopen lid / resume lifecycle
  powerMonitor.on('resume', async () => {
    console.log('[PowerMonitor] Laptop resumed/woke up from sleep.');
    const isAlive = await checkBackendAlive();
    if (!isAlive) {
      console.log('[PowerMonitor] Backend server offline after wake, restarting...');
      startBackendServer();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      refreshShortcuts(mainWindow);
      mainWindow.webContents.send('system-resumed');
    }
  });

  powerMonitor.on('unlock-screen', async () => {
    console.log('[PowerMonitor] Windows screen unlocked.');
    const isAlive = await checkBackendAlive();
    if (!isAlive) {
      startBackendServer();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      refreshShortcuts(mainWindow);
    }
  });

  registerIpcHandlers();
  startBackendServer();
  await createMainWindow();

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  destroyTray();
  killBackendProcess();
});

// Keep running in system tray 24/7 when window is closed
app.on('window-all-closed', () => {
  // Intentionally blank to prevent quitting on window close
});
