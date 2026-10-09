import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { hardwareService } from '../telemetry/hardware.service';
import { fileIndexService } from '../fileIndex.service';

const execAsync = promisify(exec);

export interface Tier1ExecutionResult {
  tier: 'Tier 1';
  action: string;
  success: boolean;
  output: string;
  latencyMs: number;
  tokensConsumed: number;
}

export class Tier1LightService {
  /**
   * Executes deterministic OS instructions with 0 API token consumption.
   */
  public async execute(query: string): Promise<Tier1ExecutionResult> {
    const startTime = performance.now();
    const normalized = query.trim();

    // 1. Process termination (kill PID)
    const killMatch = normalized.match(/(?:kill|terminate|stop)\s+(?:process\s+|pid\s+)?(\d+)/i);
    if (killMatch) {
      const pid = parseInt(killMatch[1], 10);
      const killed = await hardwareService.killProcess(pid);
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        tier: 'Tier 1',
        action: 'KILL_PROCESS',
        success: killed,
        output: killed
          ? `Successfully terminated process with PID ${pid}.`
          : `Failed to terminate process with PID ${pid}. Process may not exist or require elevated privileges.`,
        latencyMs,
        tokensConsumed: 0,
      };
    }

    // 2. Hardware / System telemetry check
    if (/\b(?:check|show|get|view|display)?\s*\b(?:cpu|ram|memory|hardware)\b(?:\s+(?:stats|load|usage|metrics))?|\bsystem\s+(?:stats|load|usage|metrics|telemetry|info)\b/i.test(normalized)) {
      const [cpu, memory] = await Promise.all([
        hardwareService.getCpuMetrics(),
        hardwareService.getMemoryMetrics(),
      ]);
      const latencyMs = Math.round(performance.now() - startTime);

      const output = [
        `System Telemetry Snapshot:`,
        `- CPU Load: ${cpu.loadPercentage}% (Clock: ${cpu.clockSpeedGhz} GHz across ${cpu.activeCores} cores)`,
        `- RAM Allocation: ${memory.usedGb} GB / ${memory.totalGb} GB (${memory.allocationPercentage}%)`,
      ].join('\n');

      return {
        tier: 'Tier 1',
        action: 'SYSTEM_STATS',
        success: true,
        output,
        latencyMs,
        tokensConsumed: 0,
      };
    }

    // 3. Open directory / folder
    const openDirMatch = normalized.match(/(?:open|explore|show)\s+(?:directory|folder|dir)\s*(.*)/i);
    if (openDirMatch && openDirMatch[1].trim()) {
      const targetDir = openDirMatch[1].trim().replace(/^["']|["']$/g, '');
      const latencyMs = Math.round(performance.now() - startTime);

      try {
        if (process.platform === 'win32') {
          await execAsync(`explorer "${path.resolve(targetDir)}"`);
        } else if (process.platform === 'darwin') {
          await execAsync(`open "${path.resolve(targetDir)}"`);
        } else {
          await execAsync(`xdg-open "${path.resolve(targetDir)}"`);
        }

        return {
          tier: 'Tier 1',
          action: 'OPEN_DIRECTORY',
          success: true,
          output: `Opened directory "${targetDir}" in file explorer.`,
          latencyMs,
          tokensConsumed: 0,
        };
      } catch (err: any) {
        return {
          tier: 'Tier 1',
          action: 'OPEN_DIRECTORY',
          success: false,
          output: `Unable to open directory "${targetDir}": ${err.message}`,
          latencyMs,
          tokensConsumed: 0,
        };
      }
    }

    // 3b. Create directory / folder
    let makeDirRaw: string | null = null;
    const m1 = normalized.match(/(?:make|create|new|mkdir)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory|dir)\s*(?:named|called)?\s*(.*)/i);
    if (m1) {
      makeDirRaw = (m1[1] || '').trim();
    } else {
      const m2 = normalized.match(/(?:make|create|new)\s+(?:a\s+)?["']?([^"'\n\r]+?)["']?\s+(?:folder|directory|dir)/i);
      if (m2) {
        makeDirRaw = m2[1].trim();
      } else {
        const m3 = normalized.match(/^mkdir\s+["']?([^"'\n\r]+)["']?/i);
        if (m3) {
          makeDirRaw = m3[1].trim();
        }
      }
    }

    if (makeDirRaw !== null) {
      const cleanName = makeDirRaw
        .replace(/^(?:on|in)\s+desktop\s*/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .trim() || 'New Folder';
      const { pcToolsService } = await import('../agent/pcTools.service');
      const res = await pcToolsService.createDirectory(cleanName);
      return {
        tier: 'Tier 1',
        action: 'CREATE_DIRECTORY',
        success: res.success,
        output: res.output,
        latencyMs: Math.round(performance.now() - startTime),
        tokensConsumed: 0,
      };
    }

    // 4. Launch applications
    const launchAppMatch = normalized.match(
      /(?:search\s+and\s+|find\s+and\s+)?(?:launch|start|open|run)\s+(?:app|application\s+)?([a-zA-Z0-9_\-\.\s]+)/i
    );
    if (launchAppMatch && !normalized.toLowerCase().includes('directory') && !normalized.toLowerCase().includes('folder')) {
      const rawApp = launchAppMatch[1].trim();
      const latencyMs = Math.round(performance.now() - startTime);

      try {
        if (process.platform === 'win32') {
          const lowerApp = rawApp.toLowerCase();
          const normApp = lowerApp.replace(/[^a-z0-9]/g, '');
          if (normApp.includes('workbench') || normApp.includes('mysql')) {
            await execAsync(`powershell -NoProfile -Command "Start-Process 'C:\\Program Files\\MySQL\\MySQL Workbench 8.0\\MySQLWorkbench.exe'"`);
            return {
              tier: 'Tier 1',
              action: 'LAUNCH_APP',
              success: true,
              output: `Launched MySQL Workbench successfully.`,
              latencyMs,
              tokensConsumed: 0,
            };
          } else if (normApp === 'vscode' || normApp === 'code') {
            await execAsync(`code`);
          } else if (normApp === 'chrome' || normApp === 'googlechrome') {
            await execAsync(`start chrome`);
          } else if (normApp === 'notepad') {
            await execAsync(`notepad`);
          } else if (normApp === 'calc' || normApp === 'calculator') {
            await execAsync(`calc`);
          } else {
            const { pcToolsService } = await import('../agent/pcTools.service');
            const res = await pcToolsService.launchApplication(rawApp);
            return {
              tier: 'Tier 1',
              action: 'LAUNCH_APP',
              success: res.success,
              output: res.output,
              latencyMs,
              tokensConsumed: 0,
            };
          }
        } else if (process.platform === 'darwin') {
          await execAsync(`open -a "${rawApp}"`);
        } else {
          await execAsync(`${rawApp} &`);
        }

        return {
          tier: 'Tier 1',
          action: 'LAUNCH_APP',
          success: true,
          output: `Launched application "${rawApp}".`,
          latencyMs,
          tokensConsumed: 0,
        };
      } catch (err: any) {
        return {
          tier: 'Tier 1',
          action: 'LAUNCH_APP',
          success: false,
          output: `Failed to launch "${rawApp}": ${err.message}`,
          latencyMs,
          tokensConsumed: 0,
        };
      }
    }

    // 5. Locate / find files
    const fileSearchMatch = normalized.match(/(?:find|search|locate)\s+file\s*(.*)/i);
    if (fileSearchMatch && fileSearchMatch[1].trim()) {
      const searchTerm = fileSearchMatch[1].trim();
      const files = await fileIndexService.searchFiles(searchTerm, 5);
      const latencyMs = Math.round(performance.now() - startTime);

      let output = `File Search for "${searchTerm}":\n`;
      if (files.length === 0) {
        output += `No matching indexed files found in MySQL database.`;
      } else {
        output += files.map((f, i) => `${i + 1}. ${f.fileName} (${f.filePath})`).join('\n');
      }

      return {
        tier: 'Tier 1',
        action: 'FIND_FILE',
        success: true,
        output,
        latencyMs,
        tokensConsumed: 0,
      };
    }

    // Default Tier 1 fallback
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      tier: 'Tier 1',
      action: 'GENERAL_OS_EXEC',
      success: true,
      output: `Executed deterministic rule for: "${normalized}"`,
      latencyMs,
      tokensConsumed: 0,
    };
  }
}

export const tier1LightService = new Tier1LightService();
