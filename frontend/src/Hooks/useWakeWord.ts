import { useEffect, useRef, useState } from 'react';

interface UseWakeWordProps {
  wakePhrase: string;
  isEnabled: boolean;
  onWakeWordDetected: (command?: string) => void;
}

export const useWakeWord = ({
  wakePhrase,
  isEnabled,
  onWakeWordDetected,
}: UseWakeWordProps) => {
  const [isListeningForWake, setIsListeningForWake] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;
  const isPausedRef = useRef(!isEnabled);
  isPausedRef.current = !isEnabled;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;
    let restartTimer: any = null;

    const checkWakeMatch = (rawHeard: string) => {
      const cleanHeard = rawHeard.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawTarget = (wakePhrase || 'Hey OpenDesk').toLowerCase();
      const cleanTarget = rawTarget.replace(/[^a-z0-9]/g, '');

      const matchedCustom = cleanTarget.length > 2 && cleanHeard.includes(cleanTarget);
      const matchedAutoDesk =
        cleanHeard.includes('autodesk') ||
        cleanHeard.includes('heyautodesk') ||
        cleanHeard.includes('hiautodesk') ||
        cleanHeard.includes('autodesc') ||
        (cleanHeard.includes('auto') && (cleanHeard.includes('desk') || cleanHeard.includes('disk') || cleanHeard.includes('task')));
      const matchedSiri =
        cleanHeard.includes('heysiri') ||
        cleanHeard.includes('hisiri') ||
        cleanHeard.includes('siri');
      const matchedOpenDesk =
        cleanHeard.includes('opendesk') ||
        cleanHeard.includes('opendisk') ||
        cleanHeard.includes('opentask') ||
        cleanHeard.includes('opendest') ||
        cleanHeard.includes('openstack') ||
        cleanHeard.includes('heyopen') ||
        cleanHeard.includes('hiopen') ||
        (cleanHeard.includes('open') &&
          (cleanHeard.includes('desk') ||
            cleanHeard.includes('disk') ||
            cleanHeard.includes('task') ||
            cleanHeard.includes('dest') ||
            cleanHeard.includes('test')));

      if (matchedCustom || matchedAutoDesk || matchedSiri || matchedOpenDesk) {
        const trailingCommand = rawHeard
          .replace(/^(?:hey\s+|ok\s+|hi\s+)?(?:autodesk|opendesk|siri|open\s*desk|auto\s*desk|assistant|computer)\b[\s,.:]*/i, '')
          .replace(/^(?:please|could\s+you|can\s+you)\s+/i, '')
          .trim();
        return { matched: true, trailingCommand };
      }
      return { matched: false, trailingCommand: '' };
    };

    const isElectron = Boolean((window as any).electronAPI || navigator.userAgent.includes('Electron'));
    if (isElectron) {
      setIsListeningForWake(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsListeningForWake(false);
      return;
    }

    const setupRecognition = () => {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          if (isMounted) setIsListeningForWake(true);
        };

        recognition.onresult = (event: any) => {
          if (!isEnabledRef.current || isPausedRef.current) return;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const rawHeard = event.results[i][0].transcript;
            const check = checkWakeMatch(rawHeard);

            if (check.matched) {
              isPausedRef.current = true;
              try {
                recognition.abort();
              } catch {}
              onWakeWordDetected(check.trailingCommand);
              break;
            }
          }
        };

        recognition.onerror = (err: any) => {
          if (err.error === 'not-allowed') {
            console.warn('Microphone permission not granted for wake listener.');
            return;
          }
          if (err.error === 'network' || err.error === 'service-not-allowed') {
            try {
              recognition.abort();
            } catch {}
            recognitionRef.current = null;
            setIsListeningForWake(false);
            return;
          }
          if (isMounted && isEnabledRef.current && !isPausedRef.current && err.error !== 'aborted') {
            clearTimeout(restartTimer);
            restartTimer = setTimeout(() => {
              if (isMounted && isEnabledRef.current && !isPausedRef.current) {
                setupRecognition();
              }
            }, 600);
          }
        };

        recognition.onend = () => {
          if (isMounted) setIsListeningForWake(false);
          if (isMounted && isEnabledRef.current && !isPausedRef.current) {
            clearTimeout(restartTimer);
            restartTimer = setTimeout(() => {
              if (isMounted && isEnabledRef.current && !isPausedRef.current) {
                setupRecognition();
              }
            }, 300);
          }
        };

        recognitionRef.current = recognition;

        if (isEnabled && !isPausedRef.current) {
          recognition.start();
        }
      } catch (e) {
        console.warn('Wake word setup error:', e);
        setIsListeningForWake(false);
      }
    };

    setupRecognition();

    return () => {
      isMounted = false;
      clearTimeout(restartTimer);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [wakePhrase, isEnabled, onWakeWordDetected]);

  return { isListeningForWake };
};
