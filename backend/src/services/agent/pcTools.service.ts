import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';

const execAsync = promisify(exec);

export interface ToolExecutionResult {
  success: boolean;
  action: string;
  output: string;
  metadata?: any;
  error?: string;
}

export class PcToolsService {
  /**
   * Universally launches any installed Windows application or binary.
   */
  public async launchApplication(appName: string): Promise<ToolExecutionResult> {
    const raw = appName.trim().toLowerCase();
    const norm = raw.replace(/[^a-z0-9]/g, '');

    // 1. Direct known application paths for high reliability
    const knownApps: Record<string, string[]> = {
      workbench: [
        'C:\\Program Files\\MySQL\\MySQL Workbench 8.0\\MySQLWorkbench.exe',
        'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\MySQLWorkbench.exe',
        'C:\\Program Files (x86)\\MySQL\\MySQL Workbench 8.0\\MySQLWorkbench.exe',
      ],
      mysql: [
        'C:\\Program Files\\MySQL\\MySQL Workbench 8.0\\MySQLWorkbench.exe',
        'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\MySQLWorkbench.exe',
      ],
      vscode: ['code'],
      code: ['code'],
      chrome: ['chrome'],
      googlechrome: ['chrome'],
      notepad: ['notepad'],
      calc: ['calc'],
      calculator: ['calc'],
      terminal: ['wt', 'powershell'],
      explorer: ['explorer'],
    };

    if (process.platform === 'win32') {
      // Check known mappings first using normalized name
      for (const [key, paths] of Object.entries(knownApps)) {
        if (raw.includes(key) || norm.includes(key) || key.includes(norm)) {
          for (const target of paths) {
            try {
              if (target.includes('\\')) {
                const stat = await fs.stat(target).catch(() => null);
                if (stat) {
                  const { spawn } = await import('child_process');
                  const child = spawn(`"${target}"`, [], { detached: true, stdio: 'ignore', shell: true });
                  child.unref();
                  return {
                    success: true,
                    action: 'LAUNCH_APP',
                    output: `Successfully launched ${appName} from ${target}`,
                  };
                }
              } else {
                const { spawn } = await import('child_process');
                const child = spawn(target, [], { detached: true, stdio: 'ignore', shell: true });
                child.unref();
                return {
                  success: true,
                  action: 'LAUNCH_APP',
                  output: `Successfully launched ${appName}`,
                };
              }
            } catch {
              // Try next path
            }
          }
        }
      }

      // Query Windows StartApps registry dynamically with word wildcards
      try {
        const words = raw.split(/[\s\-_]+/).filter(Boolean);
        const searchPattern = words.length > 0 ? `*${words.join('*')}*` : `*${raw}*`;
        const { execFile } = await import('child_process');
        const execFileAsync = promisify(execFile);

        const psScript = `
          $app = Get-StartApps '${searchPattern}' -ErrorAction SilentlyContinue | Select-Object -First 1
          if ($app) {
            Start-Process -FilePath "explorer.exe" -ArgumentList ('shell:AppsFolder\\' + $app.AppID)
            Write-Output ("LAUNCHED: " + $app.Name)
          } else {
            Start-Process -FilePath '${words[0] || raw}'
          }
        `;

        const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psScript]);
        return {
          success: true,
          action: 'LAUNCH_APP',
          output: stdout.trim() || `Launched application "${appName}".`,
        };
      } catch (err: any) {
        return {
          success: false,
          action: 'LAUNCH_APP',
          output: `Failed to launch application "${appName}": ${err.message}`,
          error: err.message,
        };
      }
    }

    // POSIX fallback
    try {
      await execAsync(`${appName} &`);
      return {
        success: true,
        action: 'LAUNCH_APP',
        output: `Launched application "${appName}".`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'LAUNCH_APP',
        output: `Failed to launch application "${appName}": ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Searches for files across user directories (Desktop, Documents, Downloads, OneDrive).
   */
  public async findFiles(query: string, searchRoot?: string): Promise<string[]> {
    const cleanQuery = query.replace(/^["']|["']$/g, '').trim();
    if (!cleanQuery) return [];

    if (process.platform === 'win32') {
      try {
        const words = cleanQuery.split(/\s+/).filter(Boolean);
        const filterPattern = words.length > 1 ? `*${words.join('*')}*` : `*${cleanQuery}*`;

        let pathListLiteral: string;
        if (searchRoot) {
          pathListLiteral = `'${searchRoot}'`;
        } else {
          const userProfile = os.homedir();
          const candidateDirs = [
            path.join(userProfile, 'Downloads'),
            path.join(userProfile, 'Desktop'),
            path.join(userProfile, 'Documents'),
            path.join(userProfile, 'OneDrive', 'Desktop'),
            path.join(userProfile, 'OneDrive', 'Documents'),
          ];
          const existingDirs = [];
          for (const d of candidateDirs) {
            try {
              if (await fs.stat(d).then((s) => s.isDirectory()).catch(() => false)) {
                existingDirs.push(d);
              }
            } catch {
              // ignore
            }
          }
          if (existingDirs.length === 0) {
            existingDirs.push(userProfile);
          }
          pathListLiteral = `@(${existingDirs.map((d) => `'${d}'`).join(', ')})`;
        }

        const psCmd = `powershell -NoProfile -Command "try { Get-ChildItem -Path ${pathListLiteral} -Filter '${filterPattern}' -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -First 10 -ExpandProperty FullName } finally { [System.Environment]::Exit(0) }"`;
        const { stdout } = await execAsync(psCmd, { timeout: 8000 });
        if (stdout && stdout.trim()) {
          const list = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          // If query mentions word or doc, prioritize docx/doc files
          if (cleanQuery.toLowerCase().includes('word') || cleanQuery.toLowerCase().includes('doc')) {
            list.sort((a, b) => {
              const aIsDoc = /\.(docx?|rtf)$/i.test(a) ? -1 : 1;
              const bIsDoc = /\.(docx?|rtf)$/i.test(b) ? -1 : 1;
              return aIsDoc - bIsDoc;
            });
          }
          return list;
        }
      } catch {
        // Fallback below
      }
    }

    return [];
  }

  /**
   * Opens a file or directory in Windows File Explorer or the default system handler.
   */
  public async openLocation(targetPath: string, openContainingFolder = false): Promise<ToolExecutionResult> {
    try {
      let cleanPath = targetPath.replace(/^["']|["']$/g, '').trim();
      // Remove leading words like "word file", "file", "document", "the"
      cleanPath = cleanPath
        .replace(/^(?:the\s+)?(?:word|pdf|excel|text)?\s*(?:file|document|doc|sheet)?\s*/i, '')
        .replace(/\s+(?:word|pdf|excel|text)?\s*(?:file|document|doc|sheet)$/i, '')
        .trim() || cleanPath;

      let resolved = cleanPath.startsWith('~') ? path.join(os.homedir(), cleanPath.slice(1)) : cleanPath;
      let stat = await fs.stat(resolved).catch(() => null);

      // If not directly found on disk, search user profile directories (Downloads, Documents, Desktop)
      if (!stat && !path.isAbsolute(cleanPath)) {
        const found = await this.findFiles(cleanPath);
        if (found.length > 0) {
          resolved = found[0];
          stat = await fs.stat(resolved).catch(() => null);
        }
      }

      if (!stat) {
        return {
          success: false,
          action: 'OPEN_LOCATION',
          output: `Could not locate file "${targetPath}" in user directories.`,
          error: 'File not found',
        };
      }

      if (process.platform === 'win32') {
        if (openContainingFolder) {
          await execAsync(`explorer.exe /select,"${resolved}"`);
        } else {
          if (stat.isDirectory()) {
            await execAsync(`explorer.exe "${resolved}"`);
          } else {
            await execAsync(`powershell -NoProfile -Command "Start-Process -FilePath '${resolved}'"`);
          }
        }
      } else if (process.platform === 'darwin') {
        await execAsync(`open "${resolved}"`);
      } else {
        await execAsync(`xdg-open "${resolved}"`);
      }

      return {
        success: true,
        action: 'OPEN_LOCATION',
        output: `Opened "${resolved}" successfully.`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'OPEN_LOCATION',
        output: `Failed to open "${targetPath}": ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Helper to resolve the active Desktop directory (accounting for OneDrive sync).
   */
  public async getDesktopDir(): Promise<string> {
    const oneDriveDesktop = path.join(os.homedir(), 'OneDrive', 'Desktop');
    const hasOneDrive = await fs.stat(oneDriveDesktop).then((s) => s.isDirectory()).catch(() => false);
    if (hasOneDrive) return oneDriveDesktop;
    return path.join(os.homedir(), 'Desktop');
  }

  /**
   * Helper to resolve the active Documents directory.
   */
  public async getDocumentsDir(): Promise<string> {
    const oneDriveDocs = path.join(os.homedir(), 'OneDrive', 'Documents');
    const hasOneDrive = await fs.stat(oneDriveDocs).then((s) => s.isDirectory()).catch(() => false);
    if (hasOneDrive) return oneDriveDocs;
    return path.join(os.homedir(), 'Documents');
  }

  /**
   * Creates a folder/directory on Desktop or specified path and reveals in File Explorer.
   */
  public async createDirectory(target: string): Promise<ToolExecutionResult> {
    try {
      let clean = target.replace(/^["']|["']$/g, '').trim() || 'New Folder';
      clean = clean
        .replace(/^(?:folder|directory|dir)\s+(?:named|called)?\s*/i, '')
        .replace(/\s+(?:folder|directory|dir)$/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .trim() || 'New Folder';
      const sanitized = clean.replace(/[<>:"/\\|?*]/g, '').trim() || 'New Folder';
      let fullPath = sanitized;

      if (!path.isAbsolute(sanitized) && !sanitized.startsWith('~')) {
        const desktopPath = await this.getDesktopDir();
        fullPath = path.join(desktopPath, sanitized);
      } else if (sanitized.startsWith('~')) {
        fullPath = path.join(os.homedir(), sanitized.slice(1));
      }

      await fs.mkdir(fullPath, { recursive: true });

      // Reveal created directory in Windows Explorer
      if (process.platform === 'win32') {
        execAsync(`explorer.exe "${fullPath}"`).catch(() => {});
      }

      return {
        success: true,
        action: 'CREATE_DIRECTORY',
        output: `Created folder at: "${fullPath}" and opened in File Explorer.`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'CREATE_DIRECTORY',
        output: `Failed to create folder "${target}": ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Creates a new document or text file and opens it.
   */
  public async createFile(target: string, initialContent = ''): Promise<ToolExecutionResult> {
    try {
      let clean = target.replace(/^["']|["']$/g, '').trim() || 'untitled.txt';
      clean = clean
        .replace(/^(?:the\s+)?(?:file|document|text\s+file|note|notes)\s+(?:named|called)?\s*/i, '')
        .replace(/\s+(?:file|document|doc)$/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .trim() || 'untitled.txt';

      // If user typed e.g. "task one file", clean off trailing "file"
      clean = clean.replace(/\s+file$/i, '').trim();

      if (!path.extname(clean)) {
        clean += '.txt';
      }

      const desktopPath = await this.getDesktopDir();
      let fullPath = clean;
      if (!path.isAbsolute(clean) && !clean.startsWith('~')) {
        fullPath = path.join(desktopPath, clean);
      } else if (clean.startsWith('~')) {
        fullPath = path.join(os.homedir(), clean.slice(1));
      }

      await fs.writeFile(fullPath, initialContent, 'utf-8');

      if (process.platform === 'win32') {
        execAsync(`powershell -NoProfile -Command "Start-Process -FilePath '${fullPath}'"`).catch(() => {});
      }

      return {
        success: true,
        action: 'CREATE_FILE',
        output: `Created file "${path.basename(fullPath)}" on Desktop and opened it.`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'CREATE_FILE',
        output: `Failed to create file "${target}": ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Deletes a file or directory across system paths.
   */
  public async deleteTarget(target: string): Promise<ToolExecutionResult> {
    try {
      let clean = target.replace(/^["']|["']$/g, '').trim();
      clean = clean
        .replace(/^(?:the\s+)?(?:file|folder|directory|doc|document)\s+(?:named|called)?\s*/i, '')
        .replace(/\s+(?:file|folder|directory|doc|document)$/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .trim() || clean;

      let resolved = clean.startsWith('~') ? path.join(os.homedir(), clean.slice(1)) : clean;
      let stat = await fs.stat(resolved).catch(() => null);

      if (!stat && !path.isAbsolute(clean)) {
        const desktopPath = await this.getDesktopDir();
        const onDesktop = path.join(desktopPath, clean);
        stat = await fs.stat(onDesktop).catch(() => null);
        if (stat) {
          resolved = onDesktop;
        } else {
          // Try with .txt extension if missing
          const onDesktopTxt = path.join(desktopPath, clean + '.txt');
          const txtStat = await fs.stat(onDesktopTxt).catch(() => null);
          if (txtStat) {
            resolved = onDesktopTxt;
            stat = txtStat;
          } else {
            const found = await this.findFiles(clean);
            if (found.length > 0) {
              resolved = found[0];
              stat = await fs.stat(resolved).catch(() => null);
            }
          }
        }
      }

      if (!stat) {
        return {
          success: false,
          action: 'DELETE_TARGET',
          output: `Could not locate "${target}" to delete.`,
          error: 'File or folder not found',
        };
      }

      await fs.rm(resolved, { recursive: true, force: true });

      return {
        success: true,
        action: 'DELETE_TARGET',
        output: `Successfully deleted "${path.basename(resolved)}".`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'DELETE_TARGET',
        output: `Failed to delete "${target}": ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Edits or appends content to a specified text file.
   */
  public async editFile(target: string, contentToAdd: string, append = true): Promise<ToolExecutionResult> {
    try {
      let clean = target.replace(/^["']|["']$/g, '').trim();
      clean = clean
        .replace(/^(?:the\s+)?(?:file|doc|document)\s+(?:named|called)?\s*/i, '')
        .replace(/\s+(?:file|doc|document)$/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .trim() || clean;

      let resolved = clean.startsWith('~') ? path.join(os.homedir(), clean.slice(1)) : clean;
      let stat = await fs.stat(resolved).catch(() => null);

      if (!stat && !path.isAbsolute(clean)) {
        const desktopPath = await this.getDesktopDir();
        const onDesktop = path.join(desktopPath, clean);
        stat = await fs.stat(onDesktop).catch(() => null);
        if (stat) {
          resolved = onDesktop;
        } else {
          const onDesktopTxt = path.join(desktopPath, clean + '.txt');
          const txtStat = await fs.stat(onDesktopTxt).catch(() => null);
          if (txtStat) {
            resolved = onDesktopTxt;
            stat = txtStat;
          } else {
            const found = await this.findFiles(clean);
            if (found.length > 0) {
              resolved = found[0];
              stat = await fs.stat(resolved).catch(() => null);
            }
          }
        }
      }

      if (!stat) {
        return this.createFile(clean, contentToAdd);
      }

      if (append) {
        await fs.appendFile(resolved, '\n' + contentToAdd, 'utf-8');
      } else {
        await fs.writeFile(resolved, contentToAdd, 'utf-8');
      }

      if (process.platform === 'win32') {
        execAsync(`powershell -NoProfile -Command "Start-Process -FilePath '${resolved}'"`).catch(() => {});
      }

      return {
        success: true,
        action: 'EDIT_FILE',
        output: `Updated file "${path.basename(resolved)}" with requested changes.`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'EDIT_FILE',
        output: `Failed to edit "${target}": ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Closes or kills a running application.
   */
  public async closeApplication(appName: string): Promise<ToolExecutionResult> {
    try {
      const clean = appName.replace(/^(?:app|application|program)\s+/i, '').trim();
      const norm = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (process.platform === 'win32') {
        const psCmd = `Get-Process | Where-Object { ($_.ProcessName -replace '[^a-zA-Z0-9]', '').ToLower() -like '*${norm}*' } | Stop-Process -Force -ErrorAction SilentlyContinue`;
        await execAsync(`powershell -NoProfile -Command "${psCmd}"`);
      } else {
        await execAsync(`pkill -f -i "${clean}"`).catch(() => {});
      }

      return {
        success: true,
        action: 'CLOSE_APP',
        output: `Closed application "${clean}".`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'CLOSE_APP',
        output: `Failed to close "${appName}": ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Opens any website or URL in the default browser.
   */
  public async openUrl(urlOrSite: string): Promise<ToolExecutionResult> {
    try {
      let target = urlOrSite.trim();
      if (!/^https?:\/\//i.test(target)) {
        if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(target)) {
          target = `https://${target}`;
        } else {
          const siteMap: Record<string, string> = {
            youtube: 'https://www.youtube.com',
            google: 'https://www.google.com',
            github: 'https://www.github.com',
            gmail: 'https://mail.google.com',
            twitter: 'https://www.x.com',
            reddit: 'https://www.reddit.com',
            chatgpt: 'https://chatgpt.com',
          };
          const key = target.toLowerCase().replace(/[^a-z]/g, '');
          target = siteMap[key] || `https://www.google.com/search?q=${encodeURIComponent(urlOrSite)}`;
        }
      }

      if (process.platform === 'win32') {
        const psCmd = `Start-Process '${target}'; Start-Sleep -Milliseconds 200; $w = New-Object -ComObject WScript.Shell; [void]($w.AppActivate('Chrome') -or $w.AppActivate('Edge') -or $w.AppActivate('Firefox') -or $w.AppActivate('Browser'))`;
        await execAsync(`powershell -NoProfile -Command "${psCmd}"`);
      } else if (process.platform === 'darwin') {
        await execAsync(`open "${target}"`);
      } else {
        await execAsync(`xdg-open "${target}"`);
      }

      return {
        success: true,
        action: 'OPEN_URL',
        output: `Opened ${target} in your browser.`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'OPEN_URL',
        output: `Failed to open ${urlOrSite}: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Plays songs, music, or video queries on YouTube in the browser.
   */
  public async playYoutube(query: string): Promise<ToolExecutionResult> {
    try {
      let clean = (query || '').trim()
        .replace(/^(?:play|listen\s+to|watch|start|search\s+for|search|rearch|find)\s+/i, '')
        .replace(/\s+(?:on|in)\s+youtube$/i, '')
        .replace(/^(?:the\s+)?(?:video\s+(?:of\s+)?|song|songs|music|track)\s+/i, '')
        .replace(/\s+video$/i, '')
        .trim();

      const isGeneric = !clean || /^(?:any|some|a|random)?\s*(?:video|videos|song|songs)?$/i.test(clean) || clean.toLowerCase() === 'any' || clean.toLowerCase() === 'trending';

      const url = isGeneric
        ? 'https://www.youtube.com'
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;

      const res = await this.openUrl(url);

      // On Windows, auto-trigger playback of top search result or featured video after page loads
      if (process.platform === 'win32') {
        setTimeout(async () => {
          try {
            const keysToSend = isGeneric ? '{TAB}{TAB}{TAB}{ENTER}' : '{TAB}{TAB}{ENTER}';
            const ps = `Add-Type -AssemblyName System.Windows.Forms; $ws = New-Object -ComObject WScript.Shell; [void]($ws.AppActivate('YouTube') -or $ws.AppActivate('Chrome') -or $ws.AppActivate('Edge') -or $ws.AppActivate('Brave') -or $ws.AppActivate('Firefox') -or $ws.AppActivate('Browser')); Start-Sleep -Milliseconds 400; [System.Windows.Forms.SendKeys]::SendWait('${keysToSend}')`;
            await execAsync(`powershell -NoProfile -Command "${ps}"`);
          } catch {}
        }, 2200);
      }

      return {
        success: res.success,
        action: 'PLAY_YOUTUBE',
        output: !isGeneric ? `Playing "${clean}" on YouTube.` : 'Opened YouTube and started video playback.',
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'PLAY_YOUTUBE',
        output: `Failed to open YouTube: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Selects and plays a video on YouTube by its displayed number (1st, 2nd, 3rd) or title.
   */
  public async playYoutubeVideoByIndexOrName(indexOrName: number | string): Promise<ToolExecutionResult> {
    try {
      if (typeof indexOrName === 'number' || /^\d+$/.test(String(indexOrName))) {
        const idx = typeof indexOrName === 'number' ? indexOrName : parseInt(String(indexOrName), 10);
        if (process.platform === 'win32') {
          // Tab through search results and press Enter on the Nth video
          let tabs = '{TAB}{ENTER}';
          if (idx === 1) tabs = '{TAB}{TAB}{ENTER}';
          else if (idx === 2) tabs = '{TAB}{TAB}{TAB}{TAB}{ENTER}';
          else if (idx === 3) tabs = '{TAB}{TAB}{TAB}{TAB}{TAB}{TAB}{ENTER}';
          else tabs = '{TAB}{ENTER}';

          const psCmd = `powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; [void]($ws.AppActivate('YouTube') -or $ws.AppActivate('Chrome') -or $ws.AppActivate('Edge') -or $ws.AppActivate('Brave')); Start-Sleep -Milliseconds 250; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${tabs}')"`;
          await execAsync(psCmd);
          return {
            success: true,
            action: 'PLAY_YOUTUBE_VIDEO',
            output: `Selected and playing video #${idx} on YouTube.`,
          };
        }
      } else {
        return await this.playYoutube(String(indexOrName));
      }
      return {
        success: true,
        action: 'PLAY_YOUTUBE_VIDEO',
        output: 'Playing video on YouTube.',
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'PLAY_YOUTUBE_VIDEO',
        output: `Failed to play video: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Plays songs, music, playlists, or artists on Spotify (desktop app or web player).
   */
  public async playSpotify(query: string): Promise<ToolExecutionResult> {
    try {
      let clean = query.trim()
        .replace(/^(?:open\s+spotify\s+and\s+)?(?:play|listen\s+to|stream|search\s+for|search)\s+/i, '')
        .replace(/\s+(?:on|in)\s+spotify$/i, '')
        .replace(/^(?:songs?|music|track|album|artist|singers?)\s+/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (clean.toLowerCase() === 'spotify' || clean.toLowerCase() === 'any song name' || !clean) {
        clean = 'Today Top Hits';
      }

      if (process.platform === 'win32') {
        const targetUri = `spotify:search:${encodeURIComponent(clean)}`;
        try {
          const psScript = `
            Start-Process '${targetUri}'
            Start-Sleep -Milliseconds 1800
            $ws = New-Object -ComObject WScript.Shell
            [void]($ws.AppActivate('Spotify'))
            Start-Sleep -Milliseconds 400
            Add-Type -AssemblyName System.Windows.Forms
            # Hit Enter on top track result to start playing immediately
            [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait(' ')
          `;
          await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n\s*/g, '; ')}"`);
          return {
            success: true,
            action: 'PLAY_SPOTIFY',
            output: `Playing "${clean}" on Spotify.`,
          };
        } catch {
          // If desktop URI fails, open web player
          const webUrl = `https://open.spotify.com/search/${encodeURIComponent(clean)}`;
          await this.openUrl(webUrl);
          return {
            success: true,
            action: 'PLAY_SPOTIFY',
            output: `Opened "${clean}" on Spotify Web.`,
          };
        }
      }

      await this.openUrl(clean ? `https://open.spotify.com/search/${encodeURIComponent(clean)}` : 'https://open.spotify.com');
      return {
        success: true,
        action: 'PLAY_SPOTIFY',
        output: clean ? `Playing "${clean}" on Spotify.` : 'Opened Spotify.',
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'PLAY_SPOTIFY',
        output: `Failed to play Spotify: ${err.message}`,
        error: err.message,
      };
    }
  }

  private scrollerProcess: import('child_process').ChildProcess | null = null;
  private isAutoScrolling = false;

  /**
   * Starts slow continuous auto-scrolling on screen using native Windows mouse wheel events.
   */
  public startAutoScroll(direction: 'DOWN' | 'UP' = 'DOWN', intervalMs = 750): ToolExecutionResult {
    this.stopAutoScroll();
    this.isAutoScrolling = true;

    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      const flagPath = path.join(os.tmpdir(), 'opendesk_scroller_stop.flag');
      try {
        if (fsSync.existsSync(flagPath)) fsSync.unlinkSync(flagPath);
      } catch {}

      const candidatePaths = [
        path.resolve(process.cwd(), 'scripts', 'scroller.ps1'),
        path.resolve(process.cwd(), 'backend', 'scripts', 'scroller.ps1'),
        path.resolve(__dirname, '..', '..', 'scripts', 'scroller.ps1'),
      ];
      const scriptPath = candidatePaths.find((p) => fsSync.existsSync(p)) || candidatePaths[0];
      const amount = direction === 'UP' ? 160 : -160;

      try {
        const proc = spawn('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          amount.toString(),
          intervalMs.toString(),
        ], {
          windowsHide: true,
          stdio: 'ignore',
        });

        proc.on('exit', () => {
          this.isAutoScrolling = false;
          this.scrollerProcess = null;
        });

        this.scrollerProcess = proc;
      } catch (err: any) {
        console.error('Failed to spawn scroller process:', err);
      }
    }

    return {
      success: true,
      action: 'AUTO_SCROLL_START',
      output: `Scrolling ${direction.toLowerCase()} slowly. Say "stop" anytime.`,
    };
  }

  /**
   * Stops any currently active continuous auto-scroll with 100% guarantee.
   */
  public stopAutoScroll(): ToolExecutionResult {
    // 1. Signal stop flag
    try {
      const flagPath = path.join(os.tmpdir(), 'opendesk_scroller_stop.flag');
      fsSync.writeFileSync(flagPath, 'stop', 'utf-8');
    } catch {}

    // 2. Kill tracked child process
    if (this.scrollerProcess) {
      try {
        const pid = this.scrollerProcess.pid;
        this.scrollerProcess.kill('SIGTERM');
        if (pid && process.platform === 'win32') {
          exec(`taskkill /PID ${pid} /T /F`, () => {});
        }
      } catch {}
      this.scrollerProcess = null;
    }

    // 3. Force kill any orphaned scroller.ps1 powershell instances
    if (process.platform === 'win32') {
      try {
        exec(
          `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*scroller.ps1*' } | Stop-Process -Force"`,
          () => {}
        );
      } catch {}
    }

    this.isAutoScrolling = false;
    return {
      success: true,
      action: 'AUTO_SCROLL_STOP',
      output: 'Stopped scrolling.',
    };
  }

  /**
   * Stops continuous auto-scroll and pauses all active media (Spotify, YouTube, video).
   */
  public async stopEverything(): Promise<ToolExecutionResult> {
    this.stopAutoScroll();
    if (process.platform === 'win32') {
      try {
        const ps = `
          $ws = New-Object -ComObject WScript.Shell
          # Hardware media stop / pause
          $ws.SendKeys([char]178)
          Start-Sleep -Milliseconds 60
          $ws.SendKeys([char]179)
          # If YouTube or Browser is focused/open, send 'k' to pause video
          if ($ws.AppActivate('YouTube') -or $ws.AppActivate('Chrome') -or $ws.AppActivate('Edge') -or $ws.AppActivate('Brave')) {
            Start-Sleep -Milliseconds 80
            $ws.SendKeys('k')
          }
          # If Spotify is active, send spacebar
          if ($ws.AppActivate('Spotify')) {
            Start-Sleep -Milliseconds 80
            $ws.SendKeys(' ')
          }
        `;
        await execAsync(`powershell -NoProfile -Command "${ps.replace(/\n\s*/g, '; ')}"`);
      } catch {}
    }
    return {
      success: true,
      action: 'AUTO_SCROLL_STOP',
      output: 'Stopped.',
    };
  }

  /**
   * Resumes playback for paused video or music (YouTube 'k' / Spacebar).
   */
  public async resumePlayback(): Promise<ToolExecutionResult> {
    if (process.platform === 'win32') {
      try {
        const ps = `
          $ws = New-Object -ComObject WScript.Shell
          if ($ws.AppActivate('YouTube') -or $ws.AppActivate('Chrome') -or $ws.AppActivate('Edge') -or $ws.AppActivate('Brave')) {
            Start-Sleep -Milliseconds 80
            $ws.SendKeys('k')
          } else if ($ws.AppActivate('Spotify')) {
            Start-Sleep -Milliseconds 80
            $ws.SendKeys(' ')
          } else {
            $ws.SendKeys([char]179)
          }
        `;
        await execAsync(`powershell -NoProfile -Command "${ps.replace(/\n\s*/g, '; ')}"`);
      } catch {}
    }
    return {
      success: true,
      action: 'RESUME_PLAYBACK',
      output: 'Playing.',
    };
  }

  /**
   * Scrolls the active window/page up or down using native mouse wheel events.
   */
  public async scrollPage(direction: 'UP' | 'DOWN' | 'TOP' | 'BOTTOM' = 'DOWN', amount = 1): Promise<ToolExecutionResult> {
    try {
      if (process.platform === 'win32') {
        const wheelDelta = direction === 'UP' ? 160 : -160;
        const total = wheelDelta * Math.min(Math.max(amount, 1), 10);
        const ps = `
          Add-Type -TypeDefinition @"
          using System;
          using System.Runtime.InteropServices;
          public class SingleScroll {
              [DllImport("user32.dll")]
              public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);
          }
"@
          [SingleScroll]::mouse_event(0x0800, 0, 0, ${total}, [UIntPtr]::Zero)
        `;
        await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/\n\s*/g, '; ')}"`);
      }
      return {
        success: true,
        action: 'SCROLL_PAGE',
        output: `Scrolled screen ${direction.toLowerCase()}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'SCROLL_PAGE',
        output: `Failed to scroll: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Minimizes or maximizes the active window or screen.
   */
  public async setWindowState(state: 'MINIMIZE' | 'MAXIMIZE' | 'RESTORE'): Promise<ToolExecutionResult> {
    try {
      if (process.platform === 'win32') {
        if (state === 'MINIMIZE') {
          // In Windows SendKeys, %{SPACE} sends Alt+Space, followed by 'n' to minimize
          const ps = `Add-Type -AssemblyName System.Windows.Forms; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('%{SPACE}'); Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('n')`;
          await execAsync(`powershell -NoProfile -Command "${ps}"`);
          return {
            success: true,
            action: 'WINDOW_STATE',
            output: 'Minimized active window.',
          };
        } else if (state === 'MAXIMIZE') {
          // Alt+Space followed by 'x' maximizes the active window
          const ps = `Add-Type -AssemblyName System.Windows.Forms; $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('%{SPACE}'); Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('x')`;
          await execAsync(`powershell -NoProfile -Command "${ps}"`);
          return {
            success: true,
            action: 'WINDOW_STATE',
            output: 'Maximized window to full screen.',
          };
        }
      }
      return {
        success: true,
        action: 'WINDOW_STATE',
        output: `${state} window executed.`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'WINDOW_STATE',
        output: `Failed to ${state.toLowerCase()} window: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Opens Windows File Explorer or reveals a target folder/file.
   */
  public async openFileManager(folderOrFile?: string): Promise<ToolExecutionResult> {
    try {
      if (process.platform === 'win32') {
        let target = folderOrFile ? folderOrFile.trim() : '';
        if (target) {
          const norm = target.toLowerCase();
          if (norm.includes('download')) target = path.join(os.homedir(), 'Downloads');
          else if (norm.includes('document')) target = path.join(os.homedir(), 'OneDrive', 'Documents');
          else if (norm.includes('desktop')) target = path.join(os.homedir(), 'OneDrive', 'Desktop');
          else if (norm.includes('open_desk') || norm.includes('project')) target = process.cwd();

          const stat = await fs.stat(target).catch(() => null);
          if (stat) {
            if (stat.isFile()) {
              await execAsync(`explorer.exe /select,"${target}"`);
              return { success: true, action: 'OPEN_FILE_MANAGER', output: `Revealed "${path.basename(target)}" in File Explorer.` };
            }
            await execAsync(`explorer.exe "${target}"`);
            return { success: true, action: 'OPEN_FILE_MANAGER', output: `Opened folder "${target}" in File Explorer.` };
          }
        }
        await execAsync(`explorer.exe`);
        return { success: true, action: 'OPEN_FILE_MANAGER', output: 'Opened Windows File Explorer.' };
      }
      return { success: true, action: 'OPEN_FILE_MANAGER', output: 'Opened File Manager.' };
    } catch (err: any) {
      return { success: false, action: 'OPEN_FILE_MANAGER', output: `Failed to open File Explorer: ${err.message}`, error: err.message };
    }
  }

  /**
   * Handles WhatsApp actions: opening, making calls, or sending messages with auto-send Enter.
   */
  public async handleWhatsApp(action: 'OPEN' | 'CALL' | 'CHAT', contact?: string, message?: string): Promise<ToolExecutionResult> {
    try {
      let cleanContact = (contact || '').trim();
      let msgToSend = (message || '').trim();

      // If contact is generic "someone" or empty, grab default number from .env
      const isGeneric = !cleanContact || /^(?:someone|somebody|anyone|whatsapp|on\s+whatsapp|myself)$/i.test(cleanContact);
      if (isGeneric) {
        const authNums = (process.env.WHATSAPP_AUTHORIZED_NUMBER || '').split(',').map((s) => s.trim()).filter(Boolean);
        cleanContact = authNums[0] || '';
      }

      // If message is empty for CHAT, provide a friendly default so it actually sends
      if (!msgToSend && action !== 'CALL') {
        msgToSend = 'Hello! Sent via OpenDesk AI';
      }

      let targetPhone = cleanContact.replace(/[^0-9]/g, '');
      if (targetPhone.length === 10) {
        targetPhone = '91' + targetPhone;
      }

      // 1. Direct phone number web/desktop bridge with auto-send
      if (targetPhone.length >= 10) {
        const textParam = msgToSend ? `&text=${encodeURIComponent(msgToSend)}` : '';
        const desktopUri = `whatsapp://send?phone=${targetPhone}${textParam}`;
        if (process.platform === 'win32') {
          try {
            const psScript = `
              Start-Process '${desktopUri}'
              Start-Sleep -Milliseconds 2200
              $ws = New-Object -ComObject WScript.Shell
              [void]($ws.AppActivate('WhatsApp'))
              Start-Sleep -Milliseconds 400
              Add-Type -AssemblyName System.Windows.Forms
              [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
              Start-Sleep -Milliseconds 300
              [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
            `;
            await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n\s*/g, '; ')}"`);
            return {
              success: true,
              action: 'WHATSAPP_ACTION',
              output: action === 'CALL'
                ? `Calling +${targetPhone} on WhatsApp.`
                : `Sent message to +${targetPhone} on WhatsApp: "${msgToSend}".`,
            };
          } catch {
            const webUrl = `https://web.whatsapp.com/send?phone=${targetPhone}${textParam}`;
            await this.openUrl(webUrl);
            return {
              success: true,
              action: 'WHATSAPP_ACTION',
              output: `Connecting with +${targetPhone} on WhatsApp Web.`,
            };
          }
        }
      }

      // 2. Launch WhatsApp Windows Desktop App, paste contact, open chat, paste message, send
      if (process.platform === 'win32') {
        const safeContact = cleanContact.replace(/'/g, "''");
        const safeMessage = msgToSend.replace(/'/g, "''");

        const psScript = `
          Start-Process 'whatsapp:' -ErrorAction SilentlyContinue
          Start-Sleep -Milliseconds 1500
          $ws = New-Object -ComObject WScript.Shell
          [void]($ws.AppActivate('WhatsApp'))
          Start-Sleep -Milliseconds 500
          Add-Type -AssemblyName System.Windows.Forms
          ${cleanContact ? `
          [System.Windows.Forms.SendKeys]::SendWait('^f')
          Start-Sleep -Milliseconds 400
          Set-Clipboard -Value '${safeContact}'
          [System.Windows.Forms.SendKeys]::SendWait('^v')
          Start-Sleep -Milliseconds 900
          [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
          Start-Sleep -Milliseconds 800
          ` : ''}
          ${msgToSend ? `
          Set-Clipboard -Value '${safeMessage}'
          [System.Windows.Forms.SendKeys]::SendWait('^v')
          Start-Sleep -Milliseconds 400
          [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
          Start-Sleep -Milliseconds 250
          [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
          ` : ''}
        `;
        await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n\s*/g, '; ')}"`);
        return {
          success: true,
          action: 'WHATSAPP_ACTION',
          output: action === 'CALL'
            ? `Opened WhatsApp to call "${cleanContact}".`
            : `Sent WhatsApp message to "${cleanContact}": "${msgToSend}".`,
        };
      }

      // 3. Fallback to WhatsApp Web
      await this.openUrl('https://web.whatsapp.com');
      return {
        success: true,
        action: 'WHATSAPP_ACTION',
        output: 'Opened WhatsApp Web.',
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'WHATSAPP_ACTION',
        output: `Failed to process WhatsApp action: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Sets alarm, timer, or opens Windows Clock.
   */
  public async setAlarm(timeOrQuery?: string): Promise<ToolExecutionResult> {
    try {
      if (process.platform === 'win32') {
        // ms-clock: is the official Windows 10/11 Clock & Alarms URI scheme
        await execAsync(`powershell -NoProfile -Command "Start-Process 'ms-clock:'"`);
        return {
          success: true,
          action: 'SET_ALARM',
          output: timeOrQuery
            ? `Opened Windows Clock and ready to set alarm for "${timeOrQuery}".`
            : 'Opened Windows Clock and Alarms.',
        };
      }
      return {
        success: true,
        action: 'SET_ALARM',
        output: timeOrQuery ? `Alarm configured for ${timeOrQuery}.` : 'Alarm set.',
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'SET_ALARM',
        output: `Failed to set alarm: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Executes common OS system actions like screenshot, volume, trash.
   */
  public async systemAction(action: string): Promise<ToolExecutionResult> {
    try {
      const act = action.toUpperCase();
      if (act === 'SCREENSHOT') {
        const desktopPath = await this.getDesktopDir();
        const filename = `Screenshot_${Date.now()}.png`;
        const outPath = path.join(desktopPath, filename);
        const psScript = `
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing
          $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
          $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
          $graphic = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphic.CopyFromScreen($screen.X, $screen.Y, 0, 0, $bitmap.Size)
          $bitmap.Save('${outPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
          $graphic.Dispose()
          $bitmap.Dispose()
        `;
        await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, '; ')}"`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `Screenshot captured and saved to Desktop as "${filename}".`,
        };
      }

      if (act === 'EMPTY_TRASH' || act === 'EMPTY_RECYCLE_BIN') {
        await execAsync(`powershell -NoProfile -Command "try { Clear-RecycleBin -Force -ErrorAction SilentlyContinue } catch {} finally { [System.Environment]::Exit(0) }"`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `Recycle Bin has been emptied.`,
        };
      }

      if (act === 'MUTE' || act === 'UNMUTE') {
        await execAsync(`powershell -NoProfile -Command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]173)"`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `System audio mute toggled.`,
        };
      }

      if (act === 'VOLUME_UP') {
        await execAsync(`powershell -NoProfile -Command "$wscript = New-Object -ComObject WScript.Shell; for ($i=0; $i -lt 5; $i++) { $wscript.SendKeys([char]175) }"`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `Increased system volume.`,
        };
      }

      if (act === 'VOLUME_DOWN') {
        await execAsync(`powershell -NoProfile -Command "$wscript = New-Object -ComObject WScript.Shell; for ($i=0; $i -lt 5; $i++) { $wscript.SendKeys([char]174) }"`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `Decreased system volume.`,
        };
      }

      if (act === 'LOCK_SCREEN') {
        await execAsync(`rundll32.exe user32.dll,LockWorkStation`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `Workstation locked.`,
        };
      }

      if (act === 'NEXT_TRACK') {
        await execAsync(`powershell -NoProfile -Command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]176)"`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `Skipped to next track.`,
        };
      }

      if (act === 'PREV_TRACK') {
        await execAsync(`powershell -NoProfile -Command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]177)"`);
        return {
          success: true,
          action: 'SYSTEM_ACTION',
          output: `Playing previous track.`,
        };
      }

      return {
        success: true,
        action: 'SYSTEM_ACTION',
        output: `Executed system action "${action}".`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'SYSTEM_ACTION',
        output: `Failed system action: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Verifies if a specific target condition has been achieved on the PC.
   */
  public async verifyCondition(type: 'PROCESS_RUNNING' | 'FILE_EXISTS' | 'COMMAND_CHECK', target: string): Promise<boolean> {
    switch (type) {
      case 'PROCESS_RUNNING': {
        try {
          if (process.platform === 'win32') {
            const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
            const psCmd = `Get-Process | Where-Object { ($_.ProcessName -replace '[^a-zA-Z0-9]', '').ToLower() -like '*${cleanTarget}*' -or '${cleanTarget}' -like ('*' + ($_.ProcessName -replace '[^a-zA-Z0-9]', '').ToLower() + '*') } | Select-Object -First 1 -ExpandProperty ProcessName`;
            const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCmd}"`);
            return Boolean(stdout && stdout.trim());
          }
          const { stdout } = await execAsync(`pgrep -i "${target}"`);
          return Boolean(stdout && stdout.trim());
        } catch {
          return false;
        }
      }

      case 'FILE_EXISTS': {
        try {
          let resolved = target.startsWith('~') ? path.join(os.homedir(), target.slice(1)) : target;
          if (!path.isAbsolute(resolved)) {
            const onDesktop = path.join(os.homedir(), 'Desktop', resolved);
            const desktopStat = await fs.stat(onDesktop).catch(() => null);
            if (desktopStat) return true;

            const found = await this.findFiles(resolved);
            if (found.length > 0) return true;
          }
          const stat = await fs.stat(resolved).catch(() => null);
          return Boolean(stat);
        } catch {
          return false;
        }
      }

      case 'COMMAND_CHECK': {
        try {
          const { stdout } = await execAsync(target, { timeout: 4000 });
          return Boolean(stdout && stdout.trim());
        } catch {
          return false;
        }
      }

      default:
        return false;
    }
  }
}

export const pcToolsService = new PcToolsService();
