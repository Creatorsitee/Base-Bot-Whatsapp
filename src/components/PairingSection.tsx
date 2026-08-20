import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  PowerOff,
  RotateCw,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { WhatsAppStatus } from '../types';

interface PairingSectionProps {
  status: WhatsAppStatus | null;
  onRefresh: () => void;
  isLoading: boolean;
  onNavigateTab?: (tab: any) => void;
  onSessionChange: (phone: string | null) => void;
  currentPhone: string | null;
}

export const PairingSection: React.FC<PairingSectionProps> = ({
  status,
  onRefresh,
  isLoading: isGlobalLoading,
  onNavigateTab,
  onSessionChange,
  currentPhone,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('62');
  const [customPairingCode, setCustomPairingCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(status?.pairingCode || null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'disconnect' | 'restart' | null>(null);
  const [countdown, setCountdown] = useState<number>(120);
  const isConnected = status?.isReady || status?.state === 'connected';

  useEffect(() => {
    if (status?.pairingCode && status.pairingCode !== pairingCode) {
      setPairingCode(status.pairingCode);
      setCountdown(120);
    }
  }, [status?.pairingCode]);

  useEffect(() => {
    if (!pairingCode || status?.isReady) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pairingCode, status?.isReady]);

  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let rawNumber = phoneNumber.trim().replace(/[^0-9]/g, '');
    if (!rawNumber) {
      setErrorMsg('Masukkan nomor WhatsApp.');
      return;
    }

    if (rawNumber.startsWith('0')) {
      rawNumber = rawNumber.slice(1);
    }
    if (rawNumber.startsWith(countryCode)) {
      rawNumber = rawNumber.slice(countryCode.length);
    }

    const fullNumber = `${countryCode}${rawNumber}`;

    setIsRequesting(true);
    try {
      const payload: any = { phoneNumber: fullNumber };
      if (useCustomCode && customPairingCode.trim()) {
        payload.customCode = customPairingCode.trim().toUpperCase();
      }

      const res = await fetch('/api/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.status) {
        throw new Error(data.error || 'Gagal mendapatkan kode pairing.');
      }

      onSessionChange(data.phoneNumber || fullNumber);
      setPairingCode(data.code);
      setCountdown(120);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/-/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    if (!confirm('Putuskan koneksi WhatsApp?')) return;
    setActionLoading('disconnect');
    try {
      const res = await fetch('/api/disconnect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: currentPhone })
      });
      const data = await res.json();
      if (data.status) {
        setPairingCode(null);
        onSessionChange(null);
        onRefresh();
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading('restart');
    try {
      const res = await fetch('/api/restart', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: currentPhone })
      });
      const data = await res.json();
      if (data.status) {
        setTimeout(() => onRefresh(), 2000);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (isConnected) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {status?.profilePicUrl ? (
              <img
                src={status.profilePicUrl}
                alt="WhatsApp Profile"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-lg object-cover border border-zinc-700/80 shrink-0 shadow-lg shadow-zinc-900/50"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-lg shrink-0 shadow-lg shadow-zinc-900/50">
                {status?.userName ? status.userName.slice(0, 2).toUpperCase() : 'WA'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-zinc-100">
                  +{status?.userPhone}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-100">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {status?.userName ? `${status.userName} · ` : ''}api.cmnty.eu.cc · Uptime: {status?.uptimeSeconds || 0}s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition shadow-sm"
            >
              <RotateCw className={`w-3.5 h-3.5 ${actionLoading === 'restart' ? 'animate-spin' : ''}`} />
              <span>Restart</span>
            </button>

            <button
              onClick={handleDisconnect}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition shadow-sm"
            >
              <PowerOff className={`w-3.5 h-3.5 ${actionLoading === 'disconnect' ? 'animate-spin' : ''}`} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/60 relative overflow-hidden group">
            <TrendingUp className="absolute -right-2 -bottom-2 w-12 h-12 text-zinc-800/40 group-hover:text-zinc-700/50 transition-colors" />
            <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider block">Total Traffic</span>
            <span className="text-2xl font-mono font-bold text-zinc-100 mt-1 block">
              {(status?.stats?.totalSent || 0) + (status?.stats?.totalReceived || 0)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/60 relative overflow-hidden group">
            <Activity className="absolute -right-2 -bottom-2 w-12 h-12 text-zinc-800/40 group-hover:text-zinc-700/50 transition-colors" />
            <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider block">Bot Status</span>
            <span className="text-sm font-mono font-bold text-zinc-100 mt-2 block">
              ACTIVE &amp; READY
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6 sm:py-10 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Tautkan Perangkat
        </h2>
        <p className="text-xs text-zinc-400 font-mono">
          Masukkan nomor WhatsApp untuk menerima kode pairing.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-md bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
      )}

      <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
        {!pairingCode ? (
          <form onSubmit={handleRequestPairing} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Phone Number
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-24 h-10 px-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600"
                >
                  <option value="62">+62</option>
                  <option value="60">+60</option>
                  <option value="65">+65</option>
                  <option value="1">+1</option>
                  <option value="44">+44</option>
                  <option value="91">+91</option>
                </select>

                <input
                  type="text"
                  placeholder="81234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setUseCustomCode(!useCustomCode)}
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 underline"
              >
                {useCustomCode ? 'Hide custom code' : '+ Custom pairing code (optional)'}
              </button>

              {useCustomCode && (
                <input
                  type="text"
                  maxLength={8}
                  placeholder="MYCODE12"
                  value={customPairingCode}
                  onChange={(e) => setCustomPairingCode(e.target.value.toUpperCase())}
                  className="w-full h-8 px-2.5 mt-2 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 uppercase"
                />
              )}
            </div>

            <button
              id="btn-get-pairing-code"
              type="submit"
              disabled={isRequesting || isGlobalLoading}
              className="w-full h-10 rounded-md bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {isRequesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Requesting Code...</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Get Pairing Code</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>PAIRING CODE</span>
              <span>{countdown}s</span>
            </div>

            <div className="flex items-center justify-between bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
              <div className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.2em] text-zinc-100">
                {pairingCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded bg-zinc-100 text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[11px] font-mono text-zinc-500 text-center">
              WhatsApp &gt; Linked Devices &gt; Link with phone number
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
