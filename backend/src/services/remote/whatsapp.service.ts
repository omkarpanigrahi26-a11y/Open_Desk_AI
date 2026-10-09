import { classifierService, DispatchResponse } from '../router/classifier.service';

export interface WhatsAppIncomingMessage {
  from: string;
  message?: string;
  transcript?: string;
  isVoiceNote?: boolean;
}

export interface RemoteExecutionResult {
  authorized: boolean;
  sender: string;
  query: string;
  formattedReply: string;
  dispatchResult?: DispatchResponse;
  error?: string;
}

export interface RemoteBridgeStatus {
  service: string;
  active: boolean;
  authorizedNumbers: string[];
  totalMessagesProcessed: number;
  lastActiveAt: Date | null;
}

export class WhatsAppService {
  private totalMessagesProcessed = 0;
  private lastActiveAt: Date | null = null;

  /**
   * Cleans phone number by removing non-digit characters.
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Retrieves configured authorized mobile numbers from environment.
   */
  public getAuthorizedNumbers(): string[] {
    const raw = process.env.WHATSAPP_AUTHORIZED_NUMBER || process.env.AUTHORIZED_PHONE_NUMBER || '';
    if (!raw.trim()) {
      return [];
    }
    return raw.split(',').map((n) => this.normalizePhone(n.trim())).filter(Boolean);
  }

  /**
   * Verifies if incoming sender is authorized to execute remote workstation actions.
   */
  public isAuthorized(senderPhone: string): boolean {
    const authorized = this.getAuthorizedNumbers();
    if (authorized.length === 0) {
      // If no number configured in .env, accept in development mode or warn
      return true;
    }
    const normalizedSender = this.normalizePhone(senderPhone);
    return authorized.some(
      (auth) => auth === normalizedSender || normalizedSender.endsWith(auth) || auth.endsWith(normalizedSender)
    );
  }

  /**
   * Verifies standard Meta WhatsApp Webhook handshake.
   */
  public verifyWebhookChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): string | null {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'opendesk_verify_token';
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge || 'OK';
    }
    return null;
  }

  /**
   * Extracts message text or voice note transcript from incoming payloads.
   */
  public extractMessageContent(payload: any): WhatsAppIncomingMessage | null {
    // 1. Direct OpenDesk bridge payload format
    if (payload.from && (payload.message || payload.transcript)) {
      return {
        from: String(payload.from),
        message: payload.transcript || payload.message,
        transcript: payload.transcript,
        isVoiceNote: Boolean(payload.isVoiceNote),
      };
    }

    // 2. Meta WhatsApp Cloud API format
    try {
      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (message && message.from) {
        const text = message.text?.body || message.caption || '';
        return {
          from: message.from,
          message: text,
          isVoiceNote: message.type === 'audio' || message.type === 'voice',
        };
      }
    } catch {
      // Fall through to null
    }

    return null;
  }

  /**
   * Formats the dispatch execution output into clean WhatsApp markdown.
   */
  private formatWhatsAppSummary(dispatch: DispatchResponse): string {
    const tier = dispatch.tierUsed;
    let tierBadge = '⚡ Light (OS Native)';
    if (tier === 'Tier 2') tierBadge = '🧠 Moderate (Local Ollama)';
    if (tier === 'Tier 3') tierBadge = '☁️ Complex (Cloud Reasoning)';

    let executionSnippet = '';
    const res = dispatch.result as any;

    if (tier === 'Tier 1') {
      executionSnippet = res.output || 'Action completed.';
    } else if (tier === 'Tier 2') {
      executionSnippet = res.response || 'Execution finished.';
    } else if (tier === 'Tier 3') {
      executionSnippet = res.diff
        ? `Code Patch Generated:\n\`\`\`\n${res.diff.slice(0, 400)}...\n\`\`\``
        : res.response?.slice(0, 350) + '...';
    }

    // Cap output length for mobile display
    if (executionSnippet.length > 600) {
      executionSnippet = executionSnippet.slice(0, 590) + '\n...[truncated for mobile]';
    }

    return [
      `🖥️ *OpenDesk AI Workstation*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*Query:* "${dispatch.query}"`,
      `*Tier:* ${tierBadge}`,
      `*Latency:* ${dispatch.latencyMs}ms`,
      `*Tokens Saved:* ${dispatch.tokensSaved} (Used: ${dispatch.tokensConsumed})`,
      ``,
      `*Output:*`,
      executionSnippet,
      `━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');
  }

  /**
   * Handles incoming WhatsApp webhook messages, checks authorization, and dispatches command.
   */
  public async handleIncomingMessage(payload: any): Promise<RemoteExecutionResult> {
    const incoming = this.extractMessageContent(payload);

    if (!incoming || !incoming.from || !incoming.message) {
      return {
        authorized: false,
        sender: incoming?.from || 'Unknown',
        query: '',
        formattedReply: '⚠️ Invalid or empty message payload received.',
        error: 'INVALID_PAYLOAD',
      };
    }

    const { from, message } = incoming;

    // Security check: Verify sender against authorized whitelist
    if (!this.isAuthorized(from)) {
      return {
        authorized: false,
        sender: from,
        query: message,
        formattedReply: `⛔ *Access Denied*: Phone number +${from} is not authorized to control this OpenDesk AI workstation.`,
        error: 'UNAUTHORIZED_SENDER',
      };
    }

    this.totalMessagesProcessed++;
    this.lastActiveAt = new Date();

    // Route prompt through 3-tier classifier
    const dispatchResult = await classifierService.dispatch(message);
    const formattedReply = this.formatWhatsAppSummary(dispatchResult);

    return {
      authorized: true,
      sender: from,
      query: message,
      formattedReply,
      dispatchResult,
    };
  }

  /**
   * Returns current status of the WhatsApp remote gateway.
   */
  public getStatus(): RemoteBridgeStatus {
    const authorized = this.getAuthorizedNumbers();
    return {
      service: 'OpenDesk WhatsApp Remote Bridge',
      active: true,
      authorizedNumbers: authorized.map((n) => n.slice(0, 3) + '***' + n.slice(-3)),
      totalMessagesProcessed: this.totalMessagesProcessed,
      lastActiveAt: this.lastActiveAt,
    };
  }
}

export const whatsappService = new WhatsAppService();
