import { Router } from 'express';
import { dispatchController } from '../controllers/dispatch.controller';

const router = Router();

// POST /api/dispatch - Dispatches query to Tier 1, Tier 2, or Tier 3
router.post('/', (req, res) => dispatchController.handleDispatch(req, res));

// GET /api/dispatch/savings - Returns dynamic token economy statistics
router.get('/savings', (req, res) => dispatchController.getSavingsMetrics(req, res));

export default router;
