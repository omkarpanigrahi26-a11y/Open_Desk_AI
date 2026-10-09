import crypto from 'crypto';
import path from 'path';

export type StepType = 'AUTOMATED' | 'REQUIRES_PERMISSION' | 'MANUAL_USER_ACTION';
export type StepStatus = 'PENDING' | 'WAITING_APPROVAL' | 'WAITING_MANUAL' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface PlanStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: StepType;
  status: StepStatus;
  action?: {
    tool:
      | 'LAUNCH_APP'
      | 'FIND_FILE'
      | 'OPEN_LOCATION'
      | 'EXECUTE_COMMAND'
      | 'CREATE_DIRECTORY'
      | 'CREATE_FILE'
      | 'DELETE_TARGET'
      | 'EDIT_FILE'
      | 'CLOSE_APP'
      | 'OPEN_URL'
      | 'PLAY_YOUTUBE'
      | 'PLAY_SPOTIFY'
      | 'SCROLL_PAGE'
      | 'AUTO_SCROLL_START'
      | 'AUTO_SCROLL_STOP'
      | 'RESUME_PLAYBACK'
      | 'WINDOW_STATE'
      | 'OPEN_FILE_MANAGER'
      | 'PLAY_YOUTUBE_VIDEO'
      | 'WHATSAPP_ACTION'
      | 'SET_ALARM'
      | 'SYSTEM_ACTION';
    payload: any;
  };
  manualInstructions?: string[];
  verificationCheck?: {
    type: 'PROCESS_RUNNING' | 'FILE_EXISTS' | 'COMMAND_CHECK';
    target: string;
  };
  output?: string;
  error?: string;
}

export interface AgentTaskPlan {
  taskId: string;
  userPrompt: string;
  summary: string;
  createdAt: string;
  currentStepIndex: number;
  steps: PlanStep[];
  isComplete: boolean;
}

export class TaskPlannerService {
  /**
   * Plans an actionable multi-step execution graph based on user request.
   */
  public generatePlan(rawInputPrompt: string): AgentTaskPlan {
    const taskId = crypto.randomUUID();
    let cleaned = rawInputPrompt.trim();
    // 1. Deduplicate consecutive identical words ("Helllo, hello", "Toppr Toppr", "open open")
    cleaned = cleaned.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
    cleaned = cleaned.replace(/\b([a-zA-Z]+)(?:\s*[,.]?\s+|\s+)\1\b/gi, '$1');
    cleaned = cleaned.replace(/\bhell+o\b/gi, 'hello');

    // 2. Fix acoustic mistranscriptions of YouTube and typos
    cleaned = cleaned.replace(/\byputube\b/gi, 'youtube');
    cleaned = cleaned.replace(/\brearch\b/gi, 'search');
    cleaned = cleaned.replace(/\b(?:open|launch|play|visit|start|go\s+to)\s+(?:the\s+|my\s+|your\s+)?(?:tube|toppr|topper|took\s*took)\b/gi, 'open youtube');
    cleaned = cleaned.replace(/\b(?:open|launch|play|visit|start|go\s+to)\s+(?:you\s+tube|your\s+tube|you\s+took)\b/gi, 'open youtube');
    cleaned = cleaned.replace(/\b(?:your\s+tube|you\s+tube|you\s+took)\b/gi, 'youtube');
    cleaned = cleaned.replace(/\btoppr\s+toppr\b/gi, 'youtube');

    // 3. Strip conversational / wake-word prefixes
    const prompt = cleaned
      .replace(/^(?:hey\s+|ok\s+|hi\s+|hello\s+)?(?:autodesk|opendesk|siri|open\s*desk|auto\s*desk|assistant|computer)\b[\s,.:]*/i, '')
      .replace(/^(?:hello|hey|hi|hallo|yo)\b[\s,.:]*/gi, '')
      .replace(/^(?:hello|hey|hi)\b[\s,.:]*/gi, '')
      .replace(/^(?:please|could\s+you|can\s+you|would\s+you|i\s+want\s+to)\s+/i, '')
      .trim() || cleaned;
    const q = prompt.trim().toLowerCase();
    const steps: PlanStep[] = [];

    // Priority Case 0A: Universal Stop ("stop", "stop scrolling", "halt", "pause")
    if (
      /^(?:please\s+)?(?:stop|halt|pause|cancel)(?:\s+(?:scrolling|scroll|auto\s*scroll|music|video|playback|it|down|up|all))?$/i.test(prompt) ||
      /\b(?:stop|halt)\s+(?:scrolling|scroll|auto\s*scroll|music|video)\b/i.test(prompt) ||
      /^(?:stop|pause|halt)$/i.test(prompt.trim())
    ) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Stop',
        description: 'Stop scrolling and pause any active media or video.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'AUTO_SCROLL_STOP', payload: {} },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Stopped.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Priority Case 0A-2: Resume Playback / Play Video ("play it", "click on play it", "click on play", "resume", "unpause")
    if (
      /^(?:click\s+on\s+)?(?:play\s+it|play|resume|unpause)(?:\s+video)?$/i.test(prompt) ||
      /\b(?:click\s+on\s+play\s+it|click\s+on\s+play)\b/i.test(prompt)
    ) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Play Video',
        description: 'Resume video and media playback.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'RESUME_PLAYBACK', payload: {} },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Playing.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Priority Case 0B: Scroll Down ("scroll down", "scroll down slowly", "scroll slowly")
    if (
      /\b(?:scroll\s+down|scroll\s+slowly|scroll\s+slow|auto\s*scroll\s+down)\b/i.test(prompt) ||
      /^(?:please\s+)?scroll(?:\s+down)?$/i.test(prompt)
    ) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Scroll Down',
        description: 'Continuously scroll screen downwards slowly until you say "stop".',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'AUTO_SCROLL_START', payload: { direction: 'DOWN', intervalMs: 900 } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Scrolling down slowly. Say "stop" anytime.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Priority Case 0C: Scroll Up ("scroll up", "scroll up slowly")
    if (/\b(?:scroll\s+up|scroll\s+up\s+slowly|auto\s*scroll\s+up)\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Scroll Up',
        description: 'Continuously scroll screen upwards slowly until you say "stop".',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'AUTO_SCROLL_START', payload: { direction: 'UP', intervalMs: 900 } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Scrolling up slowly. Say "stop" anytime.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Priority Case 0D: Minimize Window / Screen ("minimize", "minimize it", "minimize window", "minimize all")
    if (/\b(?:minimize|minimise)(?:\s+(?:it|the\s+window|window|all|screen))?\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Minimize Window',
        description: 'Minimize active window on screen.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'WINDOW_STATE', payload: { state: 'MINIMIZE' } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Minimized active window.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Priority Case 0E: Maximize Window / Screen ("maximize", "maximize it", "maximize window", "fullscreen", "full screen")
    if (/\b(?:maximize|maximise|fullscreen|full\s+screen)(?:\s+(?:it|the\s+window|window|screen))?\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Maximize Window',
        description: 'Maximize window to full screen.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'WINDOW_STATE', payload: { state: 'MAXIMIZE' } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Maximized window to full screen.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Priority Case 0F: Open File Manager / Explorer ("open file manager", "open explorer", "show downloads", "show documents", "show desktop")
    if (
      /\b(?:open|show|launch)\s+(?:the\s+)?(?:file\s+manager|explorer|windows\s+explorer|my\s+files|files\s+app)\b/i.test(prompt) ||
      /\b(?:show|open)\s+(?:my\s+)?(?:downloads|documents|desktop)\b/i.test(prompt)
    ) {
      let folder: string | undefined;
      if (/\bdownload/i.test(prompt)) folder = 'downloads';
      else if (/\bdocument/i.test(prompt)) folder = 'documents';
      else if (/\bdesktop/i.test(prompt)) folder = 'desktop';

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: folder ? `Open ${folder} in File Manager` : 'Open Windows File Explorer',
        description: 'Launch Windows File Explorer.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'OPEN_FILE_MANAGER', payload: { folderOrFile: folder } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: folder ? `Opened ${folder} in File Explorer.` : 'Opened Windows File Explorer.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 1: Spotify Music / Artist ("play any singer song on spotify", "play taylor swift on spotify", "open spotify")
    if (/\bspotify\b/i.test(prompt)) {
      let query = '';
      const spotifyMatch = prompt.match(/(?:play|listen\s+to|stream)\s+(?:songs?|music|track)?\s*(.+?)(?:\s+(?:on|in)\s+spotify)?$/i)
        || prompt.match(/spotify\s+(?:play|search)\s+(.+)/i);

      if (spotifyMatch) {
        query = (spotifyMatch[1] || '').replace(/\b(?:on|in)?\s*spotify\b/i, '').trim();
      }
      if (!query || /^(?:any\s+(?:singer\s+)?song|something|music|songs)$/i.test(query)) {
        query = 'Today Top Hits';
      }

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Play on Spotify: ${query}`,
        description: `Stream "${query}" in Spotify.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'PLAY_SPOTIFY', payload: { query } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: `Playing "${query}" on Spotify.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Priority Case 1B: Universal YouTube Integration (Open, Search, Play, Start, Watch)
    // 1. Compound: "open youtube and (search|play|start|watch|find) <query/any video>"
    const compoundYtMatch = prompt.match(/(?:open|launch|go\s+to)\s+(?:the\s+|my\s+)?youtube\s+(?:and|then|to)\s+(?:search\s+(?:for\s+)?|play\s+|start\s+|watch\s+|find\s+)?(.+)/i);
    if (compoundYtMatch) {
      const rawQ = compoundYtMatch[1].trim();
      const isAny = /^(?:any|some|a|random)?\s*(?:video|videos|song|songs)?$/i.test(rawQ) || rawQ.toLowerCase() === 'any' || !rawQ;
      const cleanQ = isAny ? '' : rawQ.replace(/^(?:search\s+(?:for\s+)?|play\s+|start\s+|watch\s+|find\s+)/i, '').trim();

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: !isAny && cleanQ ? `Search and Play "${cleanQ}" on YouTube` : 'Open YouTube and Start Video',
        description: !isAny && cleanQ ? `Search "${cleanQ}" and stream top result on YouTube.` : 'Launch YouTube and initiate video playback.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'PLAY_YOUTUBE', payload: { query: cleanQ } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: !isAny && cleanQ ? `Searching "${cleanQ}" on YouTube and starting playback.` : 'Opened YouTube and started video playback.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // 2. Direct Search on YouTube: "search <query> on/in youtube", "find <query> on/in youtube"
    const searchOnYtMatch = prompt.match(/(?:search|find)\s+(?:for\s+)?(.+?)\s+(?:on|in)\s+youtube$/i);
    if (searchOnYtMatch) {
      const rawQ = searchOnYtMatch[1].trim();
      const isAny = /^(?:any|some|a|random)?\s*(?:video|videos|song|songs)?$/i.test(rawQ) || rawQ.toLowerCase() === 'any' || !rawQ;
      const cleanQ = isAny ? '' : rawQ;

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: cleanQ ? `Search and Play "${cleanQ}" on YouTube` : 'Open YouTube and Start Video',
        description: cleanQ ? `Search "${cleanQ}" and start playback on YouTube.` : 'Launch YouTube and start video playback.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'PLAY_YOUTUBE', payload: { query: cleanQ } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: cleanQ ? `Searching "${cleanQ}" on YouTube and starting playback.` : 'Opened YouTube and started video playback.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // 3. Direct Play / Watch / Start on YouTube: "play/watch/start <query> on youtube"
    const playOnYtMatch = prompt.match(/(?:play|watch|start|listen\s+to|stream)\s+(?:the\s+)?(?:video\s+(?:of\s+)?|song|songs|music)?\s*(.+?)\s+(?:on|in)\s+youtube$/i);
    if (playOnYtMatch) {
      const rawQ = playOnYtMatch[1].trim();
      const isAny = /^(?:any|some|a|random)?\s*(?:video|videos|song|songs)?$/i.test(rawQ) || rawQ.toLowerCase() === 'any' || !rawQ;
      const cleanQ = isAny ? '' : rawQ;

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: cleanQ ? `Play "${cleanQ}" on YouTube` : 'Open YouTube and Start Video',
        description: cleanQ ? `Play "${cleanQ}" on YouTube in default browser.` : 'Launch YouTube and start video playback.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'PLAY_YOUTUBE', payload: { query: cleanQ } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: cleanQ ? `Playing "${cleanQ}" on YouTube.` : 'Opened YouTube and started video playback.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // 4. "youtube (search|play|find|watch|start) <query>"
    const ytPrefixMatch = prompt.match(/^youtube\s+(?:search|play|find|watch|start)\s+(.+)/i);
    if (ytPrefixMatch) {
      const cleanQ = ytPrefixMatch[1].trim();
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Play "${cleanQ}" on YouTube`,
        description: `Stream "${cleanQ}" on YouTube in default browser.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'PLAY_YOUTUBE', payload: { query: cleanQ } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: `Playing "${cleanQ}" on YouTube.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // 5. Simple Open YouTube ("open youtube", "open the youtube", "launch youtube", "go to youtube", "youtube khol do")
    if (
      /^(?:open|launch|start|go\s+to|show|access)\s+(?:the\s+|my\s+|our\s+)?(?:website\s+)?youtube(?:\s+(?:website|app|page|in\s+browser))?$/i.test(prompt) ||
      /^youtube\s+(?:karo|open|khol\s*do|chalu\s*karo)?$/i.test(prompt) ||
      q === 'open youtube' ||
      q === 'launch youtube' ||
      q === 'youtube'
    ) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Open YouTube',
        description: 'Launch YouTube in the default browser.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'OPEN_URL', payload: { url: 'https://www.youtube.com' } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Opened YouTube in your browser.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 2: Multi-Action: Open YouTube + Scroll ("open youtube then scroll down", "open youtube and scroll down")
    if (/\byoutube\b/i.test(prompt) && /\b(?:scroll|page)\s+(?:down|up)\b/i.test(prompt)) {
      const isUp = /\bup\b/i.test(prompt);
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Open YouTube',
        description: 'Launch YouTube in the default browser.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'OPEN_URL', payload: { url: 'https://www.youtube.com' } },
      });
      steps.push({
        id: crypto.randomUUID(),
        order: 2,
        title: `Scroll ${isUp ? 'Up' : 'Down'} on YouTube`,
        description: `Scroll screen content.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SCROLL_PAGE', payload: { direction: isUp ? 'UP' : 'DOWN', amount: 2 } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: `Opened YouTube and scrolled ${isUp ? 'up' : 'down'}.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 3: Select and Play YouTube video by index ("play the 2nd video", "play second video on my screen", "play 1st video")
    const videoIndexMatch = prompt.match(/(?:play|watch|click|start)\s+(?:the\s+)?([0-9]+(?:st|nd|rd|th)?|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+video\b/i);
    if (videoIndexMatch) {
      const ord = videoIndexMatch[1].toLowerCase();
      const numMap: Record<string, number> = {
        '1st': 1, 'first': 1, '1': 1,
        '2nd': 2, 'second': 2, '2': 2,
        '3rd': 3, 'third': 3, '3': 3,
        '4th': 4, 'fourth': 4, '4': 4,
        '5th': 5, 'fifth': 5, '5': 5,
      };
      const idx = numMap[ord] || 2;
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Play Video #${idx} on Screen`,
        description: `Select and trigger playback for video #${idx} on YouTube.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'PLAY_YOUTUBE_VIDEO', payload: { indexOrName: idx } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: `Playing video #${idx} on YouTube.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 4: Scroll Screen Up / Down ("scroll down", "scroll up", "scroll page down", "scroll to bottom")
    const scrollMatch = prompt.match(/^(?:please\s+)?(?:scroll|page)\s+(?:the\s+(?:screen|page|window)\s+)?(down|up|top|bottom)\b/i)
      || prompt.match(/\b(?:scroll|page)\s+(down|up|top|bottom)\b/i);
    if (scrollMatch && !q.includes('youtube') && !q.includes('file')) {
      const dir = (scrollMatch[1] || 'down').toUpperCase() as 'UP' | 'DOWN' | 'TOP' | 'BOTTOM';
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Scroll Screen ${dir}`,
        description: `Scroll active workstation window ${dir.toLowerCase()}.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SCROLL_PAGE', payload: { direction: dir, amount: 2 } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: `Scrolled screen ${dir.toLowerCase()}.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 5: Google & Web Search ("search abcd on google", "search for abcd on web", "google abcd", "search abcd")
    const googleMatch =
      prompt.match(/(?:search|find)\s+(?:for\s+)?(.+?)\s+(?:on|in)\s+(?:google|web|internet)$/i) ||
      prompt.match(/^google\s+(.+)/i) ||
      prompt.match(/(?:open|launch)\s+google\s+(?:and|then|to)\s+(?:search\s+(?:for\s+)?)(.+)/i);
    if (googleMatch) {
      const searchQ = googleMatch[1].trim();
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Search on Google: ${searchQ}`,
        description: `Open Google and search for "${searchQ}" in the default browser.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'OPEN_URL', payload: { url: `https://www.google.com/search?q=${encodeURIComponent(searchQ)}` } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: `Searching "${searchQ}" on Google.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 5B: General Search ("search abcd", "search for python tutorial") when not file/folder/process
    const generalSearchMatch = prompt.match(/^(?:search|search\s+for|browse|look\s+up)\s+["']?([^"'\n\r]+)["']?$/i);
    if (generalSearchMatch && !q.includes('file') && !q.includes('folder') && !q.includes('directory') && !q.includes('disk') && !q.includes('process')) {
      const searchQ = generalSearchMatch[1].trim();
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Search Google for: ${searchQ}`,
        description: `Search "${searchQ}" on Google using the default browser.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'OPEN_URL', payload: { url: `https://www.google.com/search?q=${encodeURIComponent(searchQ)}` } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: `Searching "${searchQ}" on Google.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 6: WhatsApp Calling & Messaging ("open whatsapp and send hello to rahul", "send good morning to mom on whatsapp")
    if (
      /\bwhatsapp\b/i.test(prompt) ||
      ((/\b(?:call|calling)\b/i.test(prompt) || /\b(?:send|message|text)\b/i.test(prompt)) && /\b(?:on|via)\s+whatsapp\b/i.test(prompt))
    ) {
      const isCall = /\b(?:call|calling|dial|ring)\b/i.test(prompt);

      let contact = '';
      let message = '';

      const text = prompt.replace(/\b(?:on|via)\s+whatsapp\b/i, '').trim();

      // Pattern 1: "open whatsapp and send <message> to <contact>" OR "send <message> to <contact>"
      const sendToMatch = text.match(/(?:open\s+whatsapp\s+and\s+)?send\s+(?:a\s+message\s+)?(.+?)\s+to\s+([a-zA-Z0-9_\+\s]+)$/i);
      if (sendToMatch) {
        const candMsg = sendToMatch[1].trim();
        const candContact = sendToMatch[2].trim();
        if (candContact && !/^(?:whatsapp|chat|text|app)$/i.test(candContact)) {
          message = candMsg.replace(/^(?:message\s+|a\s+message\s+)/i, '').replace(/^["']|["']$/g, '').trim();
          contact = candContact;
        }
      }

      // Pattern 2: "send/message <contact> saying/with/that <message>"
      if (!contact || !message) {
        const sayingMatch = text.match(/(?:message|send\s+(?:a\s+)?(?:message\s+)?to|text)\s+([a-zA-Z0-9_\+]+)\s+(?:saying|with|that)\s+["']?([^"'\n\r]+)["']?/i);
        if (sayingMatch) {
          contact = sayingMatch[1].trim();
          message = sayingMatch[2].replace(/^["']|["']$/g, '').trim();
        }
      }

      // Pattern 3: "open whatsapp and message <contact> <message>" OR "message <contact> <message>"
      if (!contact || !message) {
        const directMatch = text.match(/(?:open\s+whatsapp\s+and\s+)?(?:message|text)\s+([a-zA-Z0-9_\+]+)\s+(.+)$/i);
        if (directMatch) {
          const candContact = directMatch[1].trim();
          const candMsg = directMatch[2].trim();
          if (!/^(?:whatsapp|someone|somebody|anyone)$/i.test(candContact)) {
            contact = candContact;
            message = candMsg.replace(/^["']|["']$/g, '').trim();
          }
        }
      }

      // Pattern 4: Check if phone number is explicitly present
      const phoneMatch = text.match(/\b(\+?[0-9]{10,14})\b/);
      if (phoneMatch) {
        contact = phoneMatch[1];
        if (!message) {
          const cleaned = text.replace(phoneMatch[1], '').replace(/^(?:open\s+whatsapp\s+and\s+)?(?:send|message|text|to)\s+/i, '').trim();
          if (cleaned) message = cleaned;
        }
      }

      // Fallback contact to authorized number from .env if generic or omitted
      if (!contact || /^(?:someone|somebody|anyone|whatsapp)$/i.test(contact)) {
        const authNums = (process.env.WHATSAPP_AUTHORIZED_NUMBER || '').split(',').map((s) => s.trim()).filter(Boolean);
        contact = authNums[0] || '';
      }

      // Common greetings if message empty
      if (!message && !isCall) {
        const greetMatch = text.match(/\b(hello|hi|hey|how\s+are\s+you|good\s+morning|good\s+evening)\b/i);
        message = greetMatch ? greetMatch[0] : 'Hello! Sent via OpenDesk AI';
      }

      if (/^(?:someone|somebody|anyone|whatsapp|on\s+whatsapp)$/i.test(message)) {
        message = 'Hello! Sent via OpenDesk AI';
      }

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: isCall ? `WhatsApp Call: ${contact}` : `Send WhatsApp Message to ${contact}`,
        description: isCall
          ? `Initiate WhatsApp call with "${contact}".`
          : `Send WhatsApp message to "${contact}": "${message}".`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'WHATSAPP_ACTION',
          payload: { action: isCall ? 'CALL' : 'CHAT', contact, message },
        },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: isCall ? `Calling ${contact} on WhatsApp.` : `Sending message to ${contact} on WhatsApp: "${message}".`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 3: Alarm / Timer / Clock ("set alarm at 7 am", "set alarm for 6:30", "set timer for 10 minutes", "open alarms")
    if (/\b(?:alarm|timer|clock)\b/i.test(prompt) && !q.includes('file')) {
      const timeMatch = prompt.match(/(?:for|at)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?|[0-9]+\s*(?:minute|minutes|min|mins|hour|hours|sec|seconds))/i);
      const timeStr = timeMatch ? timeMatch[1].trim() : '';

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Set Alarm / Timer${timeStr ? `: ${timeStr}` : ''}`,
        description: `Open Windows Clock and configure alarm/timer${timeStr ? ` for ${timeStr}` : ''}.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SET_ALARM', payload: { timeOrQuery: timeStr } },
      });
      return {
        taskId,
        userPrompt: prompt,
        summary: timeStr ? `Alarm set for ${timeStr}.` : 'Opened Windows Clock & Alarms.',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 4: Edit File ("edit file notes.txt and write hello world", "edit task one file saying done")
    const editMatch = prompt.match(/(?:edit|update|append\s+to|write\s+to)\s+(?:a\s+)?(?:the\s+)?(?:file|doc|document)?\s*["']?([^"'\n\r]+?)["']?\s+(?:and\s+|with\s+)?(?:write|add|type|insert|saying)\s*["']?([^"'\n\r]+)["']?/i);
    if (editMatch) {
      let targetFile = editMatch[1].trim()
        .replace(/^(?:the\s+)?(?:file|doc|document)\s+/i, '')
        .replace(/\s+(?:file|doc|document)$/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .trim();
      const content = editMatch[2].trim();

      if (targetFile) {
        steps.push({
          id: crypto.randomUUID(),
          order: 1,
          title: `Edit file: "${targetFile}"`,
          description: `Write changes to "${targetFile}".`,
          type: 'AUTOMATED',
          status: 'PENDING',
          action: {
            tool: 'EDIT_FILE',
            payload: { target: targetFile, content, append: true },
          },
        });
        return {
          taskId,
          userPrompt: prompt,
          summary: `Updated "${targetFile}" with specified content.`,
          createdAt: new Date().toISOString(),
          currentStepIndex: 0,
          steps,
          isComplete: false,
        };
      }
    }

    // Case 5: Create and Open / Create File (e.g. "create and open task one file in desktop", "create task one file in desktop", "make file notes on desktop")
    const createAndOpenMatch = prompt.match(/(?:make|create|new|write)(?:\s+and\s+(?:open|launch))?\s+(?:a\s+)?(?:new\s+)?(?:text\s+file|file|document|doc|note|notes)?\s*["']?([^"'\n\r]+?)["']?(?:\s+(?:in|on)\s+(?:desktop|documents|downloads))?$/i);
    if (createAndOpenMatch && !q.includes('folder') && !q.includes('dir') && !q.includes('directory')) {
      let rawFileName = (createAndOpenMatch[1] || '').trim();
      rawFileName = rawFileName
        .replace(/^(?:the\s+)?(?:file|doc|document)\s+/i, '')
        .replace(/\s+(?:file|doc|document)$/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (rawFileName) {
        if (!path.extname(rawFileName)) {
          rawFileName += '.txt';
        }

        steps.push({
          id: crypto.randomUUID(),
          order: 1,
          title: `Create file: "${rawFileName}"`,
          description: `Create text document on Desktop.`,
          type: 'AUTOMATED',
          status: 'PENDING',
          action: {
            tool: 'CREATE_FILE',
            payload: { target: rawFileName },
          },
          verificationCheck: {
            type: 'FILE_EXISTS',
            target: rawFileName,
          },
        });

        // If user specifically asked to "and open"
        if (/\band\s+(?:open|launch)\b/i.test(prompt) || /\bopen\b/i.test(prompt)) {
          steps.push({
            id: crypto.randomUUID(),
            order: 2,
            title: `Open file: "${rawFileName}"`,
            description: `Launch created document in default system editor.`,
            type: 'AUTOMATED',
            status: 'PENDING',
            action: {
              tool: 'OPEN_LOCATION',
              payload: { path: rawFileName },
            },
          });
        }

        return {
          taskId,
          userPrompt: prompt,
          summary: `Created ${/\band\s+open\b/i.test(prompt) || /\bopen\b/i.test(prompt) ? 'and opened ' : ''}"${rawFileName}" on your Desktop.`,
          createdAt: new Date().toISOString(),
          currentStepIndex: 0,
          steps,
          isComplete: false,
        };
      }
    }

    // Case -5: System Actions (Screenshot, Empty Trash, Volume, Mute)
    if (/(?:take|capture)\s+(?:a\s+)?screenshot/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Capture Desktop Screenshot',
        description: 'Take screenshot of current display and save to Desktop.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'SCREENSHOT' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Captured screenshot of your display.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    if (/(?:empty|clear)\s+(?:the\s+)?(?:recycle\s*bin|trash)/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Empty Windows Recycle Bin',
        description: 'Permanently remove deleted files from Recycle Bin.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'EMPTY_TRASH' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Emptied the Recycle Bin.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    if (/^(?:mute|unmute)\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Toggle Audio Mute',
        description: 'Toggle system master audio volume mute state.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'MUTE' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Toggled system audio mute.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    if (/^(?:volume\s+up|increase\s+volume)\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Increase Volume',
        description: 'Turn up master audio volume.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'VOLUME_UP' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Increased system volume.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    if (/^(?:volume\s+down|decrease\s+volume)\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Decrease Volume',
        description: 'Turn down master audio volume.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'VOLUME_DOWN' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Decreased system volume.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    // Siri Extra: Lock Workstation / PC
    if (/\b(?:lock\s+(?:screen|pc|computer|my\s+pc|my\s+screen|workstation))\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Lock PC',
        description: 'Lock workstation display.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'LOCK_SCREEN' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Locked your workstation.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    // Siri Extra: Next Track / Skip
    if (/\b(?:next\s+(?:song|track)|skip\s+song)\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Next Track',
        description: 'Skip to next music track.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'NEXT_TRACK' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Skipped to next track.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    // Siri Extra: Previous Track
    if (/\b(?:previous\s+(?:song|track)|prev\s+track)\b/i.test(prompt)) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Previous Track',
        description: 'Back to previous music track.',
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'SYSTEM_ACTION', payload: { action: 'PREV_TRACK' } },
      });
      return { taskId, userPrompt: prompt, summary: 'Playing previous track.', createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    // Siri Extra: Current Time
    if (/^(?:what\s+is\s+the\s+time|what\s+time\s+is\s+it|tell\s+me\s+the\s+time|current\s+time)\b/i.test(prompt)) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Current Time',
        description: `It is currently ${timeStr}.`,
        type: 'AUTOMATED',
        status: 'COMPLETED',
        output: `It is ${timeStr}.`,
      });
      return { taskId, userPrompt: prompt, summary: `It is currently ${timeStr}.`, createdAt: new Date().toISOString(), currentStepIndex: 1, steps, isComplete: true };
    }

    // Siri Extra: Current Date
    if (/^(?:what\s+is\s+today's\s+date|what\s+date\s+is\s+it|today's\s+date|what\s+day\s+is\s+it)\b/i.test(prompt)) {
      const dateStr = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: 'Current Date',
        description: `Today is ${dateStr}.`,
        type: 'AUTOMATED',
        status: 'COMPLETED',
        output: `Today is ${dateStr}.`,
      });
      return { taskId, userPrompt: prompt, summary: `Today is ${dateStr}.`, createdAt: new Date().toISOString(), currentStepIndex: 1, steps, isComplete: true };
    }

    // Case -4: Delete / Remove Files or Folders
    const quickDeleteMatch = prompt.match(/(?:delete|remove|erase|destroy)\s+(?:a\s+)?(?:the\s+)?(?:file|folder|directory|doc|document)?\s*["']?([^"'\n\r]+)["']?/i);
    if (quickDeleteMatch && !q.includes('cache') && !q.includes('node_modules')) {
      let rawTarget = quickDeleteMatch[1].trim();
      rawTarget = rawTarget
        .replace(/^(?:the\s+)?(?:file|folder|directory|doc|document)\s+/i, '')
        .replace(/\s+(?:file|folder|directory|doc|document)$/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (rawTarget) {
        steps.push({
          id: crypto.randomUUID(),
          order: 1,
          title: `Delete: "${rawTarget}"`,
          description: `Locate and remove "${rawTarget}" from filesystem.`,
          type: 'AUTOMATED',
          status: 'PENDING',
          action: {
            tool: 'DELETE_TARGET',
            payload: { target: rawTarget },
          },
        });
        return { taskId, userPrompt: prompt, summary: `Deleted "${rawTarget}".`, createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
      }
    }

    // Case -3: Close / Kill Application
    const closeMatch = prompt.match(/(?:close|kill|quit|terminate|exit)\s+(?:app\s+|application\s+)?([a-zA-Z0-9_\-\.\s]+)/i);
    if (closeMatch && !q.includes('tab') && !q.includes('window') && !q.includes('file')) {
      const appName = closeMatch[1].trim();
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Close application: ${appName}`,
        description: `Terminate running process for "${appName}".`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'CLOSE_APP', payload: { appName } },
      });
      return { taskId, userPrompt: prompt, summary: `Closed application "${appName}".`, createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    // Case -2: Open Website / URL
    const urlMatch = prompt.match(/(?:open|go\s+to|browse|visit)\s+(?:website\s+)?(https?:\/\/[^\s]+|youtube|google|github|gmail|reddit|twitter|chatgpt|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i);
    if (urlMatch && !q.includes('file') && !q.includes('folder') && !q.includes('directory')) {
      const url = urlMatch[1].trim();
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Open in browser: ${url}`,
        description: `Launch web browser and navigate to "${url}".`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: { tool: 'OPEN_URL', payload: { url } },
      });
      return { taskId, userPrompt: prompt, summary: `Opened ${url} in browser.`, createdAt: new Date().toISOString(), currentStepIndex: 0, steps, isComplete: false };
    }

    // Case -1A: Create Folder or Directory
    let rawFolderName: string | null = null;
    const folderMatch = prompt.match(/(?:make|create|new|mkdir)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory|dir)\s*(?:named|called)?\s*["']?([^"'\n\r]+)?["']?/i);
    if (folderMatch) {
      rawFolderName = (folderMatch[1] || '').trim();
    } else {
      const folderMatch2 = prompt.match(/(?:make|create|new)\s+(?:a\s+)?["']?([^"'\n\r]+?)["']?\s+(?:folder|directory|dir)/i);
      if (folderMatch2) rawFolderName = folderMatch2[1].trim();
    }

    if (rawFolderName !== null) {
      const cleanName = rawFolderName
        .replace(/^(?:on|in)\s+desktop\s*/i, '')
        .replace(/\s+(?:on|in)\s+desktop$/i, '')
        .replace(/\s+(?:folder|directory|dir)$/i, '')
        .trim() || 'New Folder';

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Create folder: "${cleanName}"`,
        description: `Create directory on Windows Desktop and reveal in File Explorer.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'CREATE_DIRECTORY',
          payload: { path: cleanName },
        },
        verificationCheck: {
          type: 'FILE_EXISTS',
          target: cleanName,
        },
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Created folder "${cleanName}" on your Desktop.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case -1B: Create File or Document (e.g. "create file notes.txt", "make a text file ideas", "new document summary.txt")
    const fileCreateMatch = prompt.match(/(?:make|create|new|write)\s+(?:a\s+)?(?:new\s+)?(?:text\s+file|file|document|note|notes)\s*(?:named|called)?\s*["']?([^"'\n\r]+)?["']?/i);
    if (fileCreateMatch) {
      let rawFileName = (fileCreateMatch[1] || '').trim();
      rawFileName = rawFileName
        .replace(/^(?:the\s+)?(?:file|doc|document)\s+/i, '')
        .replace(/\s+(?:file|doc|document)$/i, '')
        .replace(/^["']|["']$/g, '')
        .trim() || 'untitled.txt';

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Create file: "${rawFileName}"`,
        description: `Create text document on Desktop and open in default editor.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'CREATE_FILE',
          payload: { target: rawFileName },
        },
        verificationCheck: {
          type: 'FILE_EXISTS',
          target: rawFileName,
        },
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Created file "${rawFileName}" on your Desktop.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 0: Direct Open File, Document, or Location (e.g. "open devl 2 file", "open word file devl 2", "open file devl 2", "open devl 2.docx")
    const isFileTarget =
      /\b(?:file|document|doc|pdf|word|excel|sheet|txt|docx|xlsx|location|path|folder|directory)\b/i.test(prompt) ||
      /\.[a-zA-Z0-9]{2,4}\b/i.test(prompt);

    if (isFileTarget) {
      const openDocMatch =
        prompt.match(/(?:open|explore|reveal|launch|show)\s+(?:a\s+)?(?:the\s+)?(?:word\s+|pdf\s+|excel\s+|text\s+)?(?:file|document|doc|sheet|location|path)?\s*["']?([^"'\n\r]+)["']?/i) ||
        prompt.match(/(?:find\s+and\s+open|search\s+and\s+open)\s+["']?([^"'\n\r]+)["']?/i);

      if (openDocMatch) {
        let rawTarget = openDocMatch[1].trim();
        // Thoroughly strip descriptors from BOTH front and end (e.g. "devl 2 file" -> "devl 2")
        rawTarget = rawTarget
          .replace(/^(?:the\s+)?(?:word|pdf|excel|text)?\s*(?:file|document|doc|sheet|folder|directory)\s+/i, '')
          .replace(/\s+(?:word|pdf|excel|text)?\s*(?:file|document|doc|sheet|folder|directory)$/i, '')
          .replace(/^["']|["']$/g, '')
          .trim();

        if (rawTarget) {
          const isFolder = q.includes('folder') || q.includes('dir');
          steps.push({
            id: crypto.randomUUID(),
            order: 1,
            title: `Locate and open ${isFolder ? 'folder' : 'file'}: "${rawTarget}"`,
            description: `Search user directories and open "${rawTarget}" with default application.`,
            type: 'AUTOMATED',
            status: 'PENDING',
            action: {
              tool: 'OPEN_LOCATION',
              payload: { path: rawTarget },
            },
            verificationCheck: {
              type: 'FILE_EXISTS',
              target: rawTarget,
            },
          });

          return {
            taskId,
            userPrompt: prompt,
            summary: `Located and opened "${rawTarget}" on your workstation.`,
            createdAt: new Date().toISOString(),
            currentStepIndex: 0,
            steps,
            isComplete: false,
          };
        }
      }
    }

    // Case 1: Search and Open Applications (e.g. "search and open workbench", "open chrome")
    const appMatch = prompt.match(/(?:search\s+and\s+|find\s+and\s+)?(?:open|launch|start|run)\s+(?:app\s+|application\s+)?([a-zA-Z0-9_\-\.\s]+)/i);
    if (appMatch && !q.includes('directory') && !q.includes('folder') && !q.includes('file')) {
      const appName = appMatch[1].trim();

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Search and locate application: ${appName}`,
        description: `Query Windows StartApps and program registries for "${appName}" executable.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'LAUNCH_APP',
          payload: { appName },
        },
        verificationCheck: {
          type: 'PROCESS_RUNNING',
          target: appName,
        },
      });

      steps.push({
        id: crypto.randomUUID(),
        order: 2,
        title: `Verify ${appName} window instance`,
        description: `Ensure the application window has loaded and is ready for interaction.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        verificationCheck: {
          type: 'PROCESS_RUNNING',
          target: appName,
        },
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Launch and verify ${appName} on host workstation.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 2: Process Termination (Requires Permission)
    const killMatch = prompt.match(/(?:kill|terminate|stop)\s+(?:process\s+|pid\s+)?(\d+)/i);
    if (killMatch) {
      const pid = parseInt(killMatch[1], 10);

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Permission Gate: Terminate Process PID ${pid}`,
        description: `Confirm termination of active system process to prevent data loss.`,
        type: 'REQUIRES_PERMISSION',
        status: 'WAITING_APPROVAL',
        action: {
          tool: 'EXECUTE_COMMAND',
          payload: { command: `taskkill /F /PID ${pid}` },
        },
      });

      steps.push({
        id: crypto.randomUUID(),
        order: 2,
        title: `Verify process termination`,
        description: `Check process table to confirm PID ${pid} is no longer running.`,
        type: 'AUTOMATED',
        status: 'PENDING',
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Terminate and verify process PID ${pid}.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 3: Destructive File Operation (Requires Permission)
    const deleteMatch = prompt.match(/(?:delete|remove|erase|del|rm)\s+(?:file\s+|folder\s+|directory\s+)?([a-zA-Z0-9_\-\.\\\/\:]+)/i);
    if (deleteMatch && !q.includes('node_modules') && !q.includes('cache pool')) {
      const targetFile = deleteMatch[1].trim();

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Permission Gate: Permanently Delete "${targetFile}"`,
        description: `High-risk operation: deleting files from disk cannot be undone. User confirmation required.`,
        type: 'REQUIRES_PERMISSION',
        status: 'WAITING_APPROVAL',
        action: {
          tool: 'EXECUTE_COMMAND',
          payload: { command: `powershell -Command "Remove-Item -Path '${targetFile}' -Recurse -Force -ErrorAction SilentlyContinue"` },
        },
      });

      steps.push({
        id: crypto.randomUUID(),
        order: 2,
        title: `Verify deletion of "${targetFile}"`,
        description: `Confirm filesystem node is removed and disk resources freed.`,
        type: 'AUTOMATED',
        status: 'PENDING',
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Delete "${targetFile}" with safety permission gate.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 4: Manual Setup, Installation, or Authentication Action
    const setupMatch = prompt.match(/(?:install|setup|configure|login|authenticate|sign in)\s+(?:to\s+|for\s+)?([a-zA-Z0-9_\-\.\s]+)/i);
    if (setupMatch) {
      const subject = setupMatch[1].trim();

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Pre-check system for ${subject}`,
        description: `Evaluate environment variables and path availability for ${subject}.`,
        type: 'AUTOMATED',
        status: 'PENDING',
      });

      steps.push({
        id: crypto.randomUUID(),
        order: 2,
        title: `Manual Action Required: Configure / Authenticate ${subject}`,
        description: `Human-in-the-loop manual task required by user on host workstation.`,
        type: 'MANUAL_USER_ACTION',
        status: 'WAITING_MANUAL',
        manualInstructions: [
          `1. Open your browser or terminal to perform authentication for ${subject}.`,
          `2. Complete any required 2-factor authentication, security prompt, or license agreement.`,
          `3. Save your credentials or finish the installer wizard on your screen.`,
          `4. Click the "[Verify & Continue]" button below to allow OpenDesk AI to validate your action.`,
        ],
        verificationCheck: {
          type: 'PROCESS_RUNNING',
          target: subject,
        },
      });

      steps.push({
        id: crypto.randomUUID(),
        order: 3,
        title: `Post-configuration verification`,
        description: `Confirm ${subject} is operational and continue workspace tasks.`,
        type: 'AUTOMATED',
        status: 'PENDING',
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Interactive manual setup & verification for ${subject}.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 5: File Search and Open
    const fileMatch = prompt.match(/(?:find|search|locate)\s+file\s*(.*)/i);
    if (fileMatch) {
      const searchTarget = fileMatch[1].trim() || 'file';

      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Search user directories for: ${searchTarget}`,
        description: `Scan ~/Projects, ~/Documents, and Desktop for matching files.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'FIND_FILE',
          payload: { query: searchTarget },
        },
      });

      steps.push({
        id: crypto.randomUUID(),
        order: 2,
        title: `Inspect and verify file results`,
        description: `Validate file paths and present direct actions to open or edit.`,
        type: 'AUTOMATED',
        status: 'PENDING',
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Search and locate files matching "${searchTarget}".`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 6: Clean Temporary Files & Cache
    if (q.includes('clean') && (q.includes('temp') || q.includes('cache') || q.includes('ram') || q.includes('junk'))) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Clean Windows Temporary Files`,
        description: `Purge junk files from %TEMP% and user application cache.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'EXECUTE_COMMAND',
          payload: {
            command: `powershell -Command "Get-ChildItem -Path $env:TEMP -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; Write-Output 'Successfully cleaned Windows temp directory and recovered disk space.'"`
          },
        },
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Clean temporary files and system cache.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 7: Flush DNS & Network Refresh
    if (q.includes('flush') && q.includes('dns') || q.includes('network reset')) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Flush Windows DNS Cache`,
        description: `Reset DNS resolver cache to clear stale network routes.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'EXECUTE_COMMAND',
          payload: { command: `powershell -Command "Clear-DnsClientCache; Write-Output 'Windows DNS resolver cache successfully flushed.'"` },
        },
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Flush DNS resolver cache.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 8: Check Disk Space
    if (q.includes('disk') || q.includes('storage') || q.includes('drives')) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Inspect System Storage & Drives`,
        description: `Measure total, used, and free capacity across all mounted filesystems.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'EXECUTE_COMMAND',
          payload: {
            command: `powershell -Command "Get-PSDrive -PSProvider 'FileSystem' | Select-Object Name, @{Name='Free_GB';Expression={[math]::Round($_.Free/1GB,2)}}, @{Name='Total_GB';Expression={[math]::Round(($_.Used+$_.Free)/1GB,2)}} | Format-Table -AutoSize"`
          },
        },
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Inspect system disk space and storage.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // Case 9: Inspect High-Resource Processes
    if (q.includes('process') && (q.includes('top') || q.includes('heavy') || q.includes('resource') || q.includes('cpu') || q.includes('memory') || q.includes('list'))) {
      steps.push({
        id: crypto.randomUUID(),
        order: 1,
        title: `Identify Top Resource-Consuming Processes`,
        description: `Sort processes by RAM and CPU utilization.`,
        type: 'AUTOMATED',
        status: 'PENDING',
        action: {
          tool: 'EXECUTE_COMMAND',
          payload: {
            command: `powershell -Command "Get-Process | Sort-Object -Descending WS | Select-Object -First 5 ProcessName, @{Name='Memory_MB';Expression={[math]::Round($_.WS/1MB,2)}}, CPU | Format-Table -AutoSize"`
          },
        },
      });

      return {
        taskId,
        userPrompt: prompt,
        summary: `Identify top resource-consuming processes.`,
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps,
        isComplete: false,
      };
    }

    // If prompt is just a bare verb with no target, ask for clarification
    if (/^(?:open|launch|start|run|play)$/i.test(prompt.trim())) {
      return {
        taskId,
        userPrompt: prompt,
        summary: 'Please specify what you would like to open, such as "open YouTube" or "open Chrome".',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps: [],
        isComplete: true,
      };
    }

    // Default Multi-Step Workstation Task - Always execute actionable tool on PC
    let fallbackTool: any = 'OPEN_URL';
    let fallbackPayload: any = { url: `https://www.google.com/search?q=${encodeURIComponent(prompt)}` };
    let fallbackTitle = `Search query: ${prompt}`;

    if (/^(?:open|launch|start|run)\s+(.+)/i.test(prompt)) {
      const target = prompt.replace(/^(?:open|launch|start|run)\s+/i, '').trim();
      fallbackTool = 'LAUNCH_APP';
      fallbackPayload = { appName: target };
      fallbackTitle = `Launch application: ${target}`;
    }

    steps.push({
      id: crypto.randomUUID(),
      order: 1,
      title: fallbackTitle,
      description: `Execute "${prompt}" on your workstation.`,
      type: 'AUTOMATED',
      status: 'PENDING',
      action: { tool: fallbackTool, payload: fallbackPayload },
    });

    return {
      taskId,
      userPrompt: prompt,
      summary: `Executed on your workstation: "${prompt}"`,
      createdAt: new Date().toISOString(),
      currentStepIndex: 0,
      steps,
      isComplete: false,
    };
  }
}

export const taskPlannerService = new TaskPlannerService();
