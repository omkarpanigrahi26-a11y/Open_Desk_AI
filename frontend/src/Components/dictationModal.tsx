import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Mic, Loader2 } from 'lucide-react';
import { AudioRecorder, blobToBase64 } from '../Services/audioRecorder';
import { apiClient } from '../Services/apiClient';

interface DictationModalProps {
  isOpen: boolean;
  onComplete: (transcript: string) => void;
  onClose: () => void;
}

export const DictationModal: React.FC<DictationModalProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [micError, setMicError] = useState(false);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const shouldBeActiveRef = useRef(false);
  const isSubmittedRef = useRef(false);
  const transcriptRef = useRef('');
  transcriptRef.current = transcript;

  const isElectron =
    typeof window !== 'undefined' &&
    Boolean((window as any).electronAPI || navigator.userAgent.includes('Electron'));

  const finishAndTranscribeAudio = useCallback(async () => {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;
    shouldBeActiveRef.current = false;
    setIsListening(false);
    setIsProcessing(true);

    try {
      const blob = await audioRecorderRef.current?.stop();
      if (!blob || blob.size < 1000) {
        setIsProcessing(false);
        onClose();
        return;
      }

      // Read stored user profile credentials if available
      let apiKey = '';
      let aiProvider = '';
      try {
        const rawProfile = localStorage.getItem('opendesk_user_profile');
        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          apiKey = parsed.apiKey || '';
          aiProvider = parsed.aiProvider || '';
        }
      } catch {}

      setTranscript('Processing your voice command...');
      const base64Audio = await blobToBase64(blob);
      const res = await apiClient.transcribeAudio(base64Audio, 'audio/wav', apiKey, aiProvider);
      let text = res.data?.text?.trim() || '';

      if (text) {
        text = text.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
        text = text.replace(/\bhell+o\b/gi, 'hello');
        text = text.replace(/\byputube\b/gi, 'youtube');
        text = text.replace(/\brearch\b/gi, 'search');
        text = text.replace(
          /\b(?:open|launch|play|visit|start|go\s+to)\s+(?:the\s+|my\s+|your\s+)?(?:tube|toppr|topper|took\s*took)\b/gi,
          'open youtube'
        );
        text = text.replace(
          /\b(?:open|launch|play|visit|start|go\s+to)\s+(?:you\s+tube|your\s+tube|you\s+took)\b/gi,
          'open youtube'
        );
        text = text.replace(/\b(?:your\s+tube|you\s+tube|you\s+took)\b/gi, 'youtube');
        text = text.replace(/\btoppr\s+toppr\b/gi, 'youtube');
      }

      setIsProcessing(false);
      if (text) {
        onComplete(text);
      } else {
        onClose();
      }
    } catch (err) {
      console.warn('[Dictation] Transcription failed:', err);
      setIsProcessing(false);
      onClose();
    }
  }, [onComplete, onClose]);

  const handleFinishAndSubmit = useCallback(() => {
    if (audioRecorderRef.current?.getIsRecording()) {
      finishAndTranscribeAudio();
      return;
    }

    isSubmittedRef.current = true;
    shouldBeActiveRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    const finalSpeech = transcriptRef.current.trim();
    if (finalSpeech) {
      onComplete(finalSpeech);
    } else {
      onClose();
    }
  }, [finishAndTranscribeAudio, onComplete, onClose]);

  useEffect(() => {
    if (!isOpen) {
      isSubmittedRef.current = false;
      shouldBeActiveRef.current = false;
      if (audioRecorderRef.current?.getIsRecording()) {
        audioRecorderRef.current.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setTranscript('');
      setIsListening(false);
      setIsProcessing(false);
      setMicError(false);
      return;
    }

    isSubmittedRef.current = false;
    shouldBeActiveRef.current = true;
    setTranscript('');
    setIsListening(false);
    setIsProcessing(false);
    setMicError(false);

    // In Desktop Electron: use the native AudioRecorder + backend STT
    if (isElectron) {
      const recorder = new AudioRecorder({
        silenceThresholdMs: 750,
        onSpeechDetected: () => {
          setTranscript('Listening...');
        },
        onSilenceTimeout: () => {
          finishAndTranscribeAudio();
        },
      });
      audioRecorderRef.current = recorder;

      recorder.start().then((started) => {
        if (started) {
          setIsListening(true);
        } else {
          setMicError(true);
        }
      });

      return () => {
        recorder.cancel();
      };
    }

    // In standard browser: attempt Web Speech API
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      // Fallback to AudioRecorder
      const recorder = new AudioRecorder({
        silenceThresholdMs: 750,
        onSpeechDetected: () => setTranscript('Listening...'),
        onSilenceTimeout: () => finishAndTranscribeAudio(),
      });
      audioRecorderRef.current = recorder;
      recorder.start().then((started) => {
        if (started) setIsListening(true);
        else setMicError(true);
      });
      return () => {
        recorder.cancel();
      };
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = window.navigator?.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(false);
      };

      recognition.onresult = (event: any) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript?.trim() || '';
          if (piece) {
            fullText += (fullText ? ' ' : '') + piece;
          }
        }

        if (fullText) {
          setTranscript(fullText);
        }

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        silenceTimerRef.current = setTimeout(() => {
          handleFinishAndSubmit();
        }, 850);
      };

      recognition.onerror = () => {
        // Fallback to AudioRecorder on error
        try {
          recognition.abort();
        } catch {}
        recognitionRef.current = null;

        const recorder = new AudioRecorder({
          silenceThresholdMs: 750,
          onSpeechDetected: () => setTranscript('Listening...'),
          onSilenceTimeout: () => finishAndTranscribeAudio(),
        });
        audioRecorderRef.current = recorder;
        recorder.start().then((started) => {
          if (started) setIsListening(true);
          else setMicError(true);
        });
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setMicError(true);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [isOpen, finishAndTranscribeAudio, handleFinishAndSubmit, isElectron]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="w-full max-w-2xl bg-[#1e2023] border border-slate-700/60 rounded-3xl shadow-2xl p-10 relative overflow-hidden font-sans flex items-center justify-between">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
          title="Close voice search (Escape)"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 pr-8">
          {micError ? (
            <div className="space-y-1">
              <h2 className="text-2xl text-slate-200 font-light tracking-wide">
                Please check your microphone permissions.
              </h2>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-3xl text-slate-100 font-light tracking-wide leading-snug break-words">
                {isProcessing
                  ? 'Processing audio...'
                  : transcript || (isListening ? 'Listening...' : 'Ready...')}
              </h2>
              {isProcessing ? (
                <p className="text-xs font-mono text-amber-400 flex items-center space-x-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Transcribing speech on desktop...</span>
                </p>
              ) : transcript ? (
                <p className="text-xs font-mono text-slate-400">
                  Auto-submits on pause · or click mic to send now
                </p>
              ) : (
                <p className="text-xs font-mono text-slate-500">
                  Speak your question or command clearly into your mic...
                </p>
              )}
            </div>
          )}
        </div>

        <div className="relative flex-shrink-0 flex items-center justify-center">
          <div
            className={`absolute w-36 h-36 rounded-full border transition-all duration-300 pointer-events-none ${
              isListening
                ? 'border-red-500/50 scale-110 animate-ping'
                : 'border-slate-700/40 scale-100'
            }`}
          />

          <button
            onClick={handleFinishAndSubmit}
            disabled={isProcessing}
            className={`w-28 h-28 rounded-full border flex items-center justify-center transition-all duration-300 shadow-2xl ${
              isProcessing
                ? 'bg-amber-600/90 text-white border-amber-500 shadow-amber-600/30'
                : isListening
                ? 'bg-red-600/90 text-white border-red-500 shadow-red-600/30'
                : 'bg-transparent text-slate-200 border-slate-600/70 hover:border-slate-400'
            }`}
            title={transcript.trim() ? 'Click to send now' : 'Click to send or close'}
          >
            {isProcessing ? (
              <Loader2 className="w-12 h-12 animate-spin" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
