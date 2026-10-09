import { Router, Request, Response } from 'express';
import { transcribeService } from '../services/voice/transcribe.service';

const router = Router();

/**
 * POST /api/voice/transcribe
 * Accepts JSON with { audioBase64: string, mimeType?: string }
 * or raw audio
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, apiKey, provider } = req.body;

    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        message: 'Missing audioBase64 parameter',
      });
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Empty audio buffer',
      });
    }

    const result = await transcribeService.transcribe(
      buffer,
      mimeType || 'audio/wav',
      apiKey,
      provider
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[Voice Routes] Transcription error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to transcribe audio',
    });
  }
});

export default router;
