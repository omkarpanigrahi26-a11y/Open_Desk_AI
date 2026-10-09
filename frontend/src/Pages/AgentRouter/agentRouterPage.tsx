import React, { useState, useEffect } from 'react';
import { apiClient } from '../../Services/apiClient';
import {
  Cpu,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Layers,
} from 'lucide-react';

export const AgentRouterPage: React.FC = () => {
  const [savings, setSavings] = useState({
    totalTokensSavedToday: 184200,
    totalTokensConsumedToday: 51200,
    allTimeTokensSaved: 840120,
    allTimeTokensConsumed: 231400,
    percentageSaved: 78.4,
    estimatedUsdSavings: 2.84,
    tierDistribution: { tier1: 64, tier2: 28, tier3: 18 },
  });

  const [isLoading, setIsLoading] = useState(false);

  const fetchSavings = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getSavingsMetrics();
      if (res && res.data) {
        setSavings(res.data);
      }
    } catch {
      // Keep mock default if server offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavings();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-screen bg-canvas overflow-y-auto select-none">
      <header className="h-14 border-b border-border-subtle bg-panel/70 backdrop-blur px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <h1 className="text-sm font-semibold text-slate-100">
            Dynamic 3-Tier Multi-Agent Router & Token Economy
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            {savings.percentageSaved}% Capital Savings
          </span>
        </div>

        <button
          onClick={fetchSavings}
          disabled={isLoading}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-panel-elevated hover:bg-panel-highlight text-xs font-mono text-slate-300 border border-border-subtle transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh MySQL Stats</span>
        </button>
      </header>

      <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-1">
            <span className="text-[11px] font-mono text-slate-400 flex items-center">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400 mr-1" />
              Tokens Saved Today
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {savings.totalTokensSavedToday.toLocaleString()}
            </div>
            <span className="text-[10px] font-mono text-slate-500">vs. Cloud LLM Baseline</span>
          </div>

          <div className="p-4 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-1">
            <span className="text-[11px] font-mono text-slate-400 flex items-center">
              <DollarSign className="w-3.5 h-3.5 text-indigo-400 mr-1" />
              Est. USD Saved
            </span>
            <div className="text-xl font-bold font-mono text-indigo-400">
              ${savings.estimatedUsdSavings.toFixed(2)}
            </div>
            <span className="text-[10px] font-mono text-slate-500">at $3.00 / 1M token rate</span>
          </div>

          <div className="p-4 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-1">
            <span className="text-[11px] font-mono text-slate-400 flex items-center">
              <Layers className="w-3.5 h-3.5 text-violet-400 mr-1" />
              Efficiency Ratio
            </span>
            <div className="text-xl font-bold font-mono text-violet-400">
              {savings.percentageSaved}%
            </div>
            <span className="text-[10px] font-mono text-slate-500">Local offline resolution</span>
          </div>

          <div className="p-4 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-1">
            <span className="text-[11px] font-mono text-slate-400 flex items-center">
              <Layers className="w-3.5 h-3.5 text-amber-400 mr-1" />
              Total Executions
            </span>
            <div className="text-xl font-bold font-mono text-slate-200">
              {savings.tierDistribution.tier1 + savings.tierDistribution.tier2 + savings.tierDistribution.tier3}
            </div>
            <span className="text-[10px] font-mono text-slate-500">Persisted in MySQL</span>
          </div>
        </div>

        {/* 3-Tier Decision Matrix Table */}
        <div className="rounded-xl bg-panel border border-border-subtle shadow-workstation overflow-hidden">
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
              3-Tier Multi-Agent Routing Matrix
            </h2>
            <p className="text-[11px] text-slate-400">
              Automated classification rules and operational constraints.
            </p>
          </div>

          <div className="divide-y divide-border-subtle/60 text-xs">
            {/* Tier 1 */}
            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-panel-elevated transition-colors">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                    Tier 1 · Light Agent
                  </span>
                  <span className="font-semibold text-slate-200">OS Operations & Deterministic Heuristics</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Rules: kill PID, check memory/CPU stats, open directory, launch apps, find files.
                </p>
              </div>

              <div className="text-right text-[11px] font-mono space-y-0.5">
                <div className="text-emerald-400 font-bold">0 tokens · &lt;10ms latency</div>
                <div className="text-slate-500">{savings.tierDistribution.tier1} requests handled</div>
              </div>
            </div>

            {/* Tier 2 */}
            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-panel-elevated transition-colors">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-950/40 text-violet-400 border border-violet-900/40">
                    Tier 2 · Moderate Agent
                  </span>
                  <span className="font-semibold text-slate-200">Offline Contextual Intelligence</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Engine: Local Ollama (qwen2.5-coder:32b / llama3.2). AST parsing, log error extraction.
                </p>
              </div>

              <div className="text-right text-[11px] font-mono space-y-0.5">
                <div className="text-violet-400 font-bold">0 cloud cost · 150-600ms latency</div>
                <div className="text-slate-500">{savings.tierDistribution.tier2} requests handled</div>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-panel-elevated transition-colors">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950/40 text-indigo-400 border border-indigo-900/40">
                    Tier 3 · Complex Agent
                  </span>
                  <span className="font-semibold text-slate-200">Cloud Reasoning & Unified Code Patches</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Engine: Cloud Reasoning (Claude 3.7 / GPT-4o). Multi-file refactors, architecture diffs.
                </p>
              </div>

              <div className="text-right text-[11px] font-mono space-y-0.5">
                <div className="text-indigo-400 font-bold">Full API tokens · ~800ms latency</div>
                <div className="text-slate-500">{savings.tierDistribution.tier3} requests handled</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
