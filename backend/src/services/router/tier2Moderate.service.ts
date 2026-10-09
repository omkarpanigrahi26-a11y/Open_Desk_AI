export interface Tier2ExecutionResult {
  tier: 'Tier 2';
  model: string;
  success: boolean;
  response: string;
  latencyMs: number;
  tokensConsumed: number;
}

export class Tier2ModerateService {
  private readonly defaultOllamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  private readonly defaultModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:32b';

  /**
   * Dispatches moderate contextual query to local Ollama instance (0 cloud API cost).
   */
  public async execute(query: string, systemPrompt?: string): Promise<Tier2ExecutionResult> {
    const startTime = performance.now();
    const targetUrl = `${this.defaultOllamaHost}/api/generate`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for local model

      const payload = {
        model: this.defaultModel,
        prompt: query,
        system: systemPrompt || 'You are an offline contextual code and log analysis assistant for OpenDesk AI. Provide concise, expert technical responses.',
        stream: false,
      };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const latencyMs = Math.round(performance.now() - startTime);

      const tokensConsumed = data.eval_count
        ? Number(data.eval_count)
        : Math.ceil((data.response?.length || 0) / 4);

      return {
        tier: 'Tier 2',
        model: data.model || this.defaultModel,
        success: true,
        response: data.response || '',
        latencyMs,
        tokensConsumed,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      const isConnectionRefused = err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed');

      // Offline fallback handling
      if (isConnectionRefused) {
        return {
          tier: 'Tier 2',
          model: this.defaultModel,
          success: false,
          response: `[Local Ollama Offline] Unable to reach Ollama at ${this.defaultOllamaHost}. Ensure Ollama is running ('ollama serve') and model '${this.defaultModel}' or 'llama3.2' is downloaded.`,
          latencyMs,
          tokensConsumed: 0,
        };
      }

      return {
        tier: 'Tier 2',
        model: this.defaultModel,
        success: false,
        response: `[Tier 2 Error] Execution failed: ${err.message}`,
        latencyMs,
        tokensConsumed: 0,
      };
    }
  }
}

export const tier2ModerateService = new Tier2ModerateService();
