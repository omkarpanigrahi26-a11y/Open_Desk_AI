import React, { useState } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Copy,
  RotateCw,
} from 'lucide-react';

export interface TaskModalStep {
  id: string;
  title: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

interface TaskExecutionModalProps {
  isOpen: boolean;
  taskTitle: string;
  taskDescription: string;
  commandPreview: string;
  isRunning: boolean;
  steps: TaskModalStep[];
  elapsedSeconds: number;
  outputLog: string;
  onClose: () => void;
  onRerun: () => void;
}

export const TaskExecutionModal: React.FC<TaskExecutionModalProps> = ({
  isOpen,
  taskTitle,
  taskDescription,
  commandPreview,
  isRunning,
  steps,
  elapsedSeconds,
  outputLog,
  onClose,
  onRerun,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(outputLog || commandPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFailed = steps.some((s) => s.status === 'FAILED');
  const isComplete = !isRunning && steps.every((s) => s.status === 'COMPLETED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-2xl bg-panel border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-sans">
        {/* Header */}
        <div className="p-5 border-b border-border-subtle flex items-start justify-between bg-panel-elevated/40">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <span className="text-sm font-semibold text-slate-100">{taskTitle}</span>
              {isRunning ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  Running ({elapsedSeconds}s)
                </span>
              ) : isComplete ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completed in {elapsedSeconds}s
                </span>
              ) : isFailed ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-800/60 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Failed
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                  Ready
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{taskDescription}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-panel transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Target Command Monospace Preview */}
          <div className="p-2.5 rounded-lg bg-canvas border border-border-subtle text-xs font-mono space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
              Executing Host Action:
            </span>
            <div className="text-indigo-300 truncate select-all">{commandPreview}</div>
          </div>

          {/* Sub-steps Checklist */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Execution Routine:
            </span>
            <div className="space-y-1.5">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-colors ${
                    step.status === 'COMPLETED'
                      ? 'bg-canvas-subtle/50 border-emerald-900/40 text-emerald-300'
                      : step.status === 'RUNNING'
                      ? 'bg-indigo-950/30 border-indigo-800/60 text-indigo-300'
                      : step.status === 'FAILED'
                      ? 'bg-rose-950/30 border-rose-900/40 text-rose-300'
                      : 'bg-canvas/40 border-border-subtle/60 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {step.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : step.status === 'RUNNING' ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : step.status === 'FAILED' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500" />
                    )}
                    <span>
                      {idx + 1}. {step.title}
                    </span>
                  </div>

                  <span className="text-[10px] capitalize">
                    {step.status.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal Output Stream */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center">
                <Terminal className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Live Terminal Log:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied' : 'Copy Logs'}</span>
              </button>
            </div>

            <div className="p-3 bg-canvas border border-border-subtle rounded-lg text-xs font-mono text-slate-200 min-h-[90px] max-h-[180px] overflow-y-auto whitespace-pre-wrap select-all">
              {outputLog || (isRunning ? 'Processing Windows command...' : 'Ready to execute.')}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border-subtle bg-panel-elevated/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onRerun}
            disabled={isRunning}
            className="px-3 py-1.5 rounded-lg bg-panel hover:bg-panel-highlight disabled:opacity-50 text-slate-300 font-mono text-xs flex items-center space-x-1.5 border border-border-subtle transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Re-run Task</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-medium transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
