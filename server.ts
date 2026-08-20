import express from 'express';
import path from 'path';
import cors from 'cors';
import dns from 'dns';
import { createServer as createViteServer } from 'vite';

dns.setDefaultResultOrder('ipv4first');

import apiRouter from './plugin/routes';
import { waBot } from './plugin/whatsapp';

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`[Startup] Mendeteksi PORT: ${process.env.PORT || 'tidak diatur, menggunakan default 8080'}`);
  console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'whatsapp-bot-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.use('/api', apiRouter);

  try {
    waBot.restoreExistingSessions().catch((err) => {
      console.log('Status pemulihan sesi WhatsApp idle:', err?.message || err);
    });
  } catch (e) {
    console.warn('Pemulihan sesi awal dilewati:', e);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`==============================================`);
    console.log(`🚀 SERVER BOT WHATSAPP RUNNING ON PORT ${PORT}`);
    console.log(`📡 URL: http://0.0.0.0:${PORT}`);
    console.log(`==============================================`);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`\nMenerima ${signal}, menutup Bot WhatsApp dengan aman...`);
    server.close(() => {
      console.log('Server HTTP ditutup.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('⚠️ [Watchdog 24/7] Menangkap uncaughtException (mencegah crash):', err?.message || err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('⚠️ [Watchdog 24/7] Menangkap unhandledRejection (mencegah crash):', (reason as any)?.message || reason);
  });
}

startServer().catch((err) => {
  console.error('Kesalahan fatal saat startup server:', err);
  process.exit(1);
});
