import { useState, useRef, useCallback } from 'react';

interface UseDictationProps {
  onTranscriptChange: (text: string) => void;
}

export const useDictation = ({ onTranscriptChange }: UseDictationProps) => {
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startDictation = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onresult = (event: any) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
          fullText += event.results[i][0].transcript;
        }
        if (fullText.trim()) {
          onTranscriptChange(fullText.trim());
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Dictation error:', err);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start dictation:', err);
      setIsDictating(false);
    }
  }, [onTranscriptChange]);

  const stopDictation = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsDictating(false);
  }, []);

  const toggleDictation = useCallback(() => {
    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  }, [isDictating, startDictation, stopDictation]);

  return {
    isDictating,
    startDictation,
    stopDictation,
    toggleDictation,
  };
};
