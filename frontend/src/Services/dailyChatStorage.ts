/**
 * Daily Chat Persistence Service
 * Stores conversation messages grouped strictly by date format: DD-MM-YYYY.
 * All messages on the same calendar day persist across app restarts and refreshes.
 */

export interface DailyChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  workdir?: string;
  tierUsed?: 'Tier 1' | 'Tier 2' | 'Tier 3';
  stepChips?: string[];
  latencyMs?: number;
  tokensConsumed?: number;
  tokensSaved?: number;
  rawOutput?: string;
  diff?: string;
  taskPlan?: any;
}

export const getTodayDateString = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`; // STRICT FORMAT: DD-MM-YYYY
};

const STORAGE_PREFIX = 'opendesk_chat_session_';

export const getDailyStorageKey = (dateStr = getTodayDateString()): string => {
  return `${STORAGE_PREFIX}${dateStr}`;
};

export const loadDailyMessages = (dateStr = getTodayDateString()): DailyChatMessage[] => {
  try {
    const raw = localStorage.getItem(getDailyStorageKey(dateStr));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved daily chat session:', err);
  }

  // Initial message for a fresh daily conversation with personalized name
  let ownerName = 'Omkar';
  try {
    const rawProfile = localStorage.getItem('opendesk_user_profile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (parsed.ownerName) ownerName = parsed.ownerName;
    }
  } catch {
    // fallback
  }

  return [
    {
      id: `welcome-${dateStr}`,
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Good day, ${ownerName}! OpenDesk PC Assistant is ready on your Windows workstation for ${dateStr}. Ask me to search files, open applications, or run PC tasks.`,
    },
  ];
};

export const saveDailyMessages = (messages: DailyChatMessage[], dateStr = getTodayDateString()): void => {
  try {
    localStorage.setItem(getDailyStorageKey(dateStr), JSON.stringify(messages));
  } catch (err) {
    console.warn('Failed to save daily chat session:', err);
  }
};
