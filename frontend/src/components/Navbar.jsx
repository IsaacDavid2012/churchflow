import React from 'react';
import { 
  Calendar, 
  Users, 
  Music, 
  Building2, 
  ShieldCheck,
  LogOut, 
  Sun,
  Moon
} from 'lucide-react';

export default function Navbar({ currentTab, setTab, user, theme = 'light', onToggleTheme, onLogout }) {
  const tabs = [
    { id: 'services', label: 'Services', icon: Calendar },
    { id: 'people', label: 'People', icon: Users },
    { id: 'songs', label: 'Song Library', icon: Music },
    ...(user?.role === 'admin' || user?.role === 'pastor' 
      ? [{ id: 'users', label: 'Users', icon: ShieldCheck }] 
      : []),
    { id: 'church', label: 'Church Settings', icon: Building2 },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand: ChurchFlow / Jesus My Rock Church */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => setTab('services')}
          >
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 p-1 flex items-center justify-center shadow-md shadow-red-500/5 group-hover:border-red-500/50 transition-all">
              <img 
                src="/churchflow-logo.png" 
                alt="ChurchFlow Logo" 
                className="h-full w-full object-contain filter drop-shadow" 
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  ChurchFlow
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                  Live
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5 hidden sm:block font-medium">
                Jesus My Rock Church
              </div>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile, Theme Toggle & Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 transition-all"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {user && (
              <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
                <div className="w-6 h-6 rounded-full bg-red-600/15 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                  {user.name?.[0] || 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">{user.name}</div>
                  <div className="text-[10px] text-red-600 dark:text-red-400 capitalize">{user.role}</div>
                </div>
              </div>
            )}
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex lg:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-200 dark:border-slate-800/60 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
