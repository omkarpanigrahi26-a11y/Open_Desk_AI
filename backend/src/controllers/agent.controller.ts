import { Request, Response } from 'express';
import { agentOrchestratorService } from '../services/agent/agentOrchestrator.service';

export class AgentController {
  /**
   * POST /api/agent/run
   * Submits prompt, generates plan, and executes until a gate or completion.
   */
  public async runTask(req: Request, res: Response): Promise<void> {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ success: false, message: 'Valid "prompt" is required.' });
        return;
      }

      const plan = await agentOrchestratorService.planAndExecute(prompt.trim());

      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (error: any) {
      console.error('[AgentController] Error executing task:', error);
      res.status(500).json({
        success: false,
        message: 'Agent execution failed.',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/agent/approve
   * Approves a paused permission gate and continues execution.
   */
  public async approveStep(req: Request, res: Response): Promise<void> {
    try {
      const { taskId, stepId } = req.body;
      if (!taskId || !stepId) {
        res.status(400).json({ success: false, message: 'taskId and stepId are required.' });
        return;
      }

      const updatedPlan = await agentOrchestratorService.approveStep(taskId, stepId);
      if (!updatedPlan) {
        res.status(404).json({ success: false, message: 'Task or step not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Step approved and executed.',
        data: updatedPlan,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Approval failed.',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/agent/reject
   * Rejects a paused permission gate and halts execution.
   */
  public async rejectStep(req: Request, res: Response): Promise<void> {
    try {
      const { taskId, stepId } = req.body;
      if (!taskId || !stepId) {
        res.status(400).json({ success: false, message: 'taskId and stepId are required.' });
        return;
      }

      const updatedPlan = await agentOrchestratorService.rejectStep(taskId, stepId);
      if (!updatedPlan) {
        res.status(404).json({ success: false, message: 'Task or step not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Step rejected. Execution halted.',
        data: updatedPlan,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Rejection failed.',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/agent/verify
   * Verifies manual action condition and continues execution.
   */
  public async verifyStep(req: Request, res: Response): Promise<void> {
    try {
      const { taskId, stepId } = req.body;
      if (!taskId || !stepId) {
        res.status(400).json({ success: false, message: 'taskId and stepId are required.' });
        return;
      }

      const result = await agentOrchestratorService.verifyManualStep(taskId, stepId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message,
        data: result.plan,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Verification check failed.',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/agent/task/:taskId
   */
  public async getTask(req: Request, res: Response): Promise<void> {
    const { taskId } = req.params;
    const task = agentOrchestratorService.getTask(taskId);

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found.' });
      return;
    }

    res.status(200).json({ success: true, data: task });
  }
}

export const agentController = new AgentController();
