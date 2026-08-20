import express, { Request, Response } from 'express';
import { db } from './db';
import { waBot } from './whatsapp';

const router = express.Router();

router.get('/status', (req: Request, res: Response) => {
  const phone = (req.query.phoneNumber || req.query.nomer || req.query.phone) as string | undefined;
  const status = waBot.getStatus(phone);
  const stats = (status as any)?.stats || db.getStats();
  const logs = db.getLogs(500);

  res.json({
    status: true,
    data: {
      ...status,
      stats,
      logs,
      serverTime: new Date().toISOString(),
    },
  });
});

router.post('/check-session', (req: Request, res: Response) => {
  const rawNumber = (req.body?.phoneNumber || req.body?.nomer || req.query?.phoneNumber) as string;
  if (!rawNumber) {
    return res.status(400).json({ status: false, error: 'Nomor WhatsApp wajib diisi.' });
  }
  const formatted = waBot.formatPhoneNumber(rawNumber);
  const status = waBot.getStatus(formatted);
  return res.json({
    status: true,
    data: {
      ...status,
      phoneNumber: formatted,
    },
  });
});

router.post('/pairing-code', async (req: Request, res: Response) => {
  try {
    const phoneNumber = (req.body?.phoneNumber || req.body?.nomer || req.body?.number || req.query.nomer) as string;
    const customCode = req.body?.customCode as string | undefined;

    if (!phoneNumber) {
      return res.status(400).json({
        status: false,
        error: 'Nomor WhatsApp wajib diisi untuk membuat pairing code.',
      });
    }

    const formatted = waBot.formatPhoneNumber(phoneNumber);
    const existingStatus = waBot.getStatus(formatted);

    if (existingStatus.isReady && existingStatus.state === 'connected') {
      return res.status(400).json({
        status: false,
        error: `WhatsApp sudah terhubung dengan nomor ${formatted}.`,
      });
    }

    const pairingCode = await waBot.requestPairingCode(phoneNumber, customCode);

    return res.json({
      status: true,
      message: 'Pairing code berhasil dibuat. Masukkan kode ini pada WhatsApp > Perangkat Tertaut > Tautkan dengan nomor telepon.',
      code: pairingCode,
      phoneNumber: formatted,
      expiresIn: '5 minutes',
    });
  } catch (err: any) {
    return res.status(400).json({
      status: false,
      error: err?.message || 'Gagal membuat pairing code.',
    });
  }
});

router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const phone = (req.body?.phoneNumber || req.body?.nomer || req.query.nomer || req.query.phoneNumber) as string | undefined;
    await waBot.disconnect(phone);
    res.json({ status: true, message: 'Sesi WhatsApp diputus & dibersihkan.' });
  } catch (err: any) {
    res.status(500).json({ status: false, error: err?.message || 'Gagal memutuskan koneksi.' });
  }
});

router.post('/restart', async (req: Request, res: Response) => {
  try {
    const phone = (req.body?.phoneNumber || req.body?.nomer || req.query.nomer || req.query.phoneNumber) as string | undefined;
    await waBot.restart(phone);
    res.json({ status: true, message: 'Bot WhatsApp direstart.' });
  } catch (err: any) {
    res.status(500).json({ status: false, error: err?.message || 'Gagal merestart.' });
  }
});

export default router;
