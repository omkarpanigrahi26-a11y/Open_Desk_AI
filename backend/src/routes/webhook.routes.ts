import { Router } from 'express';
import { remoteController } from '../controllers/remote.controller';

const router = Router();

// POST /api/webhook/whatsapp - Inbound message handling
router.post('/whatsapp', (req, res) => remoteController.handleWebhook(req, res));

// GET /api/webhook/whatsapp - Meta webhook verification handshake
router.get('/whatsapp', (req, res) => remoteController.verifyWebhook(req, res));

export default router;
