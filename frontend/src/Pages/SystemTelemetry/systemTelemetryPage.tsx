import React, { useState } from 'react';
import { useTelemetryWs } from '../../Hooks/useTelemetryWs';
import {
  Activity,
  Cpu,
  Layers,
  Trash2,
  Gauge,
  Radio,
  Search,
} from 'lucide-react';

export const SystemTelemetryPage: React.FC = () => {
  const { telemetry, isConnected, killProcess } = useTelemetryWs();
  const [filterText, setFilterText] = useState('');
  const [killedPids, setKilledPids] = useState<Set<number>>(new Set());

  const handleKill = (pid: number) => {
    if (confirm(`Terminate process PID ${pid}?`)) {
      killProcess(pid);
      setKilledPids((prev) => new Set(prev).add(pid));
    }
  };

  const filteredProcesses = telemetry.topProcesses.filter(
    (p) =>
      p.name.toLowerCase().includes(filterText.toLowerCase()) ||
      p.command.toLowerCase().includes(filterText.toLowerCase()) ||
      String(p.pid).includes(filterText)
  );

  return (
    <div className="flex-1 flex flex-col h-screen bg-canvas overflow-y-auto select-none">
      {/* Top Header */}
      <header className="h-14 border-b border-border-subtle bg-panel/70 backdrop-blur px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h1 className="text-sm font-semibold text-slate-100">
            System Telemetry & Hardware Monitor
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            500ms Real-Time WebSocket
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="text-slate-300">{isConnected ? 'LIVE HARVEST' : 'OFFLINE SIMULATOR'}</span>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Core Frequencies & Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CPU Overview */}
          <div className="p-4 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center">
                <Cpu className="w-4 h-4 mr-1.5 text-indigo-400" />
                CPU Core Matrix
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {Math.round(telemetry.cpu.loadPercentage)}%
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Clock: {telemetry.cpu.clockSpeedGhz} GHz | {telemetry.cpu.activeCores} Cores Active
            </div>

            {/* Per-core visual bars */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {(telemetry.cpu.coresLoad || [24, 38, 42, 19, 55, 31, 28, 46]).map((coreLoad, idx) => (
                <div key={idx} className="bg-canvas p-1.5 rounded border border-border-subtle text-center">
                  <div className="text-[9px] font-mono text-slate-500">C{idx}</div>
                  <div className="h-8 bg-slate-900 rounded-sm relative overflow-hidden my-0.5">
                    <div
                      className={`absolute bottom-0 w-full transition-all duration-300 ${
                        coreLoad > 75 ? 'bg-red-400' : coreLoad > 45 ? 'bg-indigo-400' : 'bg-emerald-400'
                      }`}
                      style={{ height: `${coreLoad}%` }}
                    />
                  </div>
                  <div className="text-[9px] font-mono text-slate-300">{coreLoad}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Memory Fragmentation */}
          <div className="p-4 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center">
                <Layers className="w-4 h-4 mr-1.5 text-violet-400" />
                RAM Allocation
              </span>
              <span className="text-[11px] font-mono text-violet-400 font-bold">
                {Math.round(telemetry.memory.allocationPercentage)}%
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              {telemetry.memory.usedGb} GB / {telemetry.memory.totalGb} GB Allocated
            </div>

            <div className="w-full h-3 rounded bg-canvas overflow-hidden border border-border-subtle flex">
              <div
                style={{ width: `${telemetry.memory.allocationPercentage}%` }}
                className="bg-violet-500 h-full transition-all"
              />
              <div style={{ width: '15%' }} className="bg-indigo-700 h-full" title="Cache buffers" />
            </div>

            <div className="pt-2 text-[10px] font-mono text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Committed Heap:</span>
                <span className="text-slate-200">{(telemetry.memory.usedGb * 0.7).toFixed(1)} GB</span>
              </div>
              <div className="flex justify-between">
                <span>Memory Fragmentation:</span>
                <span className="text-emerald-400">Low (3.2%)</span>
              </div>
            </div>
          </div>

          {/* GPU VRAM & Accelerator */}
          <div className="p-4 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center">
                <Gauge className="w-4 h-4 mr-1.5 text-emerald-400" />
                VRAM Acceleration
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                6.8 GB / 16 GB
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Ollama Local GPU Layer Offload (42.5%)
            </div>

            <div className="w-full h-3 rounded bg-canvas overflow-hidden border border-border-subtle">
              <div style={{ width: '42.5%' }} className="bg-emerald-500 h-full" />
            </div>

            <div className="pt-2 text-[10px] font-mono text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Model Resident:</span>
                <span className="text-slate-200">qwen2.5-coder:32b</span>
              </div>
              <div className="flex justify-between">
                <span>GPU Compute Engine:</span>
                <span className="text-indigo-400">DirectML / CUDA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Process Manager */}
        <div className="rounded-xl bg-panel border border-border-subtle shadow-workstation overflow-hidden">
          <div className="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                Workstation Host Process Table
              </h2>
              <p className="text-[11px] text-slate-400">
                Active processes ranked by combined memory & CPU footprint.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter by name or PID..."
                className="bg-canvas border border-border-subtle rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-panel-elevated text-slate-400 border-b border-border-subtle text-[11px]">
                <tr>
                  <th className="px-4 py-2.5">PID</th>
                  <th className="px-4 py-2.5">Process Name</th>
                  <th className="px-4 py-2.5">Command Signature</th>
                  <th className="px-4 py-2.5">CPU %</th>
                  <th className="px-4 py-2.5">Memory %</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-slate-300">
                {filteredProcesses.map((proc) => {
                  const isKilled = killedPids.has(proc.pid);

                  return (
                    <tr
                      key={proc.pid}
                      className={`hover:bg-panel-highlight transition-colors ${
                        isKilled ? 'opacity-40 line-through' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-slate-400">{proc.pid}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-100">{proc.name}</td>
                      <td className="px-4 py-2.5 text-slate-400 truncate max-w-xs">{proc.command}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            proc.cpuPercentage > 10
                              ? 'bg-red-950/40 text-red-400 border border-red-900/40'
                              : 'text-slate-300'
                          }`}
                        >
                          {proc.cpuPercentage}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-violet-400">{proc.memoryPercentage}%</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleKill(proc.pid)}
                          disabled={isKilled}
                          className="flex items-center space-x-1 px-2 py-1 ml-auto rounded bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-900/40 text-[10px] transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{isKilled ? 'Terminated' : 'Kill Process'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
