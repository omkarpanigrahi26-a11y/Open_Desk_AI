import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../Services/apiClient';
import { TaskExecutionModal } from './Components/taskExecutionModal';
import type { TaskModalStep } from './Components/taskExecutionModal';
import {
  PlayCircle,
  Trash2,
  Wifi,
  HardDrive,
  Cpu,
  Clock,
  Layers,
} from 'lucide-react';

interface AutomationRoutine {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  icon: React.FC<{ className?: string }>;
  substeps: string[];
  lastRun?: string;
  runsCount: number;
}

export const TaskAutomationsPage: React.FC = () => {
  const [routines] = useState<AutomationRoutine[]>([
    {
      id: 'clean-temp',
      category: 'System Maintenance',
      title: 'Clean Temporary Files & Cache',
      description: 'Purges unreferenced cache blocks from %TEMP% directory and reclaims disk space.',
      prompt: 'clean temporary files',
      icon: Trash2,
      substeps: [
        'Inspect %TEMP% and user application cache',
        'Purge unreferenced files and temp logs',
        'Measure recovered storage space',
      ],
      runsCount: 14,
    },
    {
      id: 'flush-dns',
      category: 'Network & Connectivity',
      title: 'Flush Windows DNS Cache',
      description: 'Executes Clear-DnsClientCache to reset resolver cache and restore network routes.',
      prompt: 'flush dns cache',
      icon: Wifi,
      substeps: [
        'Query active DNS client resolver state',
        'Flush cached hostname to IP address mappings',
        'Confirm DNS cache reset',
      ],
      runsCount: 8,
    },
    {
      id: 'disk-space',
      category: 'Disk & Storage',
      title: 'Inspect Disk Space & Storage',
      description: 'Measures total, used, and free capacity across all mounted Windows filesystems (C:, D:).',
      prompt: 'check disk space',
      icon: HardDrive,
      substeps: [
        'Query Windows storage volume drives',
        'Calculate used vs. free gigabytes',
        'Format capacity overview table',
      ],
      runsCount: 22,
    },
    {
      id: 'top-proc',
      category: 'Performance Diagnostics',
      title: 'Identify Resource-Heavy Processes',
      description: 'Inspects running processes and flags top consumers by memory and CPU utilization.',
      prompt: 'list high resource processes',
      icon: Cpu,
      substeps: [
        'Scan active Windows process table',
        'Sort processes by RAM and CPU consumption',
        'Return top consumer diagnostic summary',
      ],
      runsCount: 19,
    },
    {
      id: 'quick-work',
      category: 'Workstation Setup',
      title: 'Launch Daily Work Environment',
      description: 'Ensures essential workspace applications are active and ready for work.',
      prompt: 'search and open workbench',
      icon: Layers,
      substeps: [
        'Verify host desktop context',
        'Launch workspace tools and databases',
        'Confirm window instance initialization',
      ],
      runsCount: 5,
    },
  ]);

  // Modal State
  const [activeTask, setActiveTask] = useState<AutomationRoutine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const [modalSteps, setModalSteps] = useState<TaskModalStep[]>([]);
  const [modalOutput, setModalOutput] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const runTask = async (routine: AutomationRoutine) => {
    setActiveTask(routine);
    setIsModalOpen(true);
    setIsTaskRunning(true);
    setModalOutput('Initiating routine on Windows workstation...');
    setElapsedSeconds(0);

    // Initial step setup
    const initialSteps: TaskModalStep[] = routine.substeps.map((st, i) => ({
      id: `step-${i}`,
      title: st,
      status: i === 0 ? 'RUNNING' : 'PENDING',
    }));
    setModalSteps(initialSteps);

    // Start elapsed timer
    if (timerRef.current) clearInterval(timerRef.current);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      // Execute on real backend
      const res = await apiClient.runAgentTask(routine.prompt);
      let outputText = 'Task completed successfully.';

      if (res && res.data && res.data.steps) {
        const completedStep = res.data.steps.find((s: any) => s.output);
        if (completedStep) {
          outputText = completedStep.output;
        } else {
          outputText = res.data.summary;
        }
      }

      // Mark all steps complete
      setModalSteps((prev) => prev.map((s) => ({ ...s, status: 'COMPLETED' })));
      setModalOutput(outputText);
    } catch (err: any) {
      setModalSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx === 0 ? 'FAILED' : 'PENDING',
        }))
      );
      setModalOutput(`Execution failed: ${err.message || 'Host error occurred.'}`);
    } finally {
      setIsTaskRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-y-auto select-none">
      {/* Sub-Header */}
      <div className="h-10 border-b border-border-subtle/70 bg-panel/50 px-8 flex items-center justify-between flex-shrink-0 text-xs font-sans text-slate-400">
        <span>Autonomous PC Maintenance & Diagnostic Tasks</span>
        <span className="text-[10px] font-mono text-slate-500">
          {routines.length} Configured Routines
        </span>
      </div>

      {/* Fluid Full Viewport Card Grid */}
      <div className="p-8 space-y-6 w-full font-sans">
        <p className="text-xs text-slate-400">
          Execute real system maintenance and diagnostics directly on your host machine with interactive progress tracking.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {routines.map((routine) => {
            const Icon = routine.icon;

            return (
              <div
                key={routine.id}
                className="p-5 rounded-xl bg-panel border border-border-subtle shadow-workstation hover:border-border-subtle/90 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-lg bg-panel-elevated border border-border-subtle text-indigo-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-canvas px-2 py-0.5 rounded border border-border-subtle">
                      {routine.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{routine.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {routine.description}
                    </p>
                  </div>
                </div>

                {/* Footer with Sub-steps count and Run Button */}
                <div className="pt-3 border-t border-border-subtle/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {routine.substeps.length} Steps
                  </span>

                  <button
                    onClick={() => runTask(routine)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-mono text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Run Task</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Task Execution Modal */}
      {activeTask && (
        <TaskExecutionModal
          isOpen={isModalOpen}
          taskTitle={activeTask.title}
          taskDescription={activeTask.description}
          commandPreview={activeTask.prompt}
          isRunning={isTaskRunning}
          steps={modalSteps}
          elapsedSeconds={elapsedSeconds}
          outputLog={modalOutput}
          onClose={() => setIsModalOpen(false)}
          onRerun={() => runTask(activeTask)}
        />
      )}
    </div>
  );
};
