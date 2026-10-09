import { Router } from 'express';
import { tokenMetricController } from '../controllers/tokenMetric.controller';

const router = Router();

router.get('/summary', (req, res) => tokenMetricController.getSummary(req, res));
router.get('/recent', (req, res) => tokenMetricController.getRecent(req, res));
router.post('/log', (req, res) => tokenMetricController.create(req, res));

export default router;
