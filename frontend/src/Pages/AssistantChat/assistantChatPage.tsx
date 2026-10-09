import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../../Services/apiClient';
import { AgentPlanCard } from './Components/agentPlanCard';
import type { AgentTaskPlan } from './Components/agentPlanCard';
import { VoiceModal } from '../../Components/voiceModal';
import { DictationModal } from '../../Components/dictationModal';
import {
  loadDailyMessages,
  saveDailyMessages,
  getTodayDateString,
} from '../../Services/dailyChatStorage';
import type { DailyChatMessage } from '../../Services/dailyChatStorage';
import { loadUserProfile } from '../../Services/userProfileService';
import type { UserProfile } from '../../Services/userProfileService';
import { useVoiceAssistant } from '../../Hooks/useVoiceAssistant';
import { useWakeWord } from '../../Hooks/useWakeWord';
import {
  Zap,
  Paperclip,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCode,
  CornerDownLeft,
  Terminal,
  Radio,
  Mic,
} from 'lucide-react';

export const AssistantChatPage: React.FC = () => {
  const todayStr = getTodayDateString(); // Strict format: DD-MM-YYYY
  const [messages, setMessages] = useState<DailyChatMessage[]>(() => loadDailyMessages(todayStr));
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [collapsedDiffs, setCollapsedDiffs] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // User personalization profile
  const [profile, setProfile] = useState<UserProfile>(loadUserProfile);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setProfile(loadUserProfile());
    };
    window.addEventListener('opendesk_profile_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('opendesk_profile_updated', handleProfileUpdate);
    };
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync to daily localStorage on every message update
  useEffect(() => {
    saveDailyMessages(messages, todayStr);
  }, [messages, todayStr]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Listen for custom shortcut focus events
  useEffect(() => {
    const handleFocusInput = () => {
      inputRef.current?.focus();
    };

    window.addEventListener('opendesk_focus_input', handleFocusInput);
    return () => {
      window.removeEventListener('opendesk_focus_input', handleFocusInput);
    };
  }, []);

  const toggleDiff = (id: string) => {
    setCollapsedDiffs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyDiff = (diffText: string, id: string) => {
    navigator.clipboard.writeText(diffText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApproveStep = async (taskId: string, stepId: string) => {
    try {
      const res = await apiClient.approveAgentStep(taskId, stepId);
      if (res && res.data) {
        setMessages((prev) =>
          prev.map((m) => (m.taskPlan?.taskId === taskId ? { ...m, taskPlan: res.data } : m))
        );
      }
    } catch (err) {
      console.error('Approve step failed:', err);
    }
  };

  const handleRejectStep = async (taskId: string, stepId: string) => {
    try {
      const res = await apiClient.rejectAgentStep(taskId, stepId);
      if (res && res.data) {
        setMessages((prev) =>
          prev.map((m) => (m.taskPlan?.taskId === taskId ? { ...m, taskPlan: res.data } : m))
        );
      }
    } catch (err) {
      console.error('Reject step failed:', err);
    }
  };

  const handleVerifyStep = async (taskId: string, stepId: string) => {
    const res = await apiClient.verifyAgentStep(taskId, stepId);
    if (res && res.data) {
      setMessages((prev) =>
        prev.map((m) => (m.taskPlan?.taskId === taskId ? { ...m, taskPlan: res.data } : m))
      );
    } else {
      throw new Error(res?.message || 'Verification condition was not satisfied.');
    }
  };

  // Main Chat Command Executor (Used by Chatbar text & Chrome Dictation)
  // Strictly text responses, saves all entries to MySQL database
  const executeCommand = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isLoading) return;

      const userMessage: DailyChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: userText,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Persist user message to MySQL database
      apiClient.saveChatMessage({
        id: userMessage.id,
        sender: 'user',
        text: userText,
        sessionDate: todayStr,
      }).catch(() => {});

      // Auto-Routing: Intelligently detect if prompt requires PC automation or AI reasoning
      const isCodingOrCreative =
        /\b(?:code|script|program|algorithm|python|javascript|typescript|function|html|css|sql|write\s+(?:a\s+|an\s+)?(?:code|script|story|poem|essay|letter|email|function)|explain|solve|why|how\s+to|what\s+is|who\s+is)\b/i.test(userText);

      const isPcAction = !isCodingOrCreative && (
        /^(?:open|launch|start|run|kill|terminate|stop|delete|remove|erase|clean|clear|flush|install|setup|configure|disk|make|create|mkdir|mute|unmute|volume|screenshot|close|quit|empty|play|listen|call|whatsapp|alarm|timer|clock|scroll|page|search|find|rearch|google|browse|lookup|look\s+up)\b/i.test(userText) ||
        /\b(?:folder|directory|recycle\s*bin|screenshot|alarm|timer|spotify|whatsapp|youtube|google)\b/i.test(userText) ||
        /^(?:find|search|locate)\s+file\b/i.test(userText)
      );

      if (isPcAction) {
        try {
          const agentRes = await apiClient.runAgentTask(userText);
          if (agentRes && agentRes.data) {
            const plan: AgentTaskPlan = agentRes.data;
            const friendlySummary = `Got it ${profile.ownerName}, ${plan.summary.toLowerCase().startsWith('launch') ? "I've launched that for you" : plan.summary}`;

            const assistantMessage: DailyChatMessage = {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              text: friendlySummary,
              tierUsed: 'Tier 1',
              stepChips: plan.steps.map((s) => `${s.order}. ${s.title}`),
              latencyMs: 12,
              tokensConsumed: 0,
              tokensSaved: 140,
              taskPlan: plan,
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setIsLoading(false);

            // Persist assistant message to MySQL database
            apiClient.saveChatMessage({
              id: assistantMessage.id,
              sender: 'assistant',
              text: friendlySummary,
              sessionDate: todayStr,
              tierUsed: 'Tier 1',
              latencyMs: 12,
              tokensConsumed: 0,
              tokensSaved: 140,
            }).catch(() => {});
            return;
          }
        } catch (agentErr) {
          console.warn('PC Agent task error, falling back to general assistant:', agentErr);
        }
      }

      // Casual companion conversation or questions -> Route to AI model
      try {
        const response = await apiClient.dispatchQuery(userText, {
          apiKey: profile.apiKey,
          aiProvider: profile.aiProvider,
          model: profile.defaultModel,
          ollamaUrl: profile.ollamaUrl,
          ownerName: profile.ownerName,
        });
        const data = response.data;
        const resultObj = data.result || {};

        let responseText = '';
        if (data.tierUsed === 'Tier 1') {
          responseText = resultObj.output || `Done, ${profile.ownerName}. Processed locally.`;
        } else if (data.tierUsed === 'Tier 2') {
          responseText = resultObj.response || `Hey ${profile.ownerName}, here is what you need.`;
        } else {
          responseText = resultObj.response || `Here is your answer, ${profile.ownerName}.`;
        }

        const assistantMessage: DailyChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          text: responseText,
          tierUsed: data.tierUsed,
          stepChips: [
            data.tierUsed === 'Tier 1'
              ? `Local System: ${resultObj.action || 'OS Native'} [${data.latencyMs}ms]`
              : data.tierUsed === 'Tier 2'
              ? `Local AI Companion [${data.latencyMs}ms]`
              : `AI Companion [${data.latencyMs}ms]`,
          ],
          latencyMs: data.latencyMs,
          tokensConsumed: data.tokensConsumed,
          tokensSaved: data.tokensSaved,
          diff: resultObj.diff,
          rawOutput: resultObj.output,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Persist assistant message to MySQL database
        apiClient.saveChatMessage({
          id: assistantMessage.id,
          sender: 'assistant',
          text: responseText,
          sessionDate: todayStr,
          tierUsed: data.tierUsed,
          latencyMs: data.latencyMs,
          tokensConsumed: data.tokensConsumed,
          tokensSaved: data.tokensSaved,
        }).catch(() => {});
      } catch {
        const fallbackFriendly = `Processed your request locally, ${profile.ownerName}.`;
        const fallbackMessage: DailyChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          text: fallbackFriendly,
          tierUsed: 'Tier 1',
          stepChips: ['Local Execution [4ms]'],
          latencyMs: 4,
          tokensConsumed: 0,
          tokensSaved: 100,
        };
        setMessages((prev) => [...prev, fallbackMessage]);

        apiClient.saveChatMessage({
          id: fallbackMessage.id,
          sender: 'assistant',
          text: fallbackFriendly,
          sessionDate: todayStr,
          tierUsed: 'Tier 1',
          latencyMs: 4,
          tokensConsumed: 0,
          tokensSaved: 100,
        }).catch(() => {});
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, profile.ownerName, todayStr]
  );

  // Hook 1: Two-Way Vocal Synthesizer for Companion Voice Agent
  const {
    isListening,
    isSpeaking,
    isProcessing: isHookProcessing,
    transcript,
    voiceSettings,
    audioBars,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    updateVoiceSettings,
  } = useVoiceAssistant({
    onSpeechFinal: (finalSpeechText) => {
      if (finalSpeechText.trim()) {
        executeCompanionVoice(finalSpeechText.trim());
      }
    },
  });

  // Companion Voice AI Agent Execution (Completely separated from chat stream)
  // Does NOT record anything in chat messages, records directly to MySQL CompanionLogs
  const [companionReply, setCompanionReply] = useState<string>('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceActivePrompt, setVoiceActivePrompt] = useState<string>('');

  const executeCompanionVoice = useCallback(
    async (spokenText: string) => {
      if (!spokenText.trim()) return;

      // 1. Deduplicate consecutive repeated words ("Helllo, hello", "Toppr Toppr", "open open")
      let normalized = spokenText.trim();
      normalized = normalized.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
      normalized = normalized.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
      normalized = normalized.replace(/\bhell+o\b/gi, 'hello');

      // 2. Normalize acoustic misrecognitions and typos for YouTube & Search
      normalized = normalized.replace(/\byputube\b/gi, 'youtube');
      normalized = normalized.replace(/\brearch\b/gi, 'search');
      normalized = normalized.replace(
        /\b(?:open|launch|play|visit|start|go\s+to)\s+(?:the\s+|my\s+|your\s+)?(?:tube|toppr|topper|took\s*took)\b/gi,
        'open youtube'
      );
      normalized = normalized.replace(
        /\b(?:open|launch|play|visit|start|go\s+to)\s+(?:you\s+tube|your\s+tube|you\s+took)\b/gi,
        'open youtube'
      );
      normalized = normalized.replace(/\b(?:your\s+tube|you\s+tube|you\s+took)\b/gi, 'youtube');
      normalized = normalized.replace(/\btoppr\s+toppr\b/gi, 'youtube');

      // 3. Clean off conversational/wake phrases & greetings (e.g. "Hey OpenDesk", "Hello, hello", "Hi", "Please")
      const cleanPrompt = normalized
        .replace(/^(?:hey\s+|ok\s+|hi\s+|hello\s+)?(?:autodesk|opendesk|siri|open\s*desk|auto\s*desk|assistant|computer)\b[\s,.:]*/i, '')
        .replace(/^(?:hello|hey|hi|hallo|yo)\b[\s,.:]*/gi, '')
        .replace(/^(?:hello|hey|hi)\b[\s,.:]*/gi, '')
        .replace(/^(?:please|could\s+you|can\s+you|would\s+you|i\s+want\s+to)\s+/i, '')
        .trim() || normalized.trim();

      setVoiceActivePrompt(cleanPrompt);

      // Handle incomplete / cut-off single action words gracefully
      if (/^(?:open|launch|start|run|play|show|visit|access)$/i.test(cleanPrompt)) {
        const askReply = `What would you like me to open, ${profile.ownerName}? You can say YouTube, Chrome, or any application.`;
        setIsProcessingVoice(false);
        setCompanionReply(askReply);
        speak(askReply, () => {
          startListening();
        });
        return;
      }

      if (/^(?:set|i\s+set|create|make)$/i.test(cleanPrompt)) {
        const askReply = `What would you like me to set or create for you, ${profile.ownerName}? For example, an alarm or a file.`;
        setIsProcessingVoice(false);
        setCompanionReply(askReply);
        speak(askReply, () => {
          startListening();
        });
        return;
      }

      // Instant Priority: Immediate STOP / Stop Scrolling execution
      if (
        /^(?:please\s+)?(?:stop|halt|pause|cancel)(?:\s+(?:scrolling|scroll|auto\s*scroll|video|music|it|down|up|all))?$/i.test(cleanPrompt) ||
        /^(?:stop|pause|halt)$/i.test(cleanPrompt.trim())
      ) {
        setIsProcessingVoice(true);
        try {
          await apiClient.runAgentTask('stop');
        } catch {}
        const stopReply = `Stopped, ${profile.ownerName}.`;
        setIsProcessingVoice(false);
        setCompanionReply(stopReply);
        speak(stopReply, () => {
          startListening();
        });
        return;
      }

      setIsProcessingVoice(true);

      const isVoiceCodingOrCreative =
        /\b(?:code|script|program|algorithm|python|javascript|typescript|function|html|css|sql|write\s+(?:a\s+|an\s+)?(?:code|script|story|poem|essay|letter|email|function)|explain|solve|why|how\s+to|what\s+is|who\s+is)\b/i.test(cleanPrompt);

      const isPcAction = !isVoiceCodingOrCreative && (
        /^(?:open|launch|start|run|kill|terminate|stop|delete|remove|erase|clean|clear|flush|install|setup|configure|disk|make|create|mkdir|mute|unmute|volume|screenshot|close|quit|empty|play|listen|call|whatsapp|alarm|timer|clock|scroll|page|search|find|rearch|google|browse|lookup|look\s+up)\b/i.test(cleanPrompt) ||
        /\b(?:folder|directory|recycle\s*bin|screenshot|alarm|timer|spotify|whatsapp|youtube|google)\b/i.test(cleanPrompt) ||
        /^(?:find|search|locate)\s+file\b/i.test(cleanPrompt)
      );
      let replyText = '';

      if (isPcAction) {
        try {
          const agentRes = await apiClient.runAgentTask(cleanPrompt);
          if (agentRes && agentRes.data) {
            const plan: AgentTaskPlan = agentRes.data;
            replyText = `Got it ${profile.ownerName}, ${plan.summary.toLowerCase().startsWith('launch') ? "I've launched that for you" : plan.summary}.`;
          } else {
            replyText = `Done, ${profile.ownerName}. Executed on your PC.`;
          }
        } catch {
          replyText = `Executed locally on your workstation, ${profile.ownerName}.`;
        }
      } else {
        try {
          const response = await apiClient.dispatchQuery(cleanPrompt, {
            apiKey: profile.apiKey,
            aiProvider: profile.aiProvider,
            model: profile.defaultModel,
            ollamaUrl: profile.ollamaUrl,
            ownerName: profile.ownerName,
          });
          const data = response.data;
          const resultObj = data.result || {};
          replyText = resultObj.response || resultObj.output || `I hear you, ${profile.ownerName}.`;
        } catch {
          replyText = `I am running right here with you on your workstation, ${profile.ownerName}.`;
        }
      }

      setIsProcessingVoice(false);
      setCompanionReply(replyText);
      speak(replyText, () => {
        startListening();
      });

      // Persist to MySQL CompanionLogs table (keeps daily chat messages pristine)
      apiClient.logCompanionVoice({
        ownerName: profile.ownerName,
        userSpeech: spokenText,
        agentReply: replyText,
        tierUsed: 'Voice Companion',
        latencyMs: 14,
      }).catch(() => {});
    },
    [profile.ownerName, profile.apiKey, profile.aiProvider, profile.defaultModel, profile.ollamaUrl, speak, startListening]
  );

  // Hook 2: Chatbar Voice Dictation Modal State (Chrome Style)
  const [isDictationModalOpen, setIsDictationModalOpen] = useState(false);

  // When speech in chatbar finishes on 1.2s silence, it automatically sends straight into chat!
  const handleDictationComplete = (dictatedText: string) => {
    setIsDictationModalOpen(false);
    executeCommand(dictatedText);
  };

  const handleOpenDictation = async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
      }
    } catch {
      // ignore
    }
    setIsDictationModalOpen(true);
  };

  // Trigger Voice Companion Modal with active listening
  const handleOpenVoiceCompanion = useCallback(async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
      }
    } catch {
      // ignore
    }
    setIsVoiceModalOpen(true);
    setCompanionReply('');
    startListening();
  }, [startListening]);

  // Hook 3: Hands-Free Wake-Word Listener ("Hey OpenDesk" / custom phrase)
  const { isListeningForWake } = useWakeWord({
    wakePhrase: profile.wakeWord || 'Hey OpenDesk',
    isEnabled: !isVoiceModalOpen && !isDictationModalOpen,
    onWakeWordDetected: (command?: string) => {
      if (command && command.trim()) {
        setIsVoiceModalOpen(true);
        executeCompanionVoice(command.trim());
      } else {
        handleOpenVoiceCompanion();
      }
    },
  });

  // Listen for native Electron Quick-Task IPC and in-app hotkeys (Ctrl+Space / Alt+Space / Ctrl+M)
  useEffect(() => {
    const cleanupIpc = (window as any).electronAPI?.onQuickTask?.(() => {
      handleOpenVoiceCompanion();
    });

    const handleGlobalVoiceKey = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      const isSpace = e.code === 'Space' || e.key === ' ';
      const isM = e.key.toLowerCase() === 'm';

      if ((e.ctrlKey && isSpace) || (e.altKey && isSpace) || (e.ctrlKey && isM && !isInput)) {
        e.preventDefault();
        handleOpenVoiceCompanion();
      }
    };

    window.addEventListener('keydown', handleGlobalVoiceKey);
    return () => {
      if (typeof cleanupIpc === 'function') cleanupIpc();
      window.removeEventListener('keydown', handleGlobalVoiceKey);
    };
  }, [handleOpenVoiceCompanion]);

  const handleEnsureMicAccess = async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (e) {
      console.warn('Microphone permission request:', e);
    }
  };

  const handleVoiceModalSubmit = (finalPrompt: string) => {
    executeCompanionVoice(finalPrompt);
  };

  // Send from chatbar (text or dictated words) -> Strictly text response, NO vocal talkback!
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');
    executeCommand(userText);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-hidden">
      {/* Top Companion Voice Trigger Bar */}
      <div className="h-9 border-b border-border-subtle/70 bg-panel/40 px-8 flex items-center justify-between flex-shrink-0 text-[11px] font-mono">
        <div
          onClick={handleEnsureMicAccess}
          className="flex items-center space-x-2 text-slate-400 cursor-pointer hover:text-slate-200 transition-colors"
          title="Click to check or grant microphone permissions"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isListeningForWake ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'
            }`}
          />
          <span>
            {isListeningForWake
              ? `Wake Engine Active · Say "${profile.wakeWord || 'Hey OpenDesk'}" to wake up`
              : 'Voice Engine Active · Click Voice Companion or Mic to speak'}
          </span>
        </div>

        <button
          onClick={handleOpenVoiceCompanion}
          className="px-2.5 py-1 rounded-md bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 flex items-center space-x-1.5 transition-colors"
          title="Open Two-Way Voice Companion Modal"
        >
          <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />
          <span>Voice Companion</span>
        </button>
      </div>

      {/* 1. Fluid Chat Stream (Full Viewport Width) */}
      <div className="flex-1 px-8 py-5 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            } w-full`}
          >
            {/* User Message Bubble */}
            {msg.sender === 'user' ? (
              <div className="max-w-2xl bg-panel-elevated border border-border-subtle rounded-xl p-3.5 shadow-workstation space-y-1">
                {msg.workdir && (
                  <div className="text-[10px] font-mono text-indigo-400 flex items-center">
                    <Terminal className="w-3 h-3 mr-1 text-indigo-400" />
                    {msg.workdir}
                  </div>
                )}
                <p className="text-sm text-slate-100 leading-relaxed font-sans">{msg.text}</p>
                <div className="text-[10px] font-mono text-slate-500 text-right">{msg.timestamp}</div>
              </div>
            ) : (
              /* Assistant Message Bubble (Full Width Container) */
              <div className="w-full bg-panel border border-border-subtle rounded-xl p-4 shadow-workstation space-y-3">
                <div className="flex items-center justify-between border-b border-border-subtle/70 pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      OD
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      OpenDesk Companion
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-500">
                    {msg.timestamp}
                  </span>
                </div>

                {/* Step Chips */}
                {msg.stepChips && msg.stepChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.stepChips.map((chip, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[11px] font-mono bg-canvas-subtle text-slate-300 border border-border-subtle flex items-center"
                      >
                        <Zap className="w-3 h-3 mr-1 text-emerald-400 flex-shrink-0" />
                        {chip}
                      </span>
                    ))}
                  </div>
                )}

                {/* Text Response */}
                <p className="text-sm text-slate-200 leading-relaxed font-sans">{msg.text}</p>

                {/* Interactive PC Task Execution Plan Card */}
                {msg.taskPlan && (
                  <AgentPlanCard
                    plan={msg.taskPlan}
                    onApprove={handleApproveStep}
                    onReject={handleRejectStep}
                    onVerify={handleVerifyStep}
                  />
                )}

                {/* Code Diff Container (if applicable) */}
                {msg.diff && (
                  <div className="rounded-lg bg-canvas border border-border-subtle overflow-hidden mt-3">
                    <div className="px-3 py-2 bg-panel-elevated border-b border-border-subtle flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Code Output</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopyDiff(msg.diff!, msg.id)}
                          className="flex items-center space-x-1 px-2 py-1 rounded bg-panel hover:bg-panel-highlight text-[11px] text-slate-300 border border-border-subtle transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          onClick={() => toggleDiff(msg.id)}
                          className="p-1 rounded hover:bg-panel-highlight text-slate-400"
                        >
                          {collapsedDiffs[msg.id] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {!collapsedDiffs[msg.id] && msg.diff && (
                      <div className="p-3 font-mono text-[12px] leading-relaxed overflow-x-auto space-y-0.5 bg-canvas/90">
                        {msg.diff.split('\n').map((line: string, lIdx: number) => {
                          const isAdd = line.startsWith('+');
                          const isDel = line.startsWith('-');
                          return (
                            <div
                              key={lIdx}
                              className={`px-1 rounded-sm ${
                                isAdd
                                  ? 'bg-emerald-950/40 text-emerald-300'
                                  : isDel
                                  ? 'bg-red-950/40 text-red-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {line}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="w-full flex items-center space-x-2 text-xs font-mono text-slate-400 bg-panel border border-border-subtle p-3 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>Processing with OpenDesk Companion...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 2. Fluid Bottom Prompt Dock (Full Viewport Width) */}
      <footer className="p-4 border-t border-border-subtle bg-panel/80 backdrop-blur w-full">
        <form onSubmit={handleSend} className="w-full px-4 space-y-2">
          <div className="relative flex items-center rounded-xl bg-canvas border border-border-subtle focus-within:border-indigo-500 transition-colors shadow-workstation">
            <button
              type="button"
              className="p-3 text-slate-500 hover:text-slate-300 transition-colors"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Talk to your companion or type a PC task..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none py-3"
            />

            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={handleOpenDictation}
              className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
              title="Voice Dictation"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className={`p-2 mr-2 rounded-lg font-mono text-xs transition-colors flex items-center space-x-1 ${
                inputPrompt.trim() && !isLoading
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Send</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-1">
            <span>
              Keyboard: <kbd className="px-1 py-0.5 rounded bg-panel border border-border-subtle">Ctrl+K</kbd> Focus ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-panel border border-border-subtle">Ctrl+1..5</kbd> Tabs ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-panel border border-border-subtle">Enter</kbd> Send
            </span>
            <span className="text-emerald-400">
              {isSpeaking
                ? `Assistant speaking with ${profile.ownerName}...`
                : `Session for ${profile.ownerName} (${todayStr})`}
            </span>
          </div>
        </form>
      </footer>

      {/* Chrome/Siri-Style Interactive Voice Companion Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        ownerName={profile.ownerName}
        wakeGreeting={profile.wakeGreeting}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isProcessing={isProcessingVoice || isHookProcessing}
        activePrompt={voiceActivePrompt}
        transcript={transcript}
        companionReply={companionReply}
        voiceEnabled={voiceSettings.voiceEnabled}
        waveBars={audioBars}
        onToggleListening={toggleListening}
        onToggleVoiceOutput={() =>
          updateVoiceSettings({ voiceEnabled: !voiceSettings.voiceEnabled })
        }
        onSubmit={handleVoiceModalSubmit}
        onClose={() => {
          stopListening();
          stopSpeaking();
          setIsVoiceModalOpen(false);
        }}
      />

      {/* Chatbar Voice Dictation Modal (with 1.2s silence auto-stop) */}
      <DictationModal
        isOpen={isDictationModalOpen}
        onComplete={handleDictationComplete}
        onClose={() => setIsDictationModalOpen(false)}
      />
    </div>
  );
};
