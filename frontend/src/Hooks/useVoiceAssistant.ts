import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../Services/apiClient';
import { AudioRecorder, blobToBase64 } from '../Services/audioRecorder';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    electronAPI?: any;
  }
}

interface UseVoiceAssistantProps {
  onSpeechFinal?: (transcript: string) => void;
}

const VOICE_SETTINGS_KEY = 'opendesk_voice_settings';

export const useVoiceAssistant = ({ onSpeechFinal }: UseVoiceAssistantProps = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioBars, setAudioBars] = useState<number[]>([12, 16, 22, 26, 28, 26, 22, 16, 14, 12]);

  // Detect whether we are running in Desktop Electron environment
  const isElectron =
    typeof window !== 'undefined' &&
    Boolean(window.electronAPI || navigator.userAgent.includes('Electron'));

  // Stored voice settings
  const [voiceSettings, setVoiceSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fallback
    }
    return {
      voiceEnabled: true,
      voiceName: '',
      rate: 1.0,
      pitch: 1.0,
    };
  });

  const recognitionRef = useRef<any>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const onSpeechFinalRef = useRef(onSpeechFinal);
  onSpeechFinalRef.current = onSpeechFinal;

  const shouldListenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const deliberateAbortRef = useRef(false);
  const isTranscribingRef = useRef(false);

  // Initialize Speech Synthesis Voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Save voice settings on update
  useEffect(() => {
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(voiceSettings));
    } catch {
      // ignore
    }
  }, [voiceSettings]);

  /**
   * Finalizes recorded audio buffer, transcribes via backend, and executes speech
   */
  const processAndTranscribeAudio = useCallback(async () => {
    if (isTranscribingRef.current) return;
    isTranscribingRef.current = true;
    setIsProcessing(true);
    isProcessingRef.current = true;
    setIsListening(false);

    try {
      const blob = await audioRecorderRef.current?.stop();
      if (!blob || blob.size < 1000) {
        // Nothing recorded or empty audio
        isTranscribingRef.current = false;
        setIsProcessing(false);
        isProcessingRef.current = false;
        if (shouldListenRef.current && !isSpeakingRef.current) {
          startListening();
        }
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

      const base64Audio = await blobToBase64(blob);
      const res = await apiClient.transcribeAudio(base64Audio, 'audio/wav', apiKey, aiProvider);

      let recognizedText = res.data?.text?.trim() || '';

      // Acoustic and phonetic normalization on the recognized transcript
      if (recognizedText) {
        // 1. Deduplicate consecutive repeated words (e.g. "Helllo, hello", "Toppr Toppr")
        recognizedText = recognizedText.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
        recognizedText = recognizedText.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
        // 2. Normalize "Helllo" -> "hello"
        recognizedText = recognizedText.replace(/\bhell+o\b/gi, 'hello');
        // 3. Fix acoustic mistranscriptions of "YouTube"
        recognizedText = recognizedText.replace(
          /\b(?:open|launch|play|visit|start|go\s+to)\s+(?:the\s+|my\s+|your\s+)?(?:tube|toppr|topper|took\s*took)\b/gi,
          'open youtube'
        );
        recognizedText = recognizedText.replace(
          /\b(?:open|launch|play|visit|start|go\s+to)\s+(?:you\s+tube|your\s+tube|you\s+took)\b/gi,
          'open youtube'
        );
        recognizedText = recognizedText.replace(/\b(?:your\s+tube|you\s+tube|you\s+took)\b/gi, 'youtube');
        recognizedText = recognizedText.replace(/\btoppr\s+toppr\b/gi, 'youtube');
      }

      if (recognizedText) {
        setTranscript(recognizedText);
        if (onSpeechFinalRef.current) {
          onSpeechFinalRef.current(recognizedText);
        }
      } else {
        setTranscript('');
        if (shouldListenRef.current && !isSpeakingRef.current) {
          startListening();
        }
      }
    } catch (err) {
      console.warn('[Voice Assistant] Audio transcription failed:', err);
      setTranscript('');
      if (shouldListenRef.current && !isSpeakingRef.current) {
        startListening();
      }
    } finally {
      isTranscribingRef.current = false;
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Launch audio recording engine (used for Desktop Electron and robust fallback)
  const startAudioRecorder = useCallback(async () => {
    // If speaking or processing flags got stuck, clear them to allow recording
    if (isSpeakingRef.current) {
      if (!window.speechSynthesis || !window.speechSynthesis.speaking) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      } else {
        return;
      }
    }
    if (isTranscribingRef.current) return;

    // Always create a fresh recorder instance to avoid dead audio contexts
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancel();
      audioRecorderRef.current = null;
    }

    const recorder = new AudioRecorder({
      silenceThresholdMs: 750,
      onAudioLevel: (_rms, bars) => {
        // Scale bars between 12 and 65 for VoiceModal visualizer
        setAudioBars(bars.map((b) => Math.max(12, Math.min(65, Math.round(b * 0.28 + 12)))));
      },
      onSpeechDetected: () => {
        setTranscript((prev) => prev || 'Listening...');
      },
      onSilenceTimeout: () => {
        processAndTranscribeAudio();
      },
    });
    audioRecorderRef.current = recorder;

    const success = await recorder.start();
    if (success) {
      setIsListening(true);
      setSpeechSupported(true);
    } else {
      setIsListening(false);
    }
  }, [processAndTranscribeAudio]);

  // Continuous Recognition Engine - uses AudioRecorder on Desktop Electron,
  // or Web Speech API in browser with automatic fallback
  const launchRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!shouldListenRef.current || isProcessingRef.current) return;

    // Ensure speaking flags don't falsely block recognition
    if (isSpeakingRef.current && (!window.speechSynthesis || !window.speechSynthesis.speaking)) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
    if (isSpeakingRef.current) return;

    // In Desktop Electron: webkitSpeechRecognition is not connected to Google's cloud servers.
    // Use the native AudioRecorder + transcription engine to eliminate buffering completely!
    if (isElectron) {
      startAudioRecorder();
      return;
    }

    // In standard web browser: attempt Web Speech API first
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      startAudioRecorder();
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = window.navigator?.language || 'en-US';

      recognition.onstart = () => {
        deliberateAbortRef.current = false;
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const part = event.results[i][0].transcript.trim();
          if (part) {
            currentTranscript += (currentTranscript ? ' ' : '') + part;
          }
        }
        setTranscript(currentTranscript);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        // Allow a snappy natural 850ms conversational pause before submitting
        silenceTimerRef.current = setTimeout(() => {
          if (currentTranscript.trim()) {
            const captured = currentTranscript.trim();
            setTranscript('');
            deliberateAbortRef.current = true;
            isProcessingRef.current = true;
            setIsProcessing(true);
            if (recognitionRef.current) {
              try {
                recognitionRef.current.abort();
              } catch {}
              recognitionRef.current = null;
            }
            setIsListening(false);
            if (onSpeechFinalRef.current) {
              onSpeechFinalRef.current(captured);
            }
          }
        }, 850);
      };

      recognition.onerror = (err: any) => {
        if (err.error === 'no-speech' || err.error === 'aborted') return;
        console.warn('[Voice Assistant] Web Speech error, falling back to AudioRecorder:', err);
        // Switch to native AudioRecorder on network or compatibility errors
        try {
          recognition.abort();
        } catch {}
        recognitionRef.current = null;
        startAudioRecorder();
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        if (deliberateAbortRef.current || isProcessingRef.current || isSpeakingRef.current) {
          deliberateAbortRef.current = false;
          setIsListening(false);
          return;
        }
        if (shouldListenRef.current) {
          setTimeout(() => {
            if (shouldListenRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
              launchRecognition();
            }
          }, 300);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      startAudioRecorder();
    }
  }, [isElectron, startAudioRecorder]);

  const startListening = useCallback(() => {
    shouldListenRef.current = true;
    deliberateAbortRef.current = false;
    isProcessingRef.current = false;
    setIsProcessing(false);
    isSpeakingRef.current = false;
    setIsSpeaking(false);

    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setTranscript('');
    launchRecognition();
  }, [launchRecognition]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    isProcessingRef.current = false;
    deliberateAbortRef.current = true;
    setIsProcessing(false);

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

    if (audioRecorderRef.current?.getIsRecording()) {
      audioRecorderRef.current.stop().then((blob) => {
        if (blob && blob.size > 1000) {
          blobToBase64(blob).then((b64) => {
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
            apiClient.transcribeAudio(b64, 'audio/wav', apiKey, aiProvider).then((res) => {
              let text = res.data?.text?.trim() || '';
              if (text) {
                text = text.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
                text = text.replace(/\bhell+o\b/gi, 'hello');
                text = text.replace(/\b(?:open|launch|play|visit|start|go\s+to)\s+(?:the\s+|my\s+|your\s+)?(?:tube|toppr|topper|took\s*took)\b/gi, 'open youtube');
                text = text.replace(/\b(?:open|launch|play|visit|start|go\s+to)\s+(?:you\s+tube|your\s+tube|you\s+took)\b/gi, 'open youtube');
                text = text.replace(/\b(?:your\s+tube|you\s+tube|you\s+took)\b/gi, 'youtube');
              }
              if (text && onSpeechFinalRef.current) {
                setTranscript(text);
                onSpeechFinalRef.current(text);
              }
            }).catch(() => {});
          });
        }
      });
    }

    setIsListening(false);
    setTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      // If currently listening, process what has been spoken so far
      if (audioRecorderRef.current?.getIsRecording()) {
        processAndTranscribeAudio();
      } else {
        stopListening();
        if (transcript.trim() && onSpeechFinalRef.current) {
          onSpeechFinalRef.current(transcript.trim());
        }
      }
    } else {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      startListening();
    }
  }, [isListening, processAndTranscribeAudio, stopListening, startListening, transcript]);

  // Voice Output (Text-to-Speech)
  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      isProcessingRef.current = false;
      setIsProcessing(false);

      if (typeof window === 'undefined' || !window.speechSynthesis) {
        if (shouldListenRef.current) {
          setTimeout(() => launchRecognition(), 300);
        }
        if (onEnd) onEnd();
        return;
      }

      if (voiceSettings?.voiceEnabled === false) {
        if (shouldListenRef.current) {
          setTimeout(() => launchRecognition(), 300);
        }
        if (onEnd) onEnd();
        return;
      }

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        // Clean out markdown symbols and URLs before vocalizing
        const cleanText = text
          .replace(/[#*_`~[\]]/g, '')
          .replace(/\(http[^)]+\)/g, '')
          .replace(/\n+/g, '. ')
          .slice(0, 300);

        if (!cleanText.trim()) {
          if (shouldListenRef.current) {
            setTimeout(() => launchRecognition(), 300);
          }
          if (onEnd) onEnd();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        activeUtteranceRef.current = utterance;
        utterance.lang = 'en-US';
        utterance.volume = 1.0;
        utterance.rate = voiceSettings?.rate || 1.0;
        utterance.pitch = voiceSettings?.pitch || 1.0;

        const allVoices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
        if (voiceSettings?.voiceName && allVoices.length > 0) {
          const matched = allVoices.find((v) => v.name === voiceSettings.voiceName);
          if (matched) utterance.voice = matched;
        } else if (allVoices.length > 0) {
          const enVoice =
            allVoices.find(
              (v) =>
                v.lang.startsWith('en') &&
                (v.name.includes('Natural') ||
                  v.name.includes('Google') ||
                  v.name.includes('David') ||
                  v.name.includes('Zira') ||
                  v.name.includes('Jenny') ||
                  v.name.includes('Mark'))
            ) || allVoices.find((v) => v.lang.startsWith('en')) || allVoices[0];
          if (enVoice) utterance.voice = enVoice;
        }

        deliberateAbortRef.current = true;
        isSpeakingRef.current = true;
        setIsSpeaking(true);

        if (audioRecorderRef.current?.getIsRecording()) {
          audioRecorderRef.current.cancel();
        }
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
          recognitionRef.current = null;
        }
        setIsListening(false);

        let safetyTimer: any = null;
        const handleFinishSpeech = () => {
          if (safetyTimer) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
          }
          activeUtteranceRef.current = null;
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          deliberateAbortRef.current = false;
          setTranscript('');
          if (shouldListenRef.current) {
            setTimeout(() => launchRecognition(), 300);
          }
          if (onEnd) onEnd();
        };

        // Safety watchdog: ensure assistant never stays permanently stuck in isSpeaking if Chromium drops onend
        const maxDuration = Math.max(3000, cleanText.length * 90);
        safetyTimer = setTimeout(() => {
          handleFinishSpeech();
        }, maxDuration);

        utterance.onstart = () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        };
        utterance.onend = handleFinishSpeech;
        utterance.onerror = (err) => {
          console.warn('[Speech Synthesis] Utterance error:', err);
          handleFinishSpeech();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[Speech Synthesis] Speak error:', err);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (shouldListenRef.current) {
          setTimeout(() => launchRecognition(), 300);
        }
        if (onEnd) onEnd();
      }
    },
    [availableVoices, launchRecognition, voiceSettings]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      if (shouldListenRef.current) {
        setTimeout(() => launchRecognition(), 300);
      }
    }
  }, [launchRecognition]);

  const updateVoiceSettings = (newSettings: Partial<typeof voiceSettings>) => {
    setVoiceSettings((prev: any) => ({ ...prev, ...newSettings }));
  };

  return {
    isListening,
    isSpeaking,
    isProcessing,
    setIsProcessing,
    transcript,
    speechSupported,
    availableVoices,
    audioBars,
    voiceSettings,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    updateVoiceSettings,
  };
};
