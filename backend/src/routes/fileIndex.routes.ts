import { Router } from 'express';
import { fileIndexController } from '../controllers/fileIndex.controller';

const router = Router();

router.get('/recent', (req, res) => fileIndexController.getRecent(req, res));
router.get('/search', (req, res) => fileIndexController.search(req, res));
router.post('/index', (req, res) => fileIndexController.upsert(req, res));

export default router;
