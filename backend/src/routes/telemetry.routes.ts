import { Router } from 'express';
import { telemetryController } from '../controllers/telemetry.controller';

const router = Router();

router.get('/snapshot', (req, res) => telemetryController.getSnapshot(req, res));
router.get('/cpu', (req, res) => telemetryController.getCpu(req, res));
router.get('/memory', (req, res) => telemetryController.getMemory(req, res));
router.get('/processes', (req, res) => telemetryController.getProcesses(req, res));
router.delete('/processes/:pid', (req, res) => telemetryController.killProcess(req, res));
router.get('/window', (req, res) => telemetryController.getActiveWindow(req, res));

export default router;
