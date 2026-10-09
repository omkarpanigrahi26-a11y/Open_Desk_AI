import { Router } from 'express';
import { filesController } from '../controllers/files.controller';

const router = Router();

// GET /api/files/search?q={query}
router.get('/search', (req, res) => filesController.search(req, res));

// POST /api/files/reindex
router.post('/reindex', (req, res) => filesController.reindex(req, res));

// GET /api/files/status
router.get('/status', (req, res) => filesController.getStatus(req, res));

export default router;
