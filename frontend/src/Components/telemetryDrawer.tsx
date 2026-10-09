import React from 'react';
import type { TelemetryData } from '../Hooks/useTelemetryWs';
import {
  Cpu,
  HardDrive,
  Activity,
  Zap,
  Smartphone,
  Lock,
  ChevronRight,
} from 'lucide-react';

interface TelemetryDrawerProps {
  telemetry: TelemetryData;
  savingsMetrics?: {
    percentageSaved?: number;
    totalTokensSavedToday?: number;
    estimatedUsdSavings?: number;
  };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  telemetry,
  savingsMetrics,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    return (
      <div className="w-10 flex-shrink-0 bg-panel border-l border-border-subtle flex flex-col items-center py-4 select-none h-full justify-between z-20">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-panel-elevated transition-colors"
          title="Expand Runtime Telemetry (Ctrl+B)"
        >
          <Activity className="w-4 h-4 text-emerald-400" />
        </button>
        <span className="text-[10px] font-mono text-slate-500 [writing-mode:vertical-lr] rotate-180">
          Runtime Telemetry
        </span>
      </div>
    );
  }

  const percentageSaved = savingsMetrics?.percentageSaved ?? 78.4;
  const savedTokensToday = savingsMetrics?.totalTokensSavedToday ?? 184200;
  const usdSaved = savingsMetrics?.estimatedUsdSavings ?? 2.84;

  const cpuLoad = Math.round(telemetry.cpu.loadPercentage);
  const memUsed = telemetry.memory.usedGb;
  const memTotal = telemetry.memory.totalGb;
  const memPercent = Math.round(telemetry.memory.allocationPercentage);

  return (
    <aside className="w-80 flex-shrink-0 bg-panel border-l border-border-subtle flex flex-col h-full select-none overflow-y-auto z-20">
      {/* 1. Drawer Header Bar */}
      <div className="p-3.5 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-xs tracking-wide uppercase text-slate-200">
            Runtime Telemetry
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                telemetry.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[10px] font-mono text-slate-400">
              {telemetry.connected ? '500ms LIVE' : 'SYNCING'}
            </span>
          </div>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-panel-elevated transition-colors ml-1"
              title="Collapse Panel (Ctrl+B)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 2. Tiered Savings Engine */}
        <div className="p-3.5 rounded-lg bg-panel-elevated border border-border-subtle shadow-workstation">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center text-xs font-semibold text-violet-300">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
              Tiered Savings Engine
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
              {percentageSaved}% SAVED
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
            via local heuristics, AST inspection & offline execution.
          </p>

          {/* Segmented Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2 rounded bg-canvas flex overflow-hidden border border-border-subtle">
              <div
                style={{ width: '52%' }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title="Tier 1 (Light / 0 tok): 52%"
              />
              <div
                style={{ width: '26%' }}
                className="bg-violet-500 h-full transition-all duration-300"
                title="Tier 2 (Ollama / Local): 26%"
              />
              <div
                style={{ width: '22%' }}
                className="bg-indigo-600 h-full transition-all duration-300"
                title="Tier 3 (Cloud LLM): 22%"
              />
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                T1: 52%
              </span>
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-1" />
                T2: 26%
              </span>
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1" />
                T3: 22%
              </span>
            </div>
          </div>

          {/* Savings Metric Footer */}
          <div className="mt-3 pt-2.5 border-t border-border-subtle/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Saved today:</span>
            <span className="text-emerald-400 font-medium">
              {savedTokensToday.toLocaleString()} tok (${usdSaved.toFixed(2)} saved)
            </span>
          </div>
        </div>

        {/* 3. Hardware Meters */}
        <div className="p-3.5 rounded-lg bg-panel-elevated border border-border-subtle shadow-workstation space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center text-xs font-semibold text-slate-200">
              <Cpu className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Hardware Meters
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              SAMPLING 2Hz
            </span>
          </div>

          {/* CPU Meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">CPU Load:</span>
              <span className="text-slate-200 font-bold">
                {cpuLoad}% @ {telemetry.cpu.clockSpeedGhz} GHz
              </span>
            </div>
            <div className="w-full h-1.5 rounded bg-canvas overflow-hidden border border-border-subtle">
              <div
                style={{ width: `${cpuLoad}%` }}
                className="bg-indigo-500 h-full transition-all duration-300"
              />
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {telemetry.cpu.activeCores} physical cores active
            </div>
          </div>

          {/* RAM Meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">RAM Allocation:</span>
              <span className="text-slate-200 font-bold">
                {memUsed} GB / {memTotal} GB
              </span>
            </div>
            <div className="w-full h-1.5 rounded bg-canvas overflow-hidden border border-border-subtle">
              <div
                style={{ width: `${memPercent}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
              />
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {memPercent}% allocated capacity
            </div>
          </div>

          {/* Storage / NVMe IO */}
          <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center">
              <HardDrive className="w-3 h-3 mr-1 text-slate-500" />
              NVMe IO:
            </span>
            <span className="text-slate-300">
              Read {telemetry.disk.readMbPerSec} MB/s | Write {telemetry.disk.writeMbPerSec} MB/s
            </span>
          </div>
        </div>

        {/* 4. WhatsApp Companion Bridge */}
        <div className="p-3.5 rounded-lg bg-panel-elevated border border-border-subtle shadow-workstation space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center text-xs font-semibold text-slate-200">
              <Smartphone className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              WhatsApp Companion Bridge
            </span>
            <Lock className="w-3 h-3 text-slate-500" />
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>AES-256 Connected to WhatsApp client</span>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Send audio notes or texts to trigger workstation routines remotely.
          </p>
        </div>
      </div>
    </aside>
  );
};
