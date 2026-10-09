import { Router } from 'express';
import { agentController } from '../controllers/agent.controller';

const router = Router();

router.post('/run', (req, res) => agentController.runTask(req, res));
router.post('/approve', (req, res) => agentController.approveStep(req, res));
router.post('/reject', (req, res) => agentController.rejectStep(req, res));
router.post('/verify', (req, res) => agentController.verifyStep(req, res));
router.get('/task/:taskId', (req, res) => agentController.getTask(req, res));

export default router;
