export interface MessageLogItem {
  id: string;
  type: 'text' | 'media' | 'poll' | 'location' | 'contact' | 'button' | 'code' | 'table' | 'reaction' | 'album' | 'incoming';
  target: string;
  message: string;
  status: 'SUCCESS' | 'FAILED' | 'RECEIVED';
  responseId?: string;
  errorMessage?: string;
  timestamp: string;
  latencyMs?: number;
  metadata?: any;
}

export interface WhatsAppStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'pairing_ready';
  isReady: boolean;
  userPhone: string | null;
  userName: string | null;
  profilePicUrl?: string | null;
  pairingCode: string | null;
  pairingCodeExpiry: number | null;
  lastConnectedAt: string | null;
  lastDisconnectReason: string | null;
  uptimeSeconds: number;
  sessionDir: string;
  stats?: {
    totalSent: number;
    totalReceived?: number;
    totalFailed: number;
    lastActiveAt: string | null;
  };
  serverTime?: string;
}

