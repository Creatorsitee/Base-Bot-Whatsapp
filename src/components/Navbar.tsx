import React, { useState } from 'react';
import {
  Smartphone,
  RefreshCw,
  Menu,
  X,
  LayoutDashboard,
  PowerOff,
} from 'lucide-react';
import { WhatsAppStatus } from '../types';

export type NavigationTab = 'overview' | 'pairing';

interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  status: WhatsAppStatus | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onDisconnect?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  status,
  onRefresh,
  isRefreshing,
  onDisconnect,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isConnected = status?.isReady || status?.state === 'connected';
  const isConnecting = status?.state === 'connecting';
  const isPairing = status?.state === 'pairing_ready';

  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode }[] = isConnected
    ? [
        { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
      ]
    : [
        { id: 'pairing', label: 'Tautkan Perangkat', icon: <Smartphone className="w-3.5 h-3.5" /> },
      ];

  const handleTabClick = (tabId: NavigationTab) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs">
              WA
            </div>
            <span className="font-mono text-sm font-semibold tracking-wide text-zinc-100">
              WHATSAPP BOT
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`tab-btn-${item.id}`}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-zinc-100'
                    : isConnecting
                    ? 'bg-zinc-400 animate-pulse'
                    : isPairing
                    ? 'bg-zinc-300 animate-pulse'
                    : 'bg-zinc-700'
                }`}
              />
              <span>
                {isConnected
                  ? `+${status?.userPhone || 'Online'}`
                  : isConnecting
                  ? 'Connecting...'
                  : isPairing
                  ? 'Pairing Ready'
                  : 'Offline'}
              </span>
            </div>

            <button
              id="btn-refresh-status"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition text-left ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}

          {isConnected && onDisconnect && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onDisconnect();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
