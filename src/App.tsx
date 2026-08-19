import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavigationTab } from './components/Navbar';
import { PairingSection } from './components/PairingSection';
import { WhatsAppStatus } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('pairing');
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  
  const [currentPhone, setCurrentPhone] = useState<string | null>(() => {
    return localStorage.getItem('wa_active_session_phone');
  });

  const isConnected = status?.isReady || status?.state === 'connected';

  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const url = currentPhone ? `/api/status?phoneNumber=${currentPhone}` : '/api/status';
      const res = await fetch(url);
      const json = await res.json();
      if (json.status && json.data) {
        setStatus(json.data);
      } else {
        setStatus(null);
      }
    } catch (e) {
      console.warn('Status fetch error:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [currentPhone]);

  const handleSessionChange = (phone: string | null) => {
    if (phone) {
      localStorage.setItem('wa_active_session_phone', phone);
    } else {
      localStorage.removeItem('wa_active_session_phone');
      setStatus(null);
    }
    setCurrentPhone(phone);
  };

  useEffect(() => {
    fetchStatus();

    const interval = setInterval(() => {
      fetchStatus();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!isConnected) {
      setActiveTab('pairing');
    } else if (activeTab === 'pairing') {
      setActiveTab('overview');
    }
  }, [isConnected]);

  const handleDisconnect = async () => {
    if (!confirm('Putuskan koneksi WhatsApp sekarang?')) return;
    try {
      const res = await fetch('/api/disconnect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: currentPhone })
      });
      const json = await res.json();
      if (json.status) {
        handleSessionChange(null);
      }
    } catch (e) {
      console.error('Disconnect error:', e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-100 selection:text-zinc-950 max-w-full overflow-x-hidden">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        onRefresh={() => {
          fetchStatus();
        }}
        isRefreshing={isLoadingStatus}
        onDisconnect={handleDisconnect}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-hidden min-w-0">
        <PairingSection
          status={status}
          onRefresh={fetchStatus}
          isLoading={isLoadingStatus}
          onNavigateTab={setActiveTab}
          onSessionChange={handleSessionChange}
          currentPhone={currentPhone}
        />
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-[11px] font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-1">
          <span>Base Bot WhatsApp by Cmnty</span>
          <a
            href="https://whatsapp.com/channel/0029VbCox0f17Emr10Bdlj0V"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-200 underline transition"
          >
            Saluran WhatsApp (Channel)
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
