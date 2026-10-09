import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  UserCheck,
  Clock,
  Loader2,
  Terminal,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

export interface PlanStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: 'AUTOMATED' | 'REQUIRES_PERMISSION' | 'MANUAL_USER_ACTION';
  status: 'PENDING' | 'WAITING_APPROVAL' | 'WAITING_MANUAL' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  action?: {
    tool: 'LAUNCH_APP' | 'FIND_FILE' | 'OPEN_LOCATION' | 'EXECUTE_COMMAND';
    payload: any;
  };
  manualInstructions?: string[];
  verificationCheck?: {
    type: 'PROCESS_RUNNING' | 'FILE_EXISTS' | 'COMMAND_CHECK';
    target: string;
  };
  output?: string;
  error?: string;
}

export interface AgentTaskPlan {
  taskId: string;
  userPrompt: string;
  summary: string;
  createdAt: string;
  currentStepIndex: number;
  steps: PlanStep[];
  isComplete: boolean;
}

interface AgentPlanCardProps {
  plan: AgentTaskPlan;
  onApprove: (taskId: string, stepId: string) => Promise<void>;
  onReject: (taskId: string, stepId: string) => Promise<void>;
  onVerify: (taskId: string, stepId: string) => Promise<void>;
}

export const AgentPlanCard: React.FC<AgentPlanCardProps> = ({
  plan,
  onApprove,
  onReject,
  onVerify,
}) => {
  const [actingStepId, setActingStepId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const completedCount = plan.steps.filter((s) => s.status === 'COMPLETED').length;
  const totalCount = plan.steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const waitingApprovalStep = plan.steps.find((s) => s.status === 'WAITING_APPROVAL');
  const waitingManualStep = plan.steps.find((s) => s.status === 'WAITING_MANUAL');

  const handleApprove = async (stepId: string) => {
    setActingStepId(stepId);
    setVerifyError(null);
    try {
      await onApprove(plan.taskId, stepId);
    } finally {
      setActingStepId(null);
    }
  };

  const handleReject = async (stepId: string) => {
    setActingStepId(stepId);
    setVerifyError(null);
    try {
      await onReject(plan.taskId, stepId);
    } finally {
      setActingStepId(null);
    }
  };

  const handleVerify = async (stepId: string) => {
    setActingStepId(stepId);
    setVerifyError(null);
    try {
      await onVerify(plan.taskId, stepId);
    } catch (err: any) {
      setVerifyError(err.message || 'Verification condition check failed. Please check your action and retry.');
    } finally {
      setActingStepId(null);
    }
  };

  return (
    <div className="w-full bg-panel border border-border-subtle rounded-xl p-4 shadow-workstation space-y-4 font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-slate-100">
              PC Task Execution Plan
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-panel-elevated text-slate-400 border border-border-subtle">
              ID: {plan.taskId.slice(0, 8)}
            </span>
          </div>
          <p className="text-xs text-slate-400">{plan.summary}</p>
        </div>

        {/* Status Pill */}
        <div>
          {plan.isComplete ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Completed
            </span>
          ) : waitingApprovalStep ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center space-x-1">
              <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-400 animate-bounce" />
              Action Paused: Approval
            </span>
          ) : waitingManualStep ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 mr-1 text-cyan-400 animate-pulse" />
              Awaiting User Action
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 flex items-center space-x-1">
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              Running Steps
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-mono text-slate-400">
          <span>Execution Progress</span>
          <span>
            {completedCount} of {totalCount} steps ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden border border-border-subtle">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist of Steps */}
      <div className="space-y-2.5">
        {plan.steps.map((step, idx) => (
          <div
            key={step.id}
              className={`rounded-lg border p-3 transition-colors ${
                step.status === 'COMPLETED'
                  ? 'bg-canvas-subtle/50 border-emerald-900/30'
                  : step.status === 'WAITING_APPROVAL'
                  ? 'bg-amber-950/20 border-amber-800/60 shadow-md'
                  : step.status === 'WAITING_MANUAL'
                  ? 'bg-cyan-950/20 border-cyan-800/60 shadow-md'
                  : step.status === 'RUNNING'
                  ? 'bg-indigo-950/20 border-indigo-700/60 shadow-md'
                  : step.status === 'FAILED'
                  ? 'bg-rose-950/20 border-rose-800/60'
                  : 'bg-canvas/40 border-border-subtle opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2.5">
                  <div className="mt-0.5">
                    {step.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : step.status === 'RUNNING' ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : step.status === 'WAITING_APPROVAL' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    ) : step.status === 'WAITING_MANUAL' ? (
                      <UserCheck className="w-4 h-4 text-cyan-400" />
                    ) : step.status === 'FAILED' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-200">
                        {idx + 1}. {step.title}
                      </span>
                      {step.type === 'REQUIRES_PERMISSION' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-950/50 text-amber-400 border border-amber-800/40">
                          Gate: Permission
                        </span>
                      )}
                      {step.type === 'MANUAL_USER_ACTION' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950/50 text-cyan-400 border border-cyan-800/40">
                          Manual Action
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{step.description}</p>
                  </div>
                </div>

                {/* Step Status Badge */}
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border capitalize ${
                    step.status === 'COMPLETED'
                      ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40'
                      : step.status === 'RUNNING'
                      ? 'bg-indigo-950/30 text-indigo-300 border-indigo-800/40'
                      : step.status === 'WAITING_APPROVAL'
                      ? 'bg-amber-950/50 text-amber-300 border-amber-800/50 font-semibold'
                      : step.status === 'WAITING_MANUAL'
                      ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800/50 font-semibold'
                      : step.status === 'FAILED'
                      ? 'bg-rose-950/40 text-rose-300 border-rose-800/40'
                      : 'bg-panel text-slate-500 border-border-subtle'
                  }`}
                >
                  {step.status.replace('_', ' ').toLowerCase()}
                </span>
              </div>

              {/* Step Output Box (if generated) */}
              {step.output && (
                <div className="mt-2.5 p-2 bg-canvas/80 border border-border-subtle rounded text-[11px] font-mono text-slate-300 whitespace-pre-wrap flex items-start space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <span className="overflow-x-auto">{step.output}</span>
                </div>
              )}

              {/* Step Error Box */}
              {step.error && (
                <div className="mt-2.5 p-2 bg-rose-950/30 border border-rose-900/40 rounded text-[11px] font-mono text-rose-300 flex items-start space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{step.error}</span>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Interactive Permission Gate Card */}
      {waitingApprovalStep && (
        <div className="bg-amber-950/30 border border-amber-600/50 rounded-xl p-4 space-y-3 shadow-lg animate-fadeIn">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-200">
                Action Requires Your Authorization
              </h4>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                OpenDesk AI is safely paused. This operation modifies system state or terminates resources. Please approve or deny this execution:
              </p>
            </div>
          </div>

          {/* Action Details Monospace Preview */}
          {waitingApprovalStep.action && (
            <div className="bg-canvas border border-amber-900/50 rounded-lg p-2.5 text-xs font-mono text-slate-300 space-y-1">
              <div className="text-slate-500 text-[10px]">TARGET COMMAND:</div>
              <div className="text-amber-300 select-all">
                {waitingApprovalStep.action.payload?.command ||
                  JSON.stringify(waitingApprovalStep.action.payload)}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-1">
            <button
              onClick={() => handleApprove(waitingApprovalStep.id)}
              disabled={actingStepId === waitingApprovalStep.id}
              className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs font-mono flex items-center justify-center space-x-1.5 shadow transition-colors disabled:opacity-50"
            >
              {actingStepId === waitingApprovalStep.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>[Approve & Execute]</span>
            </button>

            <button
              onClick={() => handleReject(waitingApprovalStep.id)}
              disabled={actingStepId === waitingApprovalStep.id}
              className="py-2 px-4 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 font-medium text-xs font-mono flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>[Reject / Halt]</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Manual Action Protocol Card */}
      {waitingManualStep && (
        <div className="bg-cyan-950/30 border border-cyan-600/50 rounded-xl p-4 space-y-3 shadow-lg animate-fadeIn">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-cyan-200">
                Action Required On Host System
              </h4>
              <p className="text-xs text-cyan-300/80 leading-relaxed">
                This task requires your manual action on Windows. Please follow the instructions below, then click Verify & Continue:
              </p>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          {waitingManualStep.manualInstructions && (
            <div className="bg-canvas border border-cyan-900/50 rounded-lg p-3 space-y-2">
              <div className="text-[10px] font-mono text-cyan-400 font-semibold uppercase tracking-wider">
                Step-by-Step Instructions:
              </div>
              <div className="space-y-1.5 text-xs text-slate-200">
                {waitingManualStep.manualInstructions.map((instruction, iIdx) => (
                  <div key={iIdx} className="flex items-start space-x-2">
                    <span className="text-cyan-400 font-mono flex-shrink-0">•</span>
                    <span>{instruction}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Target Note */}
          {waitingManualStep.verificationCheck && (
            <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5">
              <span>Automated verification will inspect:</span>
              <span className="text-cyan-300 font-semibold px-1.5 py-0.5 rounded bg-panel border border-border-subtle">
                {waitingManualStep.verificationCheck.target} (
                {waitingManualStep.verificationCheck.type})
              </span>
            </div>
          )}

          {/* Verification Error Notice */}
          {verifyError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs font-mono text-rose-300 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{verifyError}</span>
            </div>
          )}

          {/* Verify & Continue Button */}
          <div className="pt-1">
            <button
              onClick={() => handleVerify(waitingManualStep.id)}
              disabled={actingStepId === waitingManualStep.id}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium text-xs font-mono flex items-center justify-center space-x-2 shadow-md transition-colors disabled:opacity-50"
            >
              {actingStepId === waitingManualStep.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>[Verify & Continue Autonomous Execution]</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
