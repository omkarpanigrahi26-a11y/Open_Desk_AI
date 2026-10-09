import React, { useEffect, useState } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CornerDownLeft,
  Activity,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  ownerName: string;
  wakeGreeting: string;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing?: boolean;
  activePrompt?: string;
  transcript: string;
  companionReply?: string;
  voiceEnabled: boolean;
  waveBars?: number[];
  onToggleListening: () => void;
  onToggleVoiceOutput: () => void;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  ownerName,
  wakeGreeting,
  isListening,
  isSpeaking,
  isProcessing = false,
  activePrompt = '',
  transcript,
  companionReply,
  voiceEnabled,
  waveBars,
  onToggleListening,
  onToggleVoiceOutput,
  onSubmit,
  onClose,
}) => {
  // Resting wave heights when mic is open in silence (calm, breathing state)
  const restingHeights = [12, 16, 22, 26, 28, 26, 22, 16, 14, 12];
  const [waveHeights, setWaveHeights] = useState<number[]>(restingHeights);

  // Auto-engage listening whenever VoiceModal opens if idle
  useEffect(() => {
    if (isOpen && !isListening && !isSpeaking && !isProcessing) {
      const timer = setTimeout(() => {
        onToggleListening();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Dynamic wave bar animation responsive to REAL activity
  useEffect(() => {
    if (!isOpen) return;

    // 1. Assistant is speaking vocal response
    if (isSpeaking) {
      const interval = setInterval(() => {
        setWaveHeights((prev) =>
          prev.map(() => Math.floor(Math.random() * 55) + 35)
        );
      }, 100);
      return () => clearInterval(interval);
    }

    // 2. Processing PC action / AI thinking
    if (isProcessing) {
      let step = 0;
      const interval = setInterval(() => {
        step += 0.35;
        setWaveHeights(
          restingHeights.map((_, i) =>
            Math.round(Math.sin(step + i * 0.6) * 20 + 35)
          )
        );
      }, 80);
      return () => clearInterval(interval);
    }

    // 3. User is actively speaking into mic with live audio levels
    if (isListening && waveBars && waveBars.length === 10) {
      setWaveHeights(waveBars);
      return;
    }

    // 4. User is actively speaking into mic fallback
    if (isListening && transcript.trim()) {
      const interval = setInterval(() => {
        setWaveHeights((prev) =>
          prev.map(() => Math.floor(Math.random() * 60) + 30)
        );
      }, 110);
      return () => clearInterval(interval);
    }

    // 5. Listening in silence (waiting for speech) -> gentle calm breathing
    if (isListening) {
      let step = 0;
      const interval = setInterval(() => {
        step += 0.15;
        setWaveHeights(
          restingHeights.map((base, i) =>
            Math.round(base + Math.sin(step + i * 0.5) * 6)
          )
        );
      }, 180);
      return () => clearInterval(interval);
    }

    // 6. Idle / Stopped
    setWaveHeights(restingHeights.map(() => 10));
  }, [isOpen, isListening, isSpeaking, isProcessing, transcript, waveBars]);

  if (!isOpen) return null;

  const handleManualSubmit = () => {
    if (transcript.trim()) {
      onSubmit(transcript.trim());
    } else if (isListening) {
      onToggleListening();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="w-full max-w-xl bg-panel border border-border-subtle rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center space-y-6 relative overflow-hidden font-sans">
        {/* Subtle Ambient Radial Glow */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
            isProcessing
              ? 'bg-amber-500/15'
              : isSpeaking
              ? 'bg-indigo-600/15'
              : isListening
              ? 'bg-rose-500/15'
              : 'bg-indigo-600/10'
          }`}
        />

        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isProcessing
                  ? 'bg-amber-400 animate-pulse'
                  : isSpeaking
                  ? 'bg-indigo-400 animate-pulse'
                  : isListening
                  ? 'bg-red-400 animate-ping'
                  : 'bg-emerald-400'
              }`}
            />
            <span>
              {isProcessing
                ? 'Executing task on your PC...'
                : isSpeaking
                ? 'Speaking response...'
                : isListening
                ? 'Listening to microphone'
                : 'Voice Assistant Ready'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Vocal Output Toggle */}
            <button
              onClick={onToggleVoiceOutput}
              className={`p-2 rounded-xl border transition-colors ${
                voiceEnabled
                  ? 'bg-panel-elevated text-indigo-400 border-indigo-500/40 shadow-sm'
                  : 'bg-canvas text-slate-500 border-border-subtle'
              }`}
              title={voiceEnabled ? 'Vocal replies enabled' : 'Vocal replies muted'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-canvas text-slate-400 hover:text-slate-100 hover:bg-panel-elevated border border-border-subtle transition-colors"
              title="Close Voice Assistant (Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Central Siri-Style Orb & Microphone */}
        <div className="relative flex flex-col items-center justify-center my-4 z-10">
          {/* Animated Pulsing Outer Ring */}
          <div
            className={`absolute w-36 h-36 rounded-full border transition-all duration-500 pointer-events-none ${
              isProcessing
                ? 'border-amber-500/40 scale-120 animate-pulse'
                : isSpeaking
                ? 'border-indigo-500/50 scale-125 animate-pulse'
                : isListening
                ? 'border-red-500/40 scale-120 animate-ping'
                : 'border-border-subtle scale-100 opacity-20'
            }`}
          />

          {/* Central Orb Button */}
          <button
            onClick={onToggleListening}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative z-10 ${
              isProcessing
                ? 'bg-gradient-to-tr from-amber-600 to-amber-400 text-white shadow-amber-500/30 scale-105'
                : isSpeaking
                ? 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-indigo-500/30 scale-105'
                : isListening
                ? 'bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-red-500/30 scale-105'
                : 'bg-panel-elevated text-slate-300 hover:text-white border border-border-subtle hover:border-indigo-500/50'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-10 h-10 animate-spin text-white" />
            ) : isSpeaking ? (
              <Activity className="w-10 h-10 animate-pulse text-white" />
            ) : isListening ? (
              <Mic className="w-10 h-10 animate-pulse text-white" />
            ) : (
              <MicOff className="w-10 h-10" />
            )}
          </button>
        </div>

        {/* Dynamic Audio Waveform Bars */}
        <div className="flex items-center justify-center space-x-1.5 h-12 w-full z-10">
          {waveHeights.map((h, i) => (
            <div
              key={i}
              style={{
                height: `${Math.min(100, Math.max(8, h))}%`,
              }}
              className={`w-1.5 rounded-full transition-all duration-150 ${
                isProcessing
                  ? 'bg-gradient-to-t from-amber-500 to-yellow-400'
                  : isSpeaking
                  ? 'bg-gradient-to-t from-indigo-500 to-cyan-400'
                  : isListening && transcript.trim()
                  ? 'bg-gradient-to-t from-rose-500 to-red-400'
                  : isListening
                  ? 'bg-rose-500/70'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Dynamic Speech / Response Card */}
        <div className="space-y-2 w-full z-10">
          <h3 className="text-sm font-semibold text-slate-100">
            {isProcessing
              ? `Processing for ${ownerName}...`
              : isSpeaking
              ? `Speaking with ${ownerName}`
              : isListening
              ? transcript.trim()
                ? 'Hearing your speech...'
                : 'Listening...'
              : wakeGreeting || `Hi ${ownerName}, what do we do today?`}
          </h3>

          <div className="p-4 rounded-2xl bg-canvas border border-border-subtle min-h-[76px] max-h-[140px] overflow-y-auto flex items-center justify-center text-center">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center space-y-1">
                <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider animate-pulse flex items-center space-x-1">
                  <span>⚡ Executing on workstation</span>
                </span>
                <span className="text-sm font-medium text-slate-200 italic">
                  "{activePrompt}"
                </span>
              </div>
            ) : isSpeaking ? (
              <p className="text-sm text-indigo-300 font-medium leading-relaxed">
                {companionReply}
              </p>
            ) : transcript.trim() ? (
              <p className="text-sm text-slate-100 font-medium leading-relaxed">
                {transcript}
              </p>
            ) : isListening ? (
              companionReply ? (
                <div className="flex flex-col items-center justify-center space-y-1.5">
                  <div className="flex items-center space-x-1 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[340px]">{companionReply}</span>
                  </div>
                  <span className="text-xs text-slate-400 italic">
                    Listening for your next command...
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 italic text-xs">
                  Speak clearly into your microphone... (e.g. "play songs on youtube", "create and open task one in desktop")
                </span>
              )
            ) : (
              <span className="text-slate-500 italic text-xs">
                Click the microphone above to start continuous voice interaction.
              </span>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="w-full flex items-center justify-between pt-1 z-10">
          <span className="text-[11px] font-mono text-slate-500">
            {isProcessing
              ? 'Working on your workstation...'
              : isSpeaking
              ? 'Vocal reply active'
              : transcript.trim()
              ? 'Auto-submits on natural pause · Or click Execute'
              : 'Continuous Siri loop active · Speak anytime'}
          </span>

          {transcript.trim() && !isProcessing ? (
            <button
              onClick={handleManualSubmit}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-lg animate-pulse"
            >
              <span>Execute Now</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-panel-elevated border border-border-subtle text-slate-400 font-mono text-[11px] flex items-center space-x-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isListening ? 'bg-red-400 animate-ping' : 'bg-slate-500'
                }`}
              />
              <span>{isListening ? 'Mic Active' : 'Mic Idle'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
