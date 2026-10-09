import { Request, Response } from 'express';
import { whatsappService } from '../services/remote/whatsapp.service';

export class RemoteController {
  /**
   * POST /api/webhook/whatsapp
   * Handles incoming WhatsApp message webhooks and dispatches commands.
   */
  public async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      const result = await whatsappService.handleIncomingMessage(payload);

      if (!result.authorized) {
        res.status(403).json({
          success: false,
          message: 'Sender is not authorized.',
          reply: result.formattedReply,
        });
        return;
      }

      res.status(200).json({
        success: true,
        sender: result.sender,
        query: result.query,
        reply: result.formattedReply,
        data: result.dispatchResult,
      });
    } catch (error: any) {
      console.error('[RemoteController] Webhook handling error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal error processing remote message.',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/webhook/whatsapp
   * Verification handshake for Meta WhatsApp Cloud API.
   */
  public async verifyWebhook(req: Request, res: Response): Promise<void> {
    const mode = req.query['hub.mode'] as string | undefined;
    const token = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'] as string | undefined;

    const verifiedChallenge = whatsappService.verifyWebhookChallenge(mode, token, challenge);

    if (verifiedChallenge) {
      res.status(200).send(verifiedChallenge);
    } else {
      res.status(403).send('Verification failed');
    }
  }

  /**
   * GET /api/remote/status
   * Returns health and configuration status of WhatsApp bridge.
   */
  public async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = whatsappService.getStatus();
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve remote status.',
        error: error.message,
      });
    }
  }
}

export const remoteController = new RemoteController();
