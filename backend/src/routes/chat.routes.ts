import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';

const router = Router();

router.post('/save', (req, res) => chatController.saveMessage(req, res));
router.get('/session/:date', (req, res) => chatController.getSessionMessages(req, res));
router.post('/companion-log', (req, res) => chatController.logCompanionVoice(req, res));
router.get('/companion-logs', (req, res) => chatController.getCompanionLogs(req, res));

export default router;
