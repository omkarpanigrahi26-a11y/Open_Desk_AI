/**
 * Lightweight, zero-dependency Browser & Desktop Audio Recorder
 * Captures microphone audio, performs real-time audio visualization,
 * silence detection (VAD), and encodes directly to 16kHz 16-bit PCM WAV.
 */

export interface AudioRecorderOptions {
  onAudioLevel?: (level: number, frequencyBars: number[]) => void;
  onSpeechDetected?: () => void;
  onSilenceTimeout?: () => void;
  silenceThresholdMs?: number;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private pcmChunks: Float32Array[] = [];
  private isRecording = false;
  private hasSpoken = false;
  private silenceTimer: any = null;
  private hasAutoSubmitted = false;
  private options: AudioRecorderOptions;

  constructor(options: AudioRecorderOptions = {}) {
    this.options = {
      silenceThresholdMs: 750,
      ...options,
    };
  }

  public async start(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        // Fallback to basic audio constraint if hardware rejects specific audio processing constraints
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Universal standard for speech recognition with fallback for restrictive hardware
      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioCtx({ sampleRate: 16000 });
      } catch {
        audioCtx = new AudioCtx();
      }
      this.audioContext = audioCtx;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.5;

      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.pcmChunks = [];
      this.hasSpoken = false;
      this.hasAutoSubmitted = false;
      this.isRecording = true;

      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      let consecutiveSpeechFrames = 0;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;

        const channelData = e.inputBuffer.getChannelData(0);
        // Clone Float32 array
        this.pcmChunks.push(new Float32Array(channelData));

        // 1. Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);

        // 2. Read frequency data for waveform visualizer and speech detection
        let maxFreq = 0;
        if (this.analyserNode) {
          this.analyserNode.getByteFrequencyData(dataArray);
          const bars: number[] = [];
          const step = Math.max(1, Math.floor(dataArray.length / 10));
          for (let i = 0; i < 10; i++) {
            const val = dataArray[i * step] || 0;
            if (val > maxFreq) maxFreq = val;
            bars.push(val);
          }
          if (this.options.onAudioLevel) {
            this.options.onAudioLevel(rms, bars);
          }
        }

        // 3. Voice Activity Detection (VAD) & Silence Timeout
        // Realistic human speech thresholds: filters out quiet laptop fan / room noise (RMS < 0.01)
        const isSpeaking = rms > 0.010 || maxFreq > 28;
        if (isSpeaking) {
          consecutiveSpeechFrames++;
          if (consecutiveSpeechFrames >= 1) {
            if (!this.hasSpoken) {
              this.hasSpoken = true;
              this.options.onSpeechDetected?.();
            }
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
          }
        } else {
          consecutiveSpeechFrames = 0;
          if (this.hasSpoken && !this.silenceTimer && !this.hasAutoSubmitted) {
            // Natural silence pause threshold (750ms) so command executes automatically as soon as user stops speaking
            const threshold = this.options.silenceThresholdMs || 750;

            this.silenceTimer = setTimeout(() => {
              if (this.isRecording && this.hasSpoken && !this.hasAutoSubmitted) {
                this.hasAutoSubmitted = true;
                this.options.onSilenceTimeout?.();
              }
            }, threshold);
          }
        }

        // 4. Hard Auto-Submit Guard:
        // If user spoke and recording reaches 3.5 seconds, auto-submit automatically.
        // Guarantees task runs by its own even in noisy rooms or while media is playing.
        const totalDurationSec = (this.pcmChunks.length * 4096) / 16000;
        if (this.hasSpoken && totalDurationSec >= 3.5 && !this.hasAutoSubmitted) {
          this.hasAutoSubmitted = true;
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          this.options.onSilenceTimeout?.();
        }
      };

      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.processorNode);

      // Connect to destination through a silent gain node to prevent feedback while keeping processor active
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      this.processorNode.connect(silentGain);
      silentGain.connect(this.audioContext.destination);

      return true;
    } catch (err) {
      console.error('[AudioRecorder] Failed to start microphone capture:', err);
      this.cleanup();
      return false;
    }
  }

  public async stop(): Promise<Blob | null> {
    if (!this.isRecording) return null;
    this.isRecording = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Merge recorded PCM chunks
    const totalLength = this.pcmChunks.reduce((acc, c) => acc + c.length, 0);
    // Ignore recordings only if virtually empty (< 0.1s at 16kHz)
    if (totalLength < 1600) {
      this.cleanup();
      return null;
    }

    const mergedSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    const inputRate = this.audioContext?.sampleRate || 16000;
    const finalSamples = inputRate === 16000 ? mergedSamples : this.downsampleTo16k(mergedSamples, inputRate);
    const wavBlob = this.encodeWav(finalSamples, 16000);

    this.cleanup();
    return wavBlob;
  }

  private downsampleTo16k(samples: Float32Array, inputRate: number): Float32Array {
    if (inputRate === 16000) return samples;
    const ratio = inputRate / 16000;
    const newLength = Math.round(samples.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = Math.min(Math.round(i * ratio), samples.length - 1);
      result[i] = samples[idx];
    }
    return result;
  }

  public cancel(): void {
    this.isRecording = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.pcmChunks = [];
    this.cleanup();
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  private cleanup(): void {
    try {
      this.processorNode?.disconnect();
      this.analyserNode?.disconnect();
      this.sourceNode?.disconnect();

      this.mediaStream?.getTracks().forEach((t) => t.stop());

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => {});
      }
    } catch {
      // ignore cleanup errors
    } finally {
      this.processorNode = null;
      this.analyserNode = null;
      this.sourceNode = null;
      this.mediaStream = null;
      this.audioContext = null;
    }
  }

  /**
   * Encodes Float32 mono samples into a standard 16-bit PCM WAV Blob
   */
  private encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');

    // "fmt " sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true); // NumChannels (1 = mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // "data" sub-chunk
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write PCM 16-bit samples with clipping protection
    let byteOffset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(byteOffset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      byteOffset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }
}

/**
 * Utility helper: Converts Blob to Base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1] || '';
        resolve(base64);
      } else {
        reject(new Error('Failed to convert Blob to Base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
