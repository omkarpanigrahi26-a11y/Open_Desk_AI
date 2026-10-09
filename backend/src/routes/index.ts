import { Router } from 'express';
import filesRoutes from './files.routes';
import tokenMetricRoutes from './tokenMetric.routes';
import dispatchRoutes from './dispatch.routes';
import remoteRoutes from './remote.routes';
import webhookRoutes from './webhook.routes';
import agentRoutes from './agent.routes';
import chatRoutes from './chat.routes';
import voiceRoutes from './voice.routes';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/files', filesRoutes);
router.use('/tokens', tokenMetricRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/remote', remoteRoutes);
router.use('/webhook', webhookRoutes);
router.use('/agent', agentRoutes);
router.use('/chat', chatRoutes);
router.use('/voice', voiceRoutes);

export default router;
