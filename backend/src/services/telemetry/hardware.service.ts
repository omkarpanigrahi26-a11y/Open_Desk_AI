import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CpuMetrics {
  loadPercentage: number;
  clockSpeedGhz: number;
  activeCores: number;
  coresLoad: number[];
}

export interface MemoryMetrics {
  usedGb: number;
  totalGb: number;
  allocationPercentage: number;
}

export interface DiskMetrics {
  readMbPerSec: number;
  writeMbPerSec: number;
}

export interface ProcessMetric {
  pid: number;
  name: string;
  command: string;
  cpuPercentage: number;
  memoryPercentage: number;
}

export interface HardwareSnapshot {
  timestamp: string;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  topProcesses: ProcessMetric[];
}

export class HardwareService {
  /**
   * Samples CPU load %, clock speed in GHz, and active core loads.
   */
  public async getCpuMetrics(): Promise<CpuMetrics> {
    const [loadData, cpuSpeed, cpuData] = await Promise.all([
      si.currentLoad(),
      si.cpuCurrentSpeed(),
      si.cpu(),
    ]);

    const activeCores = loadData.cpus ? loadData.cpus.length : cpuData.cores || 1;
    const clockSpeedGhz = Number((cpuSpeed.avg || cpuData.speed || 0).toFixed(2));
    const loadPercentage = Number(loadData.currentLoad.toFixed(2));
    const coresLoad = (loadData.cpus || []).map((core) => Number(core.load.toFixed(2)));

    return {
      loadPercentage,
      clockSpeedGhz,
      activeCores,
      coresLoad,
    };
  }

  /**
   * Samples RAM used/total in GB and allocation percentage.
   */
  public async getMemoryMetrics(): Promise<MemoryMetrics> {
    const memData = await si.mem();
    const bytesToGb = 1024 * 1024 * 1024;

    const totalGb = Number((memData.total / bytesToGb).toFixed(2));
    const usedGb = Number(((memData.total - memData.available) / bytesToGb).toFixed(2));
    const allocationPercentage = totalGb > 0 ? Number(((usedGb / totalGb) * 100).toFixed(2)) : 0;

    return {
      usedGb,
      totalGb,
      allocationPercentage,
    };
  }

  /**
   * Samples NVMe / Disk read and write throughput in MB/s.
   */
  public async getDiskThroughput(): Promise<DiskMetrics> {
    try {
      const fsStats = await si.fsStats();
      const bytesToMb = 1024 * 1024;

      const readMbPerSec = fsStats.rx_sec != null && fsStats.rx_sec > 0
        ? Number((fsStats.rx_sec / bytesToMb).toFixed(2))
        : 0;

      const writeMbPerSec = fsStats.wx_sec != null && fsStats.wx_sec > 0
        ? Number((fsStats.wx_sec / bytesToMb).toFixed(2))
        : 0;

      return {
        readMbPerSec,
        writeMbPerSec,
      };
    } catch {
      // Fallback to disksIO
      try {
        const disksIO = await si.disksIO();
        const bytesToMb = 1024 * 1024;
        return {
          readMbPerSec: Number(((disksIO.rIO_sec || 0) / bytesToMb).toFixed(2)),
          writeMbPerSec: Number(((disksIO.wIO_sec || 0) / bytesToMb).toFixed(2)),
        };
      } catch {
        return { readMbPerSec: 0, writeMbPerSec: 0 };
      }
    }
  }

  /**
   * Retrieves top 5 processes sorted by memory and CPU footprint.
   */
  public async getTopProcesses(): Promise<ProcessMetric[]> {
    const processesData = await si.processes();
    const processList = processesData.list || [];

    // Rank by combined CPU and memory impact
    const sorted = [...processList].sort((a, b) => {
      const scoreA = (a.cpu || 0) * 1.5 + (a.mem || 0);
      const scoreB = (b.cpu || 0) * 1.5 + (b.mem || 0);
      return scoreB - scoreA;
    });

    return sorted.slice(0, 5).map((p) => ({
      pid: p.pid,
      name: p.name || 'Unknown',
      command: p.command || p.name || '',
      cpuPercentage: Number((p.cpu || 0).toFixed(2)),
      memoryPercentage: Number((p.mem || 0).toFixed(2)),
    }));
  }

  /**
   * Terminates a process by its PID across Windows and POSIX systems.
   */
  public async killProcess(pid: number): Promise<boolean> {
    if (!pid || pid <= 0) return false;

    try {
      if (process.platform === 'win32') {
        await execAsync(`taskkill /F /PID ${pid}`);
        return true;
      }

      process.kill(pid, 'SIGTERM');
      return true;
    } catch (error: any) {
      console.warn(`[HardwareService] Failed to kill process PID ${pid}:`, error.message || error);
      return false;
    }
  }

  /**
   * Aggregates a complete hardware telemetry snapshot.
   */
  public async getHardwareSnapshot(): Promise<HardwareSnapshot> {
    const [cpu, memory, disk, topProcesses] = await Promise.all([
      this.getCpuMetrics(),
      this.getMemoryMetrics(),
      this.getDiskThroughput(),
      this.getTopProcesses(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      cpu,
      memory,
      disk,
      topProcesses,
    };
  }
}

export const hardwareService = new HardwareService();
