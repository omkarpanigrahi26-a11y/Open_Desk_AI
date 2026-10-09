import { Router } from 'express';
import { remoteController } from '../controllers/remote.controller';

const router = Router();

// GET /api/remote/status
router.get('/status', (req, res) => remoteController.getStatus(req, res));

export default router;
