import { useState, useEffect, useCallback } from 'react';
import { APP_ROUTES } from './Config/routes';
import type { AppRoutePath } from './Config/routes';
import { getTodayDateString } from './Services/dailyChatStorage';

// Commonly used shared components
import { NavigationSidebar } from './Components/navigationSidebar';
import { TelemetryDrawer } from './Components/telemetryDrawer';

// All pages imported in App.tsx
import { AssistantChatPage } from './Pages/AssistantChat/assistantChatPage';
import { FileIndexerPage } from './Pages/FileIndexer/fileIndexerPage';
import { SystemTelemetryPage } from './Pages/SystemTelemetry/systemTelemetryPage';
import { TaskAutomationsPage } from './Pages/TaskAutomations/taskAutomationsPage';
import { AgentRouterPage } from './Pages/AgentRouter/agentRouterPage';
import { SettingsPage } from './Pages/Settings/settingsPage';

// Real-time telemetry hook & keyboard navigation hook
import { useTelemetryWs } from './Hooks/useTelemetryWs';
import { useKeyboardShortcuts } from './Hooks/useKeyboardShortcuts';
import { apiClient } from './Services/apiClient';
import { Calendar, ChevronRight, Activity } from 'lucide-react';

const pathToRoute = (pathname: string): AppRoutePath => {
  if (pathname === '/files') return APP_ROUTES.FILES;
  if (pathname === '/automations' || pathname === '/tasks') return APP_ROUTES.AUTOMATIONS;
  if (pathname === '/telemetry' || pathname === '/health') return APP_ROUTES.TELEMETRY;
  if (pathname === '/settings') return APP_ROUTES.SETTINGS;
  if (pathname === '/router') return APP_ROUTES.ROUTER;
  return APP_ROUTES.CHAT;
};

export function App() {
  const [activeRoute, setActiveRoute] = useState<AppRoutePath>(() =>
    pathToRoute(window.location.pathname)
  );
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [savingsMetrics, setSavingsMetrics] = useState<any>({
    percentageSaved: 78.4,
    totalTokensSavedToday: 184200,
    estimatedUsdSavings: 2.84,
  });

  const { telemetry } = useTelemetryWs();
  const todayStr = getTodayDateString(); // Strict format: DD-MM-YYYY

  // Synchronize route changes with browser history and address bar URL
  const navigateTo = useCallback((route: AppRoutePath) => {
    setActiveRoute(route);
    if (window.location.pathname !== route) {
      window.history.pushState(null, '', route);
    }
  }, []);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setActiveRoute(pathToRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Fetch real savings metrics for telemetry drawer
  useEffect(() => {
    apiClient
      .getSavingsMetrics()
      .then((res) => {
        if (res && res.data) {
          setSavingsMetrics(res.data);
        }
      })
      .catch(() => {
        // Retain initial metrics on network error
      });
  }, []);

  const handleFocusInput = useCallback(() => {
    navigateTo(APP_ROUTES.CHAT);
    window.dispatchEvent(new Event('opendesk_focus_input'));
  }, [navigateTo]);

  const handleToggleDrawer = useCallback(() => {
    setIsDrawerCollapsed((prev) => !prev);
  }, []);

  // Global mouse-free keyboard navigation
  useKeyboardShortcuts({
    onNavigate: navigateTo,
    onToggleDrawer: handleToggleDrawer,
    onFocusInput: handleFocusInput,
  });

  // Get current page label for header display
  const getPageTitle = () => {
    switch (activeRoute) {
      case APP_ROUTES.SETTINGS:
        return 'Settings';
      case APP_ROUTES.FILES:
        return 'Files & Documents';
      case APP_ROUTES.AUTOMATIONS:
        return 'Tasks & Automations';
      case APP_ROUTES.TELEMETRY:
        return 'PC Health & Telemetry';
      case APP_ROUTES.ROUTER:
        return 'Agent Router';
      case APP_ROUTES.CHAT:
      default:
        return 'Assistant Chat';
    }
  };

  // Route switcher mapping routes defined in Config/routes.ts to imported page components
  const renderCurrentView = () => {
    switch (activeRoute) {
      case APP_ROUTES.CHAT:
        return <AssistantChatPage />;
      case APP_ROUTES.FILES:
        return <FileIndexerPage />;
      case APP_ROUTES.TELEMETRY:
        return <SystemTelemetryPage />;
      case APP_ROUTES.AUTOMATIONS:
        return <TaskAutomationsPage />;
      case APP_ROUTES.ROUTER:
        return <AgentRouterPage />;
      case APP_ROUTES.SETTINGS:
        return <SettingsPage />;
      default:
        return <AssistantChatPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas text-slate-100 font-sans antialiased select-none">
      {/* 1. Seamless Unified Top Header (z-30) */}
      <header className="h-12 border-b border-border-subtle bg-[#0e1015] flex items-center justify-between flex-shrink-0 z-30">
        {/* Left Section: Houses Brand Logo (matching sidebar width exactly) */}
        <div className="flex items-center">
          <div className="w-16 h-12 flex items-center justify-center flex-shrink-0 border-r border-border-subtle/60">
            <button
              onClick={() => navigateTo(APP_ROUTES.CHAT)}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-mono font-bold text-xs shadow-sm hover:opacity-90 transition-opacity"
              title="OpenDesk AI Desktop"
            >
              OD
            </button>
          </div>

          {/* Current Page Title and Connection State */}
          <div className="flex items-center space-x-3 px-4 text-xs font-sans">
            <h1 className="font-semibold text-slate-100">{getPageTitle()}</h1>
            <span className="text-slate-600">|</span>
            <div className="flex items-center space-x-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-mono text-slate-400">Windows Host Active</span>
            </div>
          </div>
        </div>

        {/* Right Section: Session Date and PC Status Panel Toggle */}
        <div className="flex items-center space-x-3 px-4">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-panel px-2.5 py-1 rounded-lg border border-border-subtle">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>{todayStr}</span>
          </div>

          <button
            onClick={handleToggleDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-panel transition-colors border border-border-subtle/50"
            title="Toggle PC Status Panel (Ctrl+B)"
          >
            {isDrawerCollapsed ? (
              <Activity className="w-4 h-4 text-emerald-400" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* 2. Main Shell Layout: Sidebar + Fluid Canvas + Telemetry Drawer */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden relative">
        {/* Persistent Left Navigation Sidebar (Starting right beneath header) */}
        <NavigationSidebar
          activeRoute={activeRoute}
          onNavigate={navigateTo}
        />

        {/* Dynamic Center Canvas (Full Viewport Fluid Width) */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-canvas">
          {renderCurrentView()}
        </main>

        {/* Restored Right Telemetry Drawer (Omitting Desktop Context) */}
        <TelemetryDrawer
          telemetry={telemetry}
          savingsMetrics={savingsMetrics}
          isCollapsed={isDrawerCollapsed}
          onToggleCollapse={handleToggleDrawer}
        />
      </div>
    </div>
  );
}

export default App;
