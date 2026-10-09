import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import dotenv from 'dotenv';

// Ensure environment variables are loaded regardless of process spawn or directory context
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface TranscribeResult {
  success: boolean;
  text: string;
  provider: string;
  latencyMs: number;
}

export class TranscribeService {
  /**
   * Normalizes stuttered repetitions, punctuation glitches, and common phonetic mistranscriptions
   * (e.g. "Helllo, hello, open your Toppr Toppr" -> "open youtube")
   */
  public normalizePhoneticText(text: string): string {
    if (!text) return '';
    let t = text.trim();

    // 1. Deduplicate consecutive repeated words (e.g. "Helllo, hello" -> "hello", "Toppr Toppr" -> "Toppr")
    t = t.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
    t = t.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');

    // 2. Normalize "Helllo" / "helllllo" -> "hello"
    t = t.replace(/\bhell+o\b/gi, 'hello');

    // 3. Fix acoustic mistranscriptions of "YouTube"
    // e.g. "open your tube", "open you tube", "open you took", "open you to the", "open your toppr", "open toppr"
    t = t.replace(/\b(?:open|launch|play|visit|start|go\s+to)\s+(?:the\s+|my\s+|your\s+)?(?:tube|toppr|topper|took\s*took)\b/gi, 'open youtube');
    t = t.replace(/\b(?:open|launch|play|visit|start|go\s+to)\s+(?:you\s+tube|your\s+tube|you\s+took|you\s+to\s+the|you\s+to|you\s+two)\b/gi, 'open youtube');
    t = t.replace(/\b(?:your\s+tube|you\s+tube|you\s+took|you\s+to\s+the)\b/gi, 'youtube');
    t = t.replace(/\btoppr\s+toppr\b/gi, 'youtube');
    t = t.replace(/\bopen\s+open\b/gi, 'open');

    return t.trim();
  }

  /**
   * Transcribes speech audio buffer into text.
   * Hierarchical fallback:
   * 1. Groq Whisper (ultra fast cloud)
   * 2. Google Gemini (cloud - multimodal free tier)
   * 3. OpenAI Whisper (cloud)
   * 4. Windows Native Speech Recognizer (System.Speech - offline fallback with command grammar)
   */
  private static openAiQuotaExceeded = false;

  public async transcribe(
    audioBuffer: Buffer,
    mimeType = 'audio/wav',
    clientApiKey?: string,
    clientProvider?: string
  ): Promise<TranscribeResult> {
    const startTime = performance.now();

    // 1. Try Groq Whisper if key exists (fastest - ~200ms)
    const groqKey =
      (clientProvider === 'groq' ? clientApiKey : null) ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : null) ||
      process.env.GROQ_API_KEY?.trim();

    if (groqKey) {
      try {
        const text = await this.tryGroqWhisper(audioBuffer, groqKey, mimeType);
        if (text) {
          const normalized = this.normalizePhoneticText(text);
          return {
            success: true,
            text: normalized,
            provider: 'Groq Whisper',
            latencyMs: Math.round(performance.now() - startTime),
          };
        }
      } catch (err) {
        console.warn('[STT] Groq Whisper failed, trying next provider:', err);
      }
    }

    // 2. Try Google Gemini with high-speed models (gemini-3.1-flash-lite ~1.9s)
    const geminiKey =
      (clientProvider === 'gemini' ? clientApiKey : null) ||
      (clientApiKey?.startsWith('AIza') ? clientApiKey : null) ||
      process.env.GEMINI_API_KEY?.trim();

    if (geminiKey) {
      try {
        const text = await this.tryGeminiAudio(audioBuffer, geminiKey, mimeType);
        if (text) {
          const normalized = this.normalizePhoneticText(text);
          if (normalized) {
            return {
              success: true,
              text: normalized,
              provider: 'Google Gemini',
              latencyMs: Math.round(performance.now() - startTime),
            };
          }
        }
      } catch (err: any) {
        console.warn('[STT] Gemini Audio failed, continuing to fallback:', err?.message || err);
      }
    }

    // 3. Try OpenAI Whisper if key exists and has quota remaining
    const openaiKey =
      !TranscribeService.openAiQuotaExceeded &&
      ((clientProvider === 'openai' ? clientApiKey : null) ||
        (clientApiKey?.startsWith('sk-') ? clientApiKey : null) ||
        (process.env.OPENAI_API_KEY || process.env.CLOUD_LLM_API_KEY)?.trim());

    if (openaiKey) {
      try {
        const text = await this.tryOpenAIWhisper(audioBuffer, openaiKey, mimeType);
        if (text) {
          const normalized = this.normalizePhoneticText(text);
          return {
            success: true,
            text: normalized,
            provider: 'OpenAI Whisper',
            latencyMs: Math.round(performance.now() - startTime),
          };
        }
      } catch (err: any) {
        if (err?.message?.includes('429') || err?.message?.includes('quota')) {
          TranscribeService.openAiQuotaExceeded = true;
        }
        console.warn('[STT] OpenAI Whisper skipped (quota or error):', err?.message || err);
      }
    }

    // 4. Windows Native Offline Speech Recognizer (with desktop command grammar)
    if (process.platform === 'win32') {
      try {
        const text = await this.tryWindowsNativeSpeech(audioBuffer);
        if (text) {
          const normalized = this.normalizePhoneticText(text);
          if (normalized) {
            return {
              success: true,
              text: normalized,
              provider: 'Windows Native SAPI',
              latencyMs: Math.round(performance.now() - startTime),
            };
          }
        }
      } catch (err: any) {
        console.warn('[STT] Windows Native Speech failed:', err?.message || err);
      }
    }

    return {
      success: false,
      text: '',
      provider: 'None',
      latencyMs: Math.round(performance.now() - startTime),
    };
  }

  private async tryGroqWhisper(buffer: Buffer, apiKey: string, mimeType: string): Promise<string | null> {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-large-v3-turbo');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data.text?.trim() || null;
  }

  private async tryOpenAIWhisper(buffer: Buffer, apiKey: string, mimeType: string): Promise<string | null> {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Whisper HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    return data.text?.trim() || null;
  }

  private async tryGeminiAudio(buffer: Buffer, apiKey: string, mimeType: string): Promise<string | null> {
    const base64Audio = buffer.toString('base64');
    const audioMime = mimeType.includes('wav') ? 'audio/wav' : mimeType.includes('mp3') ? 'audio/mp3' : 'audio/webm';

    // Benchmark-verified fastest Gemini models for audio transcription (~2.2s response)
    const modelsToTry = [
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
    ];

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: audioMime,
                      data: base64Audio,
                    },
                  },
                  {
                    text: 'Transcribe the spoken audio exactly as heard. Output ONLY the raw transcribed text. Do not add quotes, punctuation explanations, timestamps, or notes. If no words or only silence/background noise is heard, output EMPTY_AUDIO.',
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.0,
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[STT] Gemini model ${model} HTTP ${res.status}:`, errText.slice(0, 120));
          continue; // try next candidate model
        }

        const data = (await res.json()) as any;
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        // Clean markdown backticks, timestamps ([00:00] or 00:00:), and surrounding quotes
        let cleaned = candidate
          .replace(/```[a-z]*\s*([\s\S]*?)\s*```/gi, '$1')
          .replace(/^\[?\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?\]?\s*:?\s*/g, '')
          .replace(/^["']|["']$/g, '')
          .trim();

        // Ignore silence, timestamps, digit noise, or non-speech markers
        const isNonSpeech =
          !cleaned ||
          cleaned.toUpperCase() === 'EMPTY_AUDIO' ||
          cleaned.toUpperCase() === 'SILENCE' ||
          cleaned.toLowerCase() === 'none' ||
          !/[a-zA-Z0-9]/.test(cleaned) ||
          /^(?:\[|\()?\s*00:\d\d(?:\s*-\s*00:\d\d)?\s*(?:\]|\))?$/.test(cleaned) ||
          (cleaned.startsWith('[') && cleaned.endsWith(']'));

        if (isNonSpeech) {
          return null;
        }

        return cleaned;
      } catch (err: any) {
        console.warn(`[STT] Gemini model ${model} failed:`, err.message);
      }
    }

    return null;
  }

  private tryWindowsNativeSpeech(buffer: Buffer): Promise<string | null> {
    return new Promise((resolve) => {
      const tempId = `opendesk_stt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.wav`;
      const tempPath = path.join(os.tmpdir(), tempId);

      try {
        fs.writeFileSync(tempPath, buffer);
      } catch (writeErr) {
        console.error('[STT] Failed to write temp wav:', writeErr);
        return resolve(null);
      }

      const escapedPath = tempPath.replace(/\\/g, '\\\\');
      // System.Speech: Prioritize command vocabulary grammar to recognize desktop actions accurately
      const psScript = `
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine

$verbs = New-Object System.Speech.Recognition.Choices
$verbs.Add(@('open', 'launch', 'start', 'play', 'close', 'scroll down', 'scroll up', 'stop', 'mute', 'unmute', 'screenshot'))

$targets = New-Object System.Speech.Recognition.Choices
$targets.Add(@('youtube', 'google', 'chrome', 'spotify', 'calculator', 'notepad', 'settings', 'browser', 'task manager', 'file explorer', 'whatsapp', 'desktop', 'screen'))

$builder = New-Object System.Speech.Recognition.GrammarBuilder
$builder.Append($verbs)
$builder.Append($targets)
$cmdGrammar = New-Object System.Speech.Recognition.Grammar($builder)
$dictGrammar = New-Object System.Speech.Recognition.DictationGrammar

$engine.LoadGrammar($cmdGrammar)
$engine.LoadGrammar($dictGrammar)
$engine.SetInputToWaveFile('${escapedPath}')
$result = $engine.Recognize()
if ($result -and $result.Confidence -ge 0.15) {
    $t = $result.Text.Trim()
    if ($t -and $t -notmatch '(?i)\\b(havel|what have|took took|open open)\\b') {
        Write-Output $t
    }
}
$engine.Dispose()
`;

      execFile(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
        { timeout: 15000 },
        (err, stdout) => {
          // Clean up temp audio file
          try {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
          } catch {}

          if (err) {
            console.warn('[STT] Windows speech exec error:', err.message);
            return resolve(null);
          }

          const recognized = stdout.trim();
          resolve(recognized || null);
        }
      );
    });
  }
}

export const transcribeService = new TranscribeService();

