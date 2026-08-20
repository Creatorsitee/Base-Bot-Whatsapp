import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { db } from './db';

import * as BaileysModule from '@itsliaaa/baileys';

const makeWASocket = ((BaileysModule as any).default?.default || (BaileysModule as any).default || BaileysModule) as any;

const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
} = BaileysModule as any;

import { tiktok, downloadMedia } from './tiktok';
import { createSticker } from './sticker';
import { searchYouTube, downloadAudio } from './play';
import { generateBratSticker, generateBratVideoSticker } from './brat';

const botConfig = {
  bot: {
    name: '@cmnty.official',
  },
};

const OFFICIAL_NEWSLETTER_JID = '120363426467190619@newsletter';
const OFFICIAL_NEWSLETTER_NAME = '@cmnty.official';

const forwardedNewsletterMessageInfo = Object.freeze({
  newsletterJid: OFFICIAL_NEWSLETTER_JID,
  newsletterName: OFFICIAL_NEWSLETTER_NAME,
  serverMessageId: 100,
});

async function autoFollowOfficialChannel(socket: any): Promise<void> {
  if (!socket) return;
  try {
    if (typeof socket.newsletterFollow === 'function') {
      await socket.newsletterFollow(OFFICIAL_NEWSLETTER_JID);
    }
  } catch (_) {}
}

function getVerifiedQuoted(botConfig: any) {
  return {
    key: {
      participant: `0@s.whatsapp.net`,
      remoteJid: `status@broadcast`,
    },
    message: {
      contactMessage: {
        displayName: `${botConfig.bot?.name}`,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
        sendEphemeral: true,
      },
    },
  };
}

const sendBotMessage = async (socket: any, jid: string, content: any, extraOptions?: any) => {
  autoFollowOfficialChannel(socket).catch(() => {});
  const messageContent = {
    ...content,
    contextInfo: {
      ...(content.contextInfo || {}),
      isForwarded: true,
      forwardingScore: 9999,
      forwardedNewsletterMessageInfo,
    },
  };
  return socket.sendMessage(jid, messageContent, {
    quoted: getVerifiedQuoted(botConfig),
    ...extraOptions,
  });
};

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
    totalReceived: number;
    totalFailed: number;
    lastActiveAt: string | null;
  };
}

export class WhatsAppSession {
  public phoneNumber: string;
  public sessionDir: string;
  public socket: any = null;
  public connectionState: 'disconnected' | 'connecting' | 'connected' | 'pairing_ready' = 'disconnected';
  public currentPairingCode: string | null = null;
  public pairingCodeExpiry: number | null = null;
  public lastConnectedAt: string | null = null;
  public lastDisconnectReason: string | null = null;
  public profilePicUrl: string | null = null;
  public startTime: number = Date.now();
  public isInitializing: boolean = false;
  public stats = {
    totalSent: 0,
    totalReceived: 0,
    totalFailed: 0,
    lastActiveAt: null as string | null,
  };
  private saveCreds: (() => Promise<void>) | null = null;
  private reconnectTimer: any = null;

  constructor(phoneNumber: string) {
    this.phoneNumber = phoneNumber;
    this.sessionDir = path.join(process.cwd(), 'data', 'sessions', `session_${phoneNumber}`);
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  public getStatus(): WhatsAppStatus {
    const userJid = this.socket?.user?.id ? jidNormalizedUser(this.socket.user.id) : null;
    const userPhone = userJid ? userJid.split('@')[0] : this.phoneNumber;
    const userName = this.socket?.user?.name || this.socket?.user?.notify || null;

    return {
      state: this.connectionState,
      isReady: this.connectionState === 'connected' && !!this.socket,
      userPhone,
      userName,
      profilePicUrl: this.profilePicUrl,
      pairingCode: this.currentPairingCode,
      pairingCodeExpiry: this.pairingCodeExpiry,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectReason: this.lastDisconnectReason,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      sessionDir: `data/sessions/session_${this.phoneNumber}`,
      stats: this.stats,
    };
  }

  public async initializeSocket(forcePairing: boolean = false, customPairingCode?: string): Promise<{ pairingCode?: string }> {
    if (this.isInitializing) {
      if (this.currentPairingCode) {
        return { pairingCode: this.currentPairingCode };
      }
      return {};
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.ev.removeAllListeners('messages.upsert');
        this.socket.end(undefined);
      } catch (_) {}
      this.socket = null;
    }

    this.isInitializing = true;
    this.connectionState = 'connecting';

    try {
      const logger = pino({ level: 'silent' });
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      this.saveCreds = saveCreds;

      const { version } = await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: (makeCacheableSignalKeyStore as any)(state.keys, logger, undefined),
        },
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 15_000,
        retryRequestDelayMs: 500,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.socket = socket;

      socket.ev.on('creds.update', async () => {
        if (this.saveCreds) {
          await this.saveCreds();
        }
      });

      let generatedPairingCode: string | undefined;
      if (this.phoneNumber && !state.creds.registered) {
        if (!forcePairing) {
          console.log(`ℹ️ [Session ${this.phoneNumber}] Session not registered/logged in. Idle until user requests Pairing Code.`);
          this.connectionState = 'disconnected';
          this.isInitializing = false;
          try {
            socket.end(undefined);
          } catch (_) {}
          this.socket = null;
          return {};
        }

        await delay(3000);

        try {
          let code: string;
          if (customPairingCode && customPairingCode.trim()) {
            code = await (socket as any).requestPairingCode(this.phoneNumber, customPairingCode.trim().toUpperCase());
          } else {
            code = await (socket as any).requestPairingCode(this.phoneNumber);
          }

          if (code) {
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            this.currentPairingCode = formattedCode;
            this.pairingCodeExpiry = Date.now() + 60_000 * 5;
            this.connectionState = 'pairing_ready';
            generatedPairingCode = formattedCode;
          } else {
            throw new Error('Tidak menerima pairing code dari server WhatsApp.');
          }
        } catch (pairErr: any) {
          console.error(`Error requesting pairing code for ${this.phoneNumber}:`, pairErr);
          this.lastDisconnectReason = 'Gagal membuat pairing code: ' + (pairErr?.message || 'Pastikan nomor aktif.');
          throw pairErr || new Error('Gagal membuat pairing code dari server WhatsApp.');
        }
      }

      socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
          this.connectionState = 'connecting';
        }

        if (connection === 'open') {
          this.connectionState = 'connected';
          this.currentPairingCode = null;
          this.pairingCodeExpiry = null;
          this.lastConnectedAt = new Date().toISOString();
          this.lastDisconnectReason = null;

          const userJid = this.socket?.user?.id ? jidNormalizedUser(this.socket.user.id) : null;
          if (userJid) {
            this.socket.profilePictureUrl(userJid, 'image').then((url: string) => {
              this.profilePicUrl = url;
            }).catch(() => {
              this.profilePicUrl = null;
            });
          }

          await autoFollowOfficialChannel(socket);

          console.log(`✅ [Session ${this.phoneNumber}] WhatsApp Bot Connected successfully!`);
        }

        if (connection === 'close') {
          this.connectionState = 'disconnected';
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const errMessage = (lastDisconnect?.error as any)?.message || '';
          const isConflict = statusCode === DisconnectReason.connectionReplaced || statusCode === 440 || errMessage.toLowerCase().includes('conflict');
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.lastDisconnectReason = errMessage || `Code: ${statusCode || 'Unknown'}`;

          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }

          if (statusCode === DisconnectReason.loggedOut) {
            console.log(`❌ [Session ${this.phoneNumber}] Device logged out. Clearing session files...`);
            this.clearSessionFiles();
            this.currentPairingCode = null;
          } else if (isConflict) {
            console.log(`⚠️ [Session ${this.phoneNumber}] Stream conflict detected. Backing off 8s before reconnecting...`);
            this.reconnectTimer = setTimeout(() => {
              this.isInitializing = false;
              this.initializeSocket(false).catch((e) => console.error('Conflict reconnect failed:', e));
            }, 8000);
          } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
            console.log(`🔄 [Session ${this.phoneNumber}] Reconnecting immediately (Code 515)...`);
            this.isInitializing = false;
            this.initializeSocket(false).catch((e) => console.error('Immediate reconnect failed:', e));
          } else if (shouldReconnect) {
            console.log(`🔄 [Session ${this.phoneNumber}] Reconnecting in 5s... Reason: ${this.lastDisconnectReason}`);
            this.reconnectTimer = setTimeout(() => {
              this.isInitializing = false;
              this.initializeSocket(false).catch((e) => console.error('Reconnect failed:', e));
            }, 5000);
          }
        }
      });

      socket.ev.on('messages.upsert', async ({ messages }: { messages: any[] }) => {
        autoFollowOfficialChannel(socket).catch(() => {});
        for (const msg of messages) {
          if (!msg.message) continue;
          const senderJid = msg.key?.remoteJid;
          if (!senderJid) continue;

          const textContent =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            '';

          const isCommand = textContent.trim().startsWith('.');
          
          if (textContent && (isCommand || !msg.key?.fromMe)) {
            this.stats.totalReceived++;
            this.stats.lastActiveAt = new Date().toISOString();

            if (!msg.key?.fromMe || isCommand) {
              db.addLog({
                type: 'incoming',
                target: senderJid.replace('@s.whatsapp.net', '').replace('@g.us', ''),
                message: textContent,
                status: 'RECEIVED',
                responseId: msg.key?.id,
                latencyMs: 0,
              });
            }

            const command = textContent.toLowerCase().trim();

            if (command === '.menu') {
              const menuText = `*DAFTAR FITUR*

- *.brat*: Membuat stiker teks Brat. Contoh: *.brat halo guys* atau reply teks dengan *.brat*.
- *.bratvid*: Membuat stiker video Brat (Animasi). Contoh: *.bratvid halo guys* atau reply teks dengan *.bratvid*.
- *.s*: Reply foto/video atau kirim foto/video dengan caption .s untuk membuat stiker.
- *.tiktok*: Download video/slide foto TikTok tanpa watermark. Contoh: *.tiktok [link]* atau reply link TikTok.
- *.play*: Cari dan download lagu dari YouTube. Contoh: *.play Alan Walker Alone*.
- *.menu*: Menampilkan daftar fitur.

_Bot Session: +${this.phoneNumber}_`;
              await sendBotMessage(socket, senderJid, { text: menuText });
              this.stats.totalSent++;
              this.stats.lastActiveAt = new Date().toISOString();
              continue;
            }

            if (command.startsWith('.bratvid')) {
              let text = textContent.replace(/^\.bratvid\s*/i, '').trim();
              if (!text && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                                   msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text || '';
                text = quotedText.trim();
              }

              if (!text) {
                await sendBotMessage(socket, senderJid, { text: 'Format salah! Gunakan: *.bratvid [teks]* atau balas pesan teks dengan *.bratvid*.' });
                continue;
              }

              try {
                await sendBotMessage(socket, senderJid, { text: 'Sedang membuat stiker video Brat, mohon tunggu...' });
                const stickerBuffer = await generateBratVideoSticker(text);
                await sendBotMessage(socket, senderJid, { sticker: stickerBuffer, isFavorite: false });
              } catch (err: any) {
                console.error('Bratvid command error:', err);
                await sendBotMessage(socket, senderJid, { text: `Gagal membuat stiker video Brat: ${err?.message || 'Terjadi kesalahan.'}` });
              }
              continue;
            }

            if (command.startsWith('.brat')) {
              let text = textContent.replace(/^\.brat\s*/i, '').trim();
              if (!text && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                                   msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text || '';
                text = quotedText.trim();
              }

              if (!text) {
                await sendBotMessage(socket, senderJid, { text: 'Format salah! Gunakan: *.brat [teks]* atau balas pesan teks dengan *.brat*.' });
                continue;
              }

              try {
                await sendBotMessage(socket, senderJid, { text: 'Sedang membuat stiker Brat, mohon tunggu...' });
                const stickerBuffer = await generateBratSticker(text);
                await sendBotMessage(socket, senderJid, { sticker: stickerBuffer, isFavorite: false });
              } catch (err: any) {
                console.error('Brat command error:', err);
                await sendBotMessage(socket, senderJid, { text: `Gagal membuat stiker Brat: ${err?.message || 'Terjadi kesalahan.'}` });
              }
              continue;
            }

            if (command.startsWith('.play')) {
              const query = textContent.replace(/^\.play\s*/i, '').trim();
              if (!query) {
                await sendBotMessage(socket, senderJid, { text: 'Format salah! Silakan gunakan: *.play [judul lagu/artis]*.' });
                continue;
              }

              try {
                await sendBotMessage(socket, senderJid, { text: `Mencari "${query}" di YouTube, mohon tunggu...` });
                const video = await searchYouTube(query);
                
                if (!video) {
                  await sendBotMessage(socket, senderJid, { text: 'Maaf, lagu tidak ditemukan.' });
                  continue;
                }

                const infoText = `*YouTube Search Result*

🎵 *Title:* ${video.title}
⏱️ *Duration:* ${video.duration}
👤 *Author:* ${video.author}
👁️ *Views:* ${video.views.toLocaleString()}
📅 *Uploaded:* ${video.ago}
🔗 *URL:* ${video.url}

_Sedang mengunduh audio, mohon tunggu..._`;

                await sendBotMessage(socket, senderJid, { 
                  image: { url: video.thumbnail }, 
                  caption: infoText 
                });

                const audioBuffer = await downloadAudio(video.url, video.downloadUrl);
                
                await sendBotMessage(socket, senderJid, {
                  audio: audioBuffer,
                  mimetype: 'audio/mpeg',
                  fileName: `${video.title}.mp3`
                });
              } catch (err: any) {
                console.error('Play command error:', err);
                await sendBotMessage(socket, senderJid, { text: `Gagal memproses lagu: ${err?.message || 'Terjadi kesalahan internal.'}` });
              }
              continue;
            }

            if (command.startsWith('.tiktok')) {
              let url = textContent.replace(/^\.tiktok\s*/i, '').trim();
              
              if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                                   msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text || '';
                url = quotedText.trim();
              }

              const urlRegex = /(https?:\/\/[^\s]+)/gi;
              const matches = url.match(urlRegex);
              const targetUrl = matches ? matches[0] : '';

              if (!targetUrl || !targetUrl.includes('tiktok.com')) {
                await sendBotMessage(socket, senderJid, { text: 'Format salah! Silakan gunakan: *.tiktok [url tiktok]* atau balas chat berisi link TikTok.' });
                continue;
              }

              try {
                await sendBotMessage(socket, senderJid, { text: 'Sedang mengunduh media dari TikTok, mohon tunggu...' });
                const result = await tiktok(targetUrl);
                
                if (result.isVideo) {
                  const videoUrl = result.download[0];
                  if (!videoUrl) throw new Error('Video URL tidak ditemukan.');
                  
                  const buffer = await downloadMedia(videoUrl, result.cookies);
                  
                  await sendBotMessage(socket, senderJid, {
                    video: buffer,
                    caption: `*${result.title || 'TikTok Video'}*\n\n❤️ *Likes:* ${result.stats.like}\n💬 *Comments:* ${result.stats.comment}\n🎵 *Music:* ${result.music.title}\n👤 *Author:* @${result.author.username}`,
                    mimetype: 'video/mp4'
                  });
                } else {
                  const imageCount = result.download.length;
                  if (imageCount === 0) throw new Error('Foto tidak ditemukan.');
                  
                  await sendBotMessage(socket, senderJid, { text: `Menemukan ${imageCount} foto. Sedang mengirim...` });
                  
                  for (let i = 0; i < imageCount; i++) {
                    const imgUrl = result.download[i];
                    const buffer = await downloadMedia(imgUrl, result.cookies);
                    await sendBotMessage(socket, senderJid, {
                      image: buffer,
                      caption: i === 0 ? `*${result.title || 'TikTok Images'}*\n\n❤️ *Likes:* ${result.stats.like}\n👤 *Author:* @${result.author.username}` : undefined
                    });
                  }
                }
              } catch (err: any) {
                console.error('TikTok downloader error:', err);
                await sendBotMessage(socket, senderJid, { text: `Gagal mengunduh TikTok: ${err?.message || 'Terjadi kesalahan internal.'}` });
              }
              continue;
            }

            if (command === '.s') {
              let mediaMsg = msg.message?.imageMessage || msg.message?.videoMessage;
              let mediaType: 'image' | 'video' | null = msg.message?.imageMessage ? 'image' : (msg.message?.videoMessage ? 'video' : null);
              
              if (!mediaMsg && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                mediaMsg = quoted.imageMessage || quoted.videoMessage;
                mediaType = quoted.imageMessage ? 'image' : (quoted.videoMessage ? 'video' : null);
              }

              if (mediaMsg && mediaType) {
                try {
                  await sendBotMessage(socket, senderJid, { text: 'Sedang membuat stiker, mohon tunggu...' });
                  const stickerBuffer = await createSticker(mediaMsg, mediaType);
                  await sendBotMessage(socket, senderJid, { sticker: stickerBuffer, isFavorite: false });
                } catch (err) {
                  console.error('Sticker creation failed:', err);
                  await sendBotMessage(socket, senderJid, { text: 'Gagal membuat stiker. Pastikan media valid.' });
                }
              } else {
                await sendBotMessage(socket, senderJid, { text: 'Kirim/balas foto atau video dengan caption .s untuk membuat stiker.' });
              }
              continue;
            }
          }
        }
      });

      this.isInitializing = false;
      return { pairingCode: generatedPairingCode };
    } catch (err: any) {
      this.isInitializing = false;
      this.connectionState = 'disconnected';
      this.lastDisconnectReason = err?.message || 'Initialization error';
      console.error(`WhatsApp initialization error for ${this.phoneNumber}:`, err);
      throw err;
    }
  }

  public async requestPairingCode(customCode?: string): Promise<string> {
    if (this.connectionState === 'connected' && this.socket?.user?.id) {
      throw new Error('WhatsApp sudah terhubung dengan nomor ' + jidNormalizedUser(this.socket.user.id).split('@')[0]);
    }

    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.end(new Error('Resetting for new pairing code'));
      } catch (_) {}
      this.socket = null;
    }

    this.clearSessionFiles();
    this.isInitializing = false;
    this.currentPairingCode = null;
    this.pairingCodeExpiry = null;

    const res = await this.initializeSocket(true, customCode);
    if (!res.pairingCode) {
      throw new Error('Gagal mendapatkan pairing code. Silakan coba lagi.');
    }
    return res.pairingCode;
  }

  public async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (_) {
        this.socket.end(new Error('Manual Disconnect'));
      }
      this.socket = null;
    }
    this.connectionState = 'disconnected';
    this.currentPairingCode = null;
    this.pairingCodeExpiry = null;
    this.clearSessionFiles();
  }

  public async restart(): Promise<void> {
    if (this.socket) {
      try {
        this.socket.end(new Error('Manual Restart'));
      } catch (_) {}
      this.socket = null;
    }
    this.isInitializing = false;
    this.connectionState = 'connecting';
    await this.initializeSocket(false);
  }

  private clearSessionFiles() {
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
      }
      fs.mkdirSync(this.sessionDir, { recursive: true });
    } catch (e) {
      console.warn(`Error clearing session dir for ${this.phoneNumber}:`, e);
    }
  }
}

class MultiSessionManager {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private lastActivePhoneNumber: string | null = null;

  constructor() {
    this.migrateLegacySession();
    this.startWatchdog();
  }

  private startWatchdog() {
    setInterval(() => {
      for (const [phone, session] of this.sessions.entries()) {
        const credsFile = path.join(session.sessionDir, 'creds.json');
        const hasCreds = fs.existsSync(credsFile);

        if (hasCreds && session.connectionState === 'disconnected' && !session.isInitializing && !session.socket) {
          console.log(`⏱️ [24/7 Watchdog] Re-activating dropped session for +${phone}...`);
          session.initializeSocket().catch((err) => {
            console.warn(`[24/7 Watchdog] Re-activation error for +${phone}:`, err?.message || err);
          });
        }
      }
    }, 30_000);
  }

  private migrateLegacySession() {
    const legacyDir = path.join(process.cwd(), 'data', 'session_auth');
    const credsFile = path.join(legacyDir, 'creds.json');
    if (fs.existsSync(credsFile)) {
      try {
        const content = fs.readFileSync(credsFile, 'utf-8');
        const json = JSON.parse(content);
        const meId = json?.me?.id || '';
        let phone = meId ? meId.split(':')[0].split('@')[0] : 'legacy';
        phone = phone.replace(/[^0-9]/g, '');
        if (phone) {
          const newDir = path.join(process.cwd(), 'data', 'sessions', `session_${phone}`);
          if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
            fs.cpSync(legacyDir, newDir, { recursive: true });
            console.log(`[MultiSession] Migrated legacy session to session_${phone}`);
          }
        }
      } catch (e) {
        console.warn('[MultiSession] Could not migrate legacy session:', e);
      }
    }
  }

  public async restoreExistingSessions() {
    const sessionsBaseDir = path.join(process.cwd(), 'data', 'sessions');
    if (!fs.existsSync(sessionsBaseDir)) {
      fs.mkdirSync(sessionsBaseDir, { recursive: true });
      return;
    }

    try {
      const dirs = fs.readdirSync(sessionsBaseDir);
      for (const dir of dirs) {
        if (dir.startsWith('session_')) {
          const phone = dir.replace('session_', '');
          if (phone && !this.sessions.has(phone)) {
            console.log(`[MultiSession] Restoring session for phone: ${phone}`);
            const session = new WhatsAppSession(phone);
            this.sessions.set(phone, session);
            this.lastActivePhoneNumber = phone;
            session.initializeSocket().catch((err) => {
              console.warn(`[MultiSession] Failed to restore session for ${phone}:`, err?.message || err);
            });
          }
        }
      }
    } catch (e) {
      console.error('[MultiSession] Error restoring sessions:', e);
    }
  }

  public formatPhoneNumber(rawPhoneNumber: string): string {
    let clean = rawPhoneNumber.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return clean;
  }

  public getSession(phoneNumber: string): WhatsAppSession {
    const formatted = this.formatPhoneNumber(phoneNumber);
    if (!this.sessions.has(formatted)) {
      const session = new WhatsAppSession(formatted);
      this.sessions.set(formatted, session);
    }
    this.lastActivePhoneNumber = formatted;
    return this.sessions.get(formatted)!;
  }

  public getStatus(targetPhone?: string): WhatsAppStatus {
    if (targetPhone) {
      const formatted = this.formatPhoneNumber(targetPhone);
      if (this.sessions.has(formatted)) {
        return this.sessions.get(formatted)!.getStatus();
      }
    }

    return {
      state: 'disconnected',
      isReady: false,
      userPhone: null,
      userName: null,
      pairingCode: null,
      pairingCodeExpiry: null,
      lastConnectedAt: null,
      lastDisconnectReason: null,
      uptimeSeconds: 0,
      sessionDir: 'data/sessions',
    };
  }

  public async requestPairingCode(rawPhoneNumber: string, customCode?: string): Promise<string> {
    if (!rawPhoneNumber) {
      throw new Error('Nomor telepon harus diisi.');
    }

    const formatted = this.formatPhoneNumber(rawPhoneNumber);
    if (formatted.length < 9 || formatted.length > 16) {
      throw new Error('Format nomor tidak valid. Masukkan nomor dengan kode negara (contoh: 628123456789).');
    }

    const session = this.getSession(formatted);
    return session.requestPairingCode(customCode);
  }

  public async disconnect(targetPhone?: string): Promise<void> {
    if (targetPhone) {
      const formatted = this.formatPhoneNumber(targetPhone);
      if (this.sessions.has(formatted)) {
        await this.sessions.get(formatted)!.disconnect();
        this.sessions.delete(formatted);
        if (this.lastActivePhoneNumber === formatted) {
          this.lastActivePhoneNumber = null;
        }
      }
    } else if (this.lastActivePhoneNumber && this.sessions.has(this.lastActivePhoneNumber)) {
      await this.sessions.get(this.lastActivePhoneNumber)!.disconnect();
      this.sessions.delete(this.lastActivePhoneNumber);
      this.lastActivePhoneNumber = null;
    } else {
      for (const [_, session] of this.sessions.entries()) {
        await session.disconnect();
      }
      this.sessions.clear();
      this.lastActivePhoneNumber = null;
    }
  }

  public async restart(targetPhone?: string): Promise<void> {
    if (targetPhone) {
      const formatted = this.formatPhoneNumber(targetPhone);
      if (this.sessions.has(formatted)) {
        await this.sessions.get(formatted)!.restart();
      }
    } else if (this.lastActivePhoneNumber && this.sessions.has(this.lastActivePhoneNumber)) {
      await this.sessions.get(this.lastActivePhoneNumber)!.restart();
    }
  }
}

export const waBot = new MultiSessionManager();
