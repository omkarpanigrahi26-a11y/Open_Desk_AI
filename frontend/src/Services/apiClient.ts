import { BACKEND_CONFIG, API_ENDPOINTS } from '../Config/routes';

class ApiClient {
  private baseUrls = [
    BACKEND_CONFIG.DEFAULT_HTTP_URL,
    BACKEND_CONFIG.ALT_HTTP_URL,
  ];

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let lastError: any = null;

    for (const base of this.baseUrls) {
      try {
        const url = `${base}${path}`;
        const res = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }

        if (base !== this.baseUrls[0]) {
          this.baseUrls = [base, ...this.baseUrls.filter((b) => b !== base)];
        }

        return await res.json();
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error(`Network request to ${path} failed on all backend endpoints`);
  }

  public async dispatchQuery(
    query: string,
    options?: {
      apiKey?: string;
      aiProvider?: string;
      model?: string;
      ollamaUrl?: string;
      ownerName?: string;
    }
  ) {
    return this.request<any>(API_ENDPOINTS.DISPATCH, {
      method: 'POST',
      body: JSON.stringify({ query, options }),
    });
  }

  public async getSavingsMetrics() {
    return this.request<any>(API_ENDPOINTS.SAVINGS_METRICS, {
      method: 'GET',
    });
  }

  public async searchFiles(q: string, limit = 10) {
    return this.request<any>(`${API_ENDPOINTS.FILES_SEARCH}?q=${encodeURIComponent(q)}&limit=${limit}`, {
      method: 'GET',
    });
  }

  public async triggerReindex(targetDirectories?: string[]) {
    return this.request<any>(API_ENDPOINTS.FILES_REINDEX, {
      method: 'POST',
      body: JSON.stringify({ targetDirectories }),
    });
  }

  public async getRemoteStatus() {
    return this.request<any>(API_ENDPOINTS.REMOTE_STATUS, {
      method: 'GET',
    });
  }

  public async runAgentTask(prompt: string) {
    return this.request<any>(API_ENDPOINTS.AGENT_RUN, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  public async approveAgentStep(taskId: string, stepId: string) {
    return this.request<any>(API_ENDPOINTS.AGENT_APPROVE, {
      method: 'POST',
      body: JSON.stringify({ taskId, stepId }),
    });
  }

  public async rejectAgentStep(taskId: string, stepId: string) {
    return this.request<any>(API_ENDPOINTS.AGENT_REJECT, {
      method: 'POST',
      body: JSON.stringify({ taskId, stepId }),
    });
  }

  public async verifyAgentStep(taskId: string, stepId: string) {
    return this.request<any>(API_ENDPOINTS.AGENT_VERIFY, {
      method: 'POST',
      body: JSON.stringify({ taskId, stepId }),
    });
  }

  public async saveChatMessage(message: {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    sessionDate: string;
    tierUsed?: string;
    latencyMs?: number;
    tokensConsumed?: number;
    tokensSaved?: number;
  }) {
    return this.request<any>('/api/chat/save', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  public async logCompanionVoice(log: {
    ownerName: string;
    userSpeech: string;
    agentReply: string;
    tierUsed?: string;
    latencyMs?: number;
  }) {
    return this.request<any>('/api/chat/companion-log', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  }

  public async getSessionMessages(date: string) {
    return this.request<any>(`/api/chat/session/${encodeURIComponent(date)}`, {
      method: 'GET',
    });
  }

  public async getCompanionLogs() {
    return this.request<any>('/api/chat/companion-logs', {
      method: 'GET',
    });
  }

  public async transcribeAudio(
    audioBase64: string,
    mimeType = 'audio/wav',
    apiKey?: string,
    provider?: string
  ) {
    return this.request<{
      success: boolean;
      data: {
        success: boolean;
        text: string;
        provider: string;
        latencyMs: number;
      };
    }>('/api/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, mimeType, apiKey, provider }),
    });
  }
}

export const apiClient = new ApiClient();
