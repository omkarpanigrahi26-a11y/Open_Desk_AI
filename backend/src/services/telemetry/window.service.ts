import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ActiveWindowContext {
  title: string;
  app: string;
  pid: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class WindowService {
  private getWindowsModule: any = null;
  private isModuleLoadAttempted = false;

  /**
   * Lazily loads get-windows ESM module in a CommonJS runtime.
   */
  private async loadGetWindows() {
    if (this.isModuleLoadAttempted) {
      return this.getWindowsModule;
    }
    this.isModuleLoadAttempted = true;

    try {
      // Dynamic import to support ESM package in CommonJS runtime
      const mod = await (Function('return import("get-windows")')() as Promise<any>);
      this.getWindowsModule = mod;
      return mod;
    } catch (err: any) {
      console.warn('[WindowService] get-windows package could not be dynamically loaded, falling back to native shell query:', err.message);
      return null;
    }
  }

  /**
   * Cross-platform detection of the focused window, active application name, and PID.
   */
  public async getActiveWindow(): Promise<ActiveWindowContext | null> {
    // 1. Try get-windows library
    try {
      const mod = await this.loadGetWindows();
      if (mod) {
        const activeWinFn = mod.activeWindow || mod.default?.activeWindow || mod.default;
        if (typeof activeWinFn === 'function') {
          const window = await activeWinFn();
          if (window) {
            return {
              title: window.title || '',
              app: window.owner?.name || window.app || '',
              pid: window.owner?.processId || window.pid || 0,
              bounds: window.bounds,
            };
          }
        }
      }
    } catch {
      // Fallback below
    }

    // 2. Windows OS native PowerShell fallback
    if (process.platform === 'win32') {
      try {
        const psCommand = `powershell -NoProfile -Command "Add-Type '@\nusing System;\nusing System.Runtime.InteropServices;\npublic class Win {\n  [DllImport(\\"user32.dll\\")] public static extern IntPtr GetForegroundWindow();\n  [DllImport(\\"user32.dll\\")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int processId);\n}\n@'; $h=[Win]::GetForegroundWindow(); $pid=0; [Win]::GetWindowThreadProcessId($h,[ref]$pid); $p=Get-Process -Id $pid -ErrorAction SilentlyContinue; if($p){ [PSCustomObject]@{ Title=$p.MainWindowTitle; ProcessName=$p.ProcessName; Id=$p.Id } | ConvertTo-Json }"`;
        const { stdout } = await execAsync(psCommand, { timeout: 1500 });
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          return {
            title: parsed.Title || 'Active Desktop',
            app: parsed.ProcessName || 'Unknown',
            pid: parsed.Id || 0,
          };
        }
      } catch {
        // Suppress failure and return null
      }
    }

    return null;
  }
}

export const windowService = new WindowService();
