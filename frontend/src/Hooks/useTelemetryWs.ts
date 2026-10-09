import { useState, useEffect, useRef, useCallback } from 'react';
import { BACKEND_CONFIG } from '../Config/routes';

export interface CpuTelemetry {
  loadPercentage: number;
  clockSpeedGhz: number;
  activeCores: number;
  coresLoad: number[];
}

export interface MemoryTelemetry {
  usedGb: number;
  totalGb: number;
  allocationPercentage: number;
}

export interface DiskTelemetry {
  readMbPerSec: number;
  writeMbPerSec: number;
}

export interface ProcessTelemetry {
  pid: number;
  name: string;
  command: string;
  cpuPercentage: number;
  memoryPercentage: number;
}

export interface ActiveWindowTelemetry {
  title: string;
  app: string;
  pid: number;
}

export interface TelemetryData {
  timestamp: string;
  connected: boolean;
  cpu: CpuTelemetry;
  memory: MemoryTelemetry;
  disk: DiskTelemetry;
  topProcesses: ProcessTelemetry[];
  activeWindow: ActiveWindowTelemetry;
}

const DEFAULT_MOCK_TELEMETRY: TelemetryData = {
  timestamp: new Date().toISOString(),
  connected: false,
  cpu: {
    loadPercentage: 34.2,
    clockSpeedGhz: 4.2,
    activeCores: 8,
    coresLoad: [38, 29, 44, 21, 35, 40, 18, 48],
  },
  memory: {
    usedGb: 14.2,
    totalGb: 32.0,
    allocationPercentage: 44.38,
  },
  disk: {
    readMbPerSec: 142.4,
    writeMbPerSec: 28.1,
  },
  topProcesses: [
    { pid: 84219, name: 'Code.exe', command: 'VS Code - distributed-cache', cpuPercentage: 12.4, memoryPercentage: 8.5 },
    { pid: 14022, name: 'ollama.exe', command: 'ollama serve (qwen2.5-coder)', cpuPercentage: 8.1, memoryPercentage: 14.2 },
    { pid: 9281, name: 'node.exe', command: 'node dist/server.js', cpuPercentage: 3.5, memoryPercentage: 2.1 },
    { pid: 21980, name: 'mysqld.exe', command: 'mysqld --console', cpuPercentage: 2.1, memoryPercentage: 4.8 },
    { pid: 6612, name: 'chrome.exe', command: 'chrome.exe --renderer', cpuPercentage: 4.2, memoryPercentage: 5.6 },
  ],
  activeWindow: {
    title: 'VS Code - distributed-cache (pkg/pool)',
    app: 'Code',
    pid: 84219,
  },
};

export function useTelemetryWs(customWsUrl?: string) {
  const [telemetry, setTelemetry] = useState<TelemetryData>(DEFAULT_MOCK_TELEMETRY);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Attempt connection on port 3000, then fallback to 8000
    const urls = [
      customWsUrl || BACKEND_CONFIG.DEFAULT_WS_URL,
      BACKEND_CONFIG.ALT_WS_URL,
    ];

    let currentUrlIndex = 0;

    const tryConnect = () => {
      const url = urls[currentUrlIndex];
      try {
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setTelemetry((prev) => ({ ...prev, connected: true }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'TELEMETRY_UPDATE') {
              setTelemetry({
                timestamp: data.timestamp,
                connected: true,
                cpu: data.hardware?.cpu || DEFAULT_MOCK_TELEMETRY.cpu,
                memory: data.hardware?.memory || DEFAULT_MOCK_TELEMETRY.memory,
                disk: data.hardware?.disk || DEFAULT_MOCK_TELEMETRY.disk,
                topProcesses: data.hardware?.topProcesses || DEFAULT_MOCK_TELEMETRY.topProcesses,
                activeWindow: data.activeWindow || DEFAULT_MOCK_TELEMETRY.activeWindow,
              });
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          ws.close();
        };

        ws.onclose = () => {
          setIsConnected(false);
          setTelemetry((prev) => ({ ...prev, connected: false }));

          // Switch between 3000 and 8000
          currentUrlIndex = (currentUrlIndex + 1) % urls.length;
          reconnectTimeoutRef.current = setTimeout(tryConnect, 3000);
        };
      } catch {
        currentUrlIndex = (currentUrlIndex + 1) % urls.length;
        reconnectTimeoutRef.current = setTimeout(tryConnect, 3000);
      }
    };

    tryConnect();
  }, [customWsUrl]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const killProcess = (pid: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: 'kill_process', pid }));
    }
  };

  return { telemetry, isConnected, killProcess };
}
