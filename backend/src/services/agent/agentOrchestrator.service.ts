import { taskPlannerService, AgentTaskPlan, PlanStep } from './taskPlanner.service';
import { pcToolsService } from './pcTools.service';
import { hardwareService } from '../telemetry/hardware.service';

export class AgentOrchestratorService {
  private activeTasks = new Map<string, AgentTaskPlan>();

  /**
   * Plans and begins autonomous execution of a prompt until a gate (approval or manual step) is encountered.
   */
  public async planAndExecute(prompt: string): Promise<AgentTaskPlan> {
    const plan = taskPlannerService.generatePlan(prompt);
    this.activeTasks.set(plan.taskId, plan);

    await this.advancePlan(plan);
    return plan;
  }

  /**
   * Advances the task plan until it hits a gate (approval/manual) or reaches completion.
   */
  public async advancePlan(plan: AgentTaskPlan): Promise<void> {
    while (plan.currentStepIndex < plan.steps.length) {
      const currentStep = plan.steps[plan.currentStepIndex];

      // Gate 1: Step requires human approval
      if (currentStep.type === 'REQUIRES_PERMISSION' && currentStep.status !== 'COMPLETED') {
        currentStep.status = 'WAITING_APPROVAL';
        return; // Pause execution for user interaction
      }

      // Gate 2: Step requires manual user action
      if (currentStep.type === 'MANUAL_USER_ACTION' && currentStep.status !== 'COMPLETED') {
        currentStep.status = 'WAITING_MANUAL';
        return; // Pause execution for manual action
      }

      // Execute automated step
      currentStep.status = 'RUNNING';
      const stepSuccess = await this.executeStepAction(currentStep);

      if (stepSuccess) {
        currentStep.status = 'COMPLETED';
        plan.currentStepIndex++;
      } else {
        currentStep.status = 'FAILED';
        return;
      }
    }

    plan.isComplete = true;
  }

  /**
   * Executes the programmatic action associated with a step.
   */
  private async executeStepAction(step: PlanStep): Promise<boolean> {
    if (!step.action) {
      step.output = step.description;
      return true;
    }

    try {
      switch (step.action.tool) {
        case 'LAUNCH_APP': {
          const res = await pcToolsService.launchApplication(step.action.payload.appName);
          step.output = res.output;
          return res.success;
        }

        case 'FIND_FILE': {
          const files = await pcToolsService.findFiles(step.action.payload.query);
          step.output = files.length > 0
            ? `Found ${files.length} matching files:\n` + files.map((f, i) => `${i + 1}. ${f}`).join('\n')
            : `No matching files found.`;
          return true;
        }

        case 'OPEN_LOCATION': {
          const res = await pcToolsService.openLocation(step.action.payload.path);
          step.output = res.output;
          return res.success;
        }

        case 'CREATE_DIRECTORY': {
          const res = await pcToolsService.createDirectory(step.action.payload.path);
          step.output = res.output;
          return res.success;
        }

        case 'CREATE_FILE': {
          const res = await pcToolsService.createFile(step.action.payload.target, step.action.payload.content || '');
          step.output = res.output;
          return res.success;
        }

        case 'DELETE_TARGET': {
          const res = await pcToolsService.deleteTarget(step.action.payload.target);
          step.output = res.output;
          return res.success;
        }

        case 'EDIT_FILE': {
          const res = await pcToolsService.editFile(step.action.payload.target, step.action.payload.content || '', step.action.payload.append ?? true);
          step.output = res.output;
          return res.success;
        }

        case 'CLOSE_APP': {
          const res = await pcToolsService.closeApplication(step.action.payload.appName);
          step.output = res.output;
          return res.success;
        }

        case 'OPEN_URL': {
          const res = await pcToolsService.openUrl(step.action.payload.url);
          step.output = res.output;
          return res.success;
        }

        case 'SYSTEM_ACTION': {
          const res = await pcToolsService.systemAction(step.action.payload.action);
          step.output = res.output;
          return res.success;
        }

        case 'PLAY_YOUTUBE': {
          const res = await pcToolsService.playYoutube(step.action.payload.query);
          step.output = res.output;
          return res.success;
        }

        case 'WHATSAPP_ACTION': {
          const res = await pcToolsService.handleWhatsApp(
            step.action.payload.action || 'OPEN',
            step.action.payload.contact,
            step.action.payload.message
          );
          step.output = res.output;
          return res.success;
        }

        case 'PLAY_SPOTIFY': {
          const res = await pcToolsService.playSpotify(step.action.payload.query);
          step.output = res.output;
          return res.success;
        }

        case 'SCROLL_PAGE': {
          const res = await pcToolsService.scrollPage(step.action.payload.direction || 'DOWN', step.action.payload.amount || 1);
          step.output = res.output;
          return res.success;
        }

        case 'PLAY_YOUTUBE_VIDEO': {
          const res = await pcToolsService.playYoutubeVideoByIndexOrName(step.action.payload.indexOrName);
          step.output = res.output;
          return res.success;
        }

        case 'AUTO_SCROLL_START': {
          const res = pcToolsService.startAutoScroll(step.action.payload.direction || 'DOWN', step.action.payload.intervalMs || 900);
          step.output = res.output;
          return res.success;
        }

        case 'AUTO_SCROLL_STOP': {
          const res = await pcToolsService.stopEverything();
          step.output = res.output;
          return res.success;
        }

        case 'RESUME_PLAYBACK': {
          const res = await pcToolsService.resumePlayback();
          step.output = res.output;
          return res.success;
        }

        case 'WINDOW_STATE': {
          const res = await pcToolsService.setWindowState(step.action.payload.state || 'MINIMIZE');
          step.output = res.output;
          return res.success;
        }

        case 'OPEN_FILE_MANAGER': {
          const res = await pcToolsService.openFileManager(step.action.payload.folderOrFile);
          step.output = res.output;
          return res.success;
        }

        case 'SET_ALARM': {
          const res = await pcToolsService.setAlarm(step.action.payload.timeOrQuery);
          step.output = res.output;
          return res.success;
        }

        case 'EXECUTE_COMMAND': {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          const { stdout } = await execAsync(step.action.payload.command);
          step.output = stdout.trim() || 'Command executed successfully.';
          return true;
        }

        default:
          step.output = 'Action executed.';
          return true;
      }
    } catch (err: any) {
      step.error = err.message;
      step.output = `Step execution failed: ${err.message}`;
      return false;
    }
  }

  /**
   * Approves a paused step and resumes workflow execution.
   */
  public async approveStep(taskId: string, stepId: string): Promise<AgentTaskPlan | null> {
    const plan = this.activeTasks.get(taskId);
    if (!plan) return null;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return null;

    // Execute the approved action
    step.status = 'RUNNING';
    const success = await this.executeStepAction(step);
    step.status = success ? 'COMPLETED' : 'FAILED';

    if (success) {
      plan.currentStepIndex++;
      await this.advancePlan(plan);
    }

    return plan;
  }

  /**
   * Rejects a paused permission gate and halts the plan.
   */
  public async rejectStep(taskId: string, stepId: string): Promise<AgentTaskPlan | null> {
    const plan = this.activeTasks.get(taskId);
    if (!plan) return null;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return null;

    step.status = 'FAILED';
    step.error = 'Action rejected by user. Workflow halted safely.';
    step.output = 'Action rejected by user.';
    plan.isComplete = true;

    return plan;
  }

  /**
   * Verifies manual condition and continues workflow.
   */
  public async verifyManualStep(taskId: string, stepId: string): Promise<{ success: boolean; plan: AgentTaskPlan | null; message: string }> {
    const plan = this.activeTasks.get(taskId);
    if (!plan) {
      return { success: false, plan: null, message: 'Task not found' };
    }

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      return { success: false, plan, message: 'Step not found' };
    }

    // Check verification condition if specified
    if (step.verificationCheck) {
      const isVerified = await pcToolsService.verifyCondition(
        step.verificationCheck.type,
        step.verificationCheck.target
      );

      if (!isVerified) {
        return {
          success: false,
          plan,
          message: `Verification check failed: target condition "${step.verificationCheck.target}" was not met. Please complete the action and try again.`,
        };
      }
    }

    step.status = 'COMPLETED';
    step.output = 'Manual action verified successfully.';
    plan.currentStepIndex++;

    await this.advancePlan(plan);

    return {
      success: true,
      plan,
      message: 'Verified successfully! Proceeding with next steps.',
    };
  }

  public getTask(taskId: string): AgentTaskPlan | null {
    return this.activeTasks.get(taskId) || null;
  }
}

export const agentOrchestratorService = new AgentOrchestratorService();
