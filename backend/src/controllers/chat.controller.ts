import { Request, Response } from 'express';
import { ChatMessage } from '../models/ChatMessage';
import { CompanionLog } from '../models/CompanionLog';
import crypto from 'crypto';

export class ChatController {
  // POST /api/chat/save - Persists chat message to MySQL
  public async saveMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id, sender, text, sessionDate, tierUsed, latencyMs, tokensConsumed, tokensSaved } = req.body;
      if (!sender || !text || !sessionDate) {
        res.status(400).json({ success: false, message: 'Missing required message fields.' });
        return;
      }

      const msg = await ChatMessage.create({
        id: id || crypto.randomUUID(),
        sender,
        text,
        sessionDate,
        tierUsed,
        latencyMs: latencyMs || 0,
        tokensConsumed: tokensConsumed || 0,
        tokensSaved: tokensSaved || 0,
      });

      res.status(200).json({ success: true, data: msg });
    } catch (err: any) {
      console.warn('[ChatController] Error saving message:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/chat/session/:date - Retrieves chat messages for a date
  public async getSessionMessages(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.params;
      const messages = await ChatMessage.findAll({
        where: { sessionDate: date },
        order: [['createdAt', 'ASC']],
      });
      res.status(200).json({ success: true, data: messages });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/chat/companion-log - Persists companion voice interaction to MySQL
  public async logCompanionVoice(req: Request, res: Response): Promise<void> {
    try {
      const { userSpeech, agentReply, ownerName, tierUsed, latencyMs } = req.body;
      if (!userSpeech || !agentReply) {
        res.status(400).json({ success: false, message: 'userSpeech and agentReply required.' });
        return;
      }

      const log = await CompanionLog.create({
        id: crypto.randomUUID(),
        ownerName: ownerName || 'Omkar',
        userSpeech,
        agentReply,
        tierUsed: tierUsed || 'Voice Companion',
        latencyMs: latencyMs || 0,
      });

      res.status(200).json({ success: true, data: log });
    } catch (err: any) {
      console.warn('[ChatController] Error logging companion voice:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/chat/companion-logs - Retrieves companion voice history
  public async getCompanionLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = await CompanionLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 50,
      });
      res.status(200).json({ success: true, data: logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export const chatController = new ChatController();
