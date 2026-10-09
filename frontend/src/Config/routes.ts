/**
 * Application Routes Configuration
 * Defines all page view routes and API/WebSocket endpoints used across OpenDesk AI.
 */

export const APP_ROUTES = {
  CHAT: '/chat',
  FILES: '/files',
  TELEMETRY: '/telemetry',
  AUTOMATIONS: '/automations',
  ROUTER: '/router',
  SETTINGS: '/settings',
} as const;

export type AppRouteKey = keyof typeof APP_ROUTES;
export type AppRoutePath = (typeof APP_ROUTES)[AppRouteKey];

export const BACKEND_CONFIG = {
  DEFAULT_HTTP_URL: 'http://localhost:8000',
  DEFAULT_WS_URL: 'ws://localhost:8000/ws/telemetry',
  ALT_HTTP_URL: 'http://localhost:3000',
  ALT_WS_URL: 'ws://localhost:3000/ws/telemetry',
};

export const API_ENDPOINTS = {
  DISPATCH: '/api/dispatch',
  SAVINGS_METRICS: '/api/dispatch/savings',
  FILES_SEARCH: '/api/files/search',
  FILES_REINDEX: '/api/files/reindex',
  REMOTE_STATUS: '/api/remote/status',
  WHATSAPP_WEBHOOK: '/api/webhook/whatsapp',
  TELEMETRY_WS: '/ws/telemetry',
  AGENT_RUN: '/api/agent/run',
  AGENT_APPROVE: '/api/agent/approve',
  AGENT_REJECT: '/api/agent/reject',
  AGENT_VERIFY: '/api/agent/verify',
  AGENT_TASK: '/api/agent/task',
} as const;
