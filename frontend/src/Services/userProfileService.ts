/**
 * User Profile & Distribution Isolation Service
 * Manages personalized name, custom wake greetings, and sequential multi-agent pipeline.
 * All credentials are strictly isolated in local browser storage—never bundled into distribution binaries.
 */

export interface AgentPipelineStep {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'system';
  model: string;
  role: string;
  enabled: boolean;
}

export interface UserProfile {
  ownerName: string;
  wakeGreeting: string;
  wakeWord: string;
  aiProvider: 'openai' | 'anthropic' | 'gemini' | 'ollama';
  apiKey: string;
  ollamaUrl: string;
  backendUrl: string;
  defaultModel: string;
  whatsappNumber: string;
  agentsPipeline: AgentPipelineStep[];
}

const STORAGE_KEY = 'opendesk_user_profile';

export const DEFAULT_PIPELINE: AgentPipelineStep[] = [
  {
    id: 'agent-1',
    name: 'Intent & Security Guard',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    role: 'Analyze user intent and verify execution safety',
    enabled: true,
  },
  {
    id: 'agent-2',
    name: 'OpenDesk PC Action Agent',
    provider: 'system',
    model: 'windows-host-native',
    role: 'Execute approved Windows system tasks, search files, and launch applications',
    enabled: true,
  },
  {
    id: 'agent-3',
    name: 'Vocal Synthesizer & Response Formatter',
    provider: 'openai',
    model: 'gpt-4o',
    role: 'Format natural vocal feedback and concise chat summaries',
    enabled: true,
  },
];

export const DEFAULT_PROFILE: UserProfile = {
  ownerName: 'Omkar',
  wakeGreeting: 'Hi Omkar, what do we do today?',
  wakeWord: 'Hey OpenDesk',
  aiProvider: 'openai',
  apiKey: '',
  ollamaUrl: 'http://127.0.0.1:11434',
  backendUrl: 'http://localhost:3000',
  defaultModel: 'gpt-4o',
  whatsappNumber: '',
  agentsPipeline: DEFAULT_PIPELINE,
};

export const loadUserProfile = (): UserProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
        agentsPipeline: parsed.agentsPipeline && Array.isArray(parsed.agentsPipeline) && parsed.agentsPipeline.length > 0
          ? parsed.agentsPipeline
          : DEFAULT_PIPELINE,
      };
    }
  } catch (err) {
    console.warn('Failed to parse user profile:', err);
  }
  return DEFAULT_PROFILE;
};

export const saveUserProfile = (profile: UserProfile): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event('opendesk_profile_updated'));
  } catch (err) {
    console.warn('Failed to save user profile:', err);
  }
};

/**
 * Sanitizes and resets all private credentials for exporting or sharing a clean .exe
 */
export const resetProfileForDistribution = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('opendesk_user_settings');
    window.dispatchEvent(new Event('opendesk_profile_updated'));
  } catch (err) {
    console.warn('Failed to reset profile:', err);
  }
};
