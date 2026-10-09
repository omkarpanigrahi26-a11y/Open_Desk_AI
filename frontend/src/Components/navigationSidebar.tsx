import React from 'react';
import { NAVIGATION_ITEMS } from '../Config/navigation';
import type { AppRoutePath } from '../Config/routes';

interface NavigationSidebarProps {
  activeRoute: AppRoutePath;
  onNavigate: (route: AppRoutePath) => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeRoute,
  onNavigate,
}) => {
  return (
    <aside className="w-16 flex-shrink-0 bg-[#0e1015] border-r border-border-subtle flex flex-col justify-between items-center pt-3 pb-3 select-none h-full z-20">
      {/* 1. Navigation Icons Stack starting at the top directly below the header */}
      <nav className="flex flex-col items-center space-y-2 w-full">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive =
            activeRoute === item.path ||
            (item.path === '/chat' && (activeRoute as string) === '/');
          const Icon = item.icon;

          return (
            <div key={item.id} className="relative group w-full flex justify-center">
              <button
                onClick={() => onNavigate(item.path)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 relative ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-panel-elevated'
                }`}
                aria-label={item.label}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-indigo-500" />
                )}
                <Icon className="w-5 h-5" />
              </button>

              {/* Tooltip on Hover */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-panel-elevated text-slate-200 text-xs font-mono rounded-md shadow-xl border border-border-subtle whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                <span className="font-sans font-medium text-slate-100">{item.label}</span>
                <span className="ml-1.5 text-[10px] text-slate-400">[{item.shortcut}]</span>
              </div>
            </div>
          );
        })}
      </nav>

      {/* 2. Bottom System State Indicator */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-lg bg-panel-elevated border border-border-subtle flex items-center justify-center text-[10px] font-mono text-slate-400"
          title="Windows 64-bit Desktop"
        >
          PC
        </div>
      </div>
    </aside>
  );
};
