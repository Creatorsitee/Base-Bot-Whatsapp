import fs from 'fs';
import path from 'path';

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

export interface AutoReplyRule {
  id: string;
  keyword: string;
  matchType: 'exact' | 'contains' | 'startsWith';
  response: string;
  isActive: boolean;
}

export interface BotSettings {
  storageType: 'local_json';
  sessionName: string;
  autoReadMessages: boolean;
  autoReplyEnabled: boolean;
  autoReplies: AutoReplyRule[];
}

interface DatabaseSchema {
  settings: BotSettings;
  logs: MessageLogItem[];
  stats: {
    totalSent: number;
    totalReceived: number;
    totalFailed: number;
    lastActiveAt: string | null;
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Gagal membuat direktori data JSON lokal:', err);
  }
}

const initialData: DatabaseSchema = {
  settings: {
    storageType: 'local_json',
    sessionName: 'wa_bot_session',
    autoReadMessages: true,
    autoReplyEnabled: false,
    autoReplies: [],
  },
  logs: [],
  stats: {
    totalSent: 0,
    totalReceived: 0,
    totalFailed: 0,
    lastActiveAt: null,
  },
};

class LocalJsonDatabase {
  private data: DatabaseSchema;
  private filePath: string = DB_FILE;

  constructor() {
    this.data = this.loadFromFile();
  }

  private loadFromFile(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...initialData,
          ...parsed,
          settings: { ...initialData.settings, ...(parsed.settings || {}), storageType: 'local_json' },
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
          stats: { ...initialData.stats, ...(parsed.stats || {}) },
        };
      }
    } catch (e) {
      console.warn('Tidak dapat membaca database JSON lokal yang ada, menginisialisasi penyimpanan baru:', e);
    }
    this.saveToFile(initialData);
    return initialData;
  }

  private saveToFile(dataToSave: DatabaseSchema = this.data) {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error('Gagal menulis database JSON lokal ke berkas:', e);
    }
  }

  public getSettings(): BotSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<BotSettings>): BotSettings {
    this.data.settings = { ...this.data.settings, ...updates, storageType: 'local_json' };
    this.saveToFile();
    return this.data.settings;
  }

  public addLog(log: Omit<MessageLogItem, 'id' | 'timestamp'>): MessageLogItem {
    const fullLog: MessageLogItem = {
      ...log,
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
    };

    this.data.logs.unshift(fullLog);
    if (this.data.logs.length > 500) {
      this.data.logs = this.data.logs.slice(0, 500);
    }

    if (log.status === 'SUCCESS') {
      this.data.stats.totalSent += 1;
    } else if (log.status === 'RECEIVED') {
      this.data.stats.totalReceived = (this.data.stats.totalReceived || 0) + 1;
    } else {
      this.data.stats.totalFailed += 1;
    }
    this.data.stats.lastActiveAt = new Date().toISOString();

    this.saveToFile();
    return fullLog;
  }

  public getLogs(limit: number = 100): MessageLogItem[] {
    return this.data.logs.slice(0, limit);
  }

  public clearLogs(): void {
    this.data.logs = [];
    this.saveToFile();
  }

  public getStats() {
    return {
      ...this.data.stats,
      storageType: 'Penyimpanan JSON Lokal',
    };
  }
}

export const db = new LocalJsonDatabase();
