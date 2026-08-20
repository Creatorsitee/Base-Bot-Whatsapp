# Base Bot WhatsApp Web (Full-Stack)

Aplikasi bot WhatsApp multi-sesi berbasis web modern (React + Vite + Tailwind CSS). Bot ini menggunakan library `@itsliaaa/baileys` untuk koneksi via **Pairing Code** dan pengelolaan sesi mandiri 24/7.

### 📁 Struktur Proyek (Project Structure)

Berikut adalah struktur direktori utama proyek beserta fungsinya secara lengkap:

```bash
├── data/                   # Penyimpanan data lokal
│   ├── database.json       # Database JSON lokal untuk menyimpan log, statistik, dan pengaturan
│   └── sessions/           # Direktori penyimpanan kredensial sesi multi-device WhatsApp
│
├── plugin/                 # Core modul, plugin, dan handler backend API
│   ├── brat.ts             # Generator stiker teks Brat & Brat animasi (.brat, .bratvid)
│   ├── db.ts               # Pengelola database JSON lokal (LocalJsonDatabase)
│   ├── play.ts             # Pencari dan downloader lagu MP3 YouTube (.play)
│   ├── routes.ts           # Router API Express (Status bot, Pairing, Restart, Disconnect)
│   ├── sticker.ts          # Generator stiker WhatsApp (.s) berbasis wa-sticker-formatter
│   ├── tiktok.ts           # Downloader video & slide foto TikTok tanpa watermark (.tiktok)
│   └── whatsapp.ts         # Otak utama bot: inisialisasi Baileys, pengelolaan multi-sesi & penanganan perintah
│
├── src/                    # Kode sumber frontend (React SPA)
│   ├── components/         # Komponen antarmuka pengguna (UI)
│   │   ├── Navbar.tsx      # Komponen navigasi atas (Dashboard / Status indikator)
│   │   └── PairingSection.tsx # Form permintaan kode pairing dan status perangkat
│   ├── App.tsx             # Komponen utama React, state manajemen sesi frontend
│   ├── main.tsx            # Entry point React frontend
│   ├── types.ts            # Tipe data TypeScript global untuk frontend
│   └── index.css           # Styling global dengan Tailwind CSS
│
├── server.ts               # Server full-stack Express + integrasi Vite middleware dev & prod
├── metadata.json           # File konfigurasi metadata environment Google AI Studio
├── package.json            # Daftar dependensi npm & skrip build/start/dev
├── tsconfig.json           # Konfigurasi compiler TypeScript
├── vite.config.ts          # Konfigurasi Vite bundler
└── README.md               # Dokumentasi panduan lengkap proyek ini
```

---

## 🚀 Fitur yang Tersedia Secara Bawaan

| Perintah | Deskripsi | Sumber API / Library |
| --- | --- | --- |
| `.menu` | Menampilkan seluruh menu bantuan fitur aktif | Internal |
| `.s` | Mengubah gambar/video (reply atau kirim langsung) menjadi stiker | `wa-sticker-formatter` |
| `.brat <teks>` | Membuat stiker teks Brat | API NexRay (Brat Maker) |
| `.bratvid <teks>`| Membuat stiker video teks Brat animasi | API NexRay (Bratvid Maker) |
| `.tiktok <url>` | Mengunduh video/slide foto TikTok tanpa watermark | Custom scraping + download |
| `.play <query>` | Mencari lagu di YouTube dan mengunduhnya sebagai file audio MP3 | Custom scrap & download |

---

## 🛠️ Cara Menambahkan Plugin Baru ke Bot

Ikuti panduan langkah demi langkah berikut untuk menambahkan plugin baru ke dalam sistem bot WhatsApp:

### Langkah 1: Buat file modul plugin baru
Buatlah file TypeScript baru di dalam direktori `/plugin/`. Misalnya, untuk menambahkan plugin **Menulis Otomatis (.nulis)**:

File: `/plugin/nulis.ts`
```typescript
export async function generateNulisImage(text: string): Promise<Buffer> {
  const apikey = 'cmnty-xxxx';
  const url = `https://api.cmnty.eu.cc/maker/nulis-v2?text=${encodeURIComponent(text)}&font=greatvibes&color=1e293b&apikey=${apikey}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API Nulis error status ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    const imgUrl = json.result || json.url || json.data;
    if (!imgUrl) {
      throw new Error('Link gambar tidak ditemukan dalam respons API.');
    }
    const imgRes = await fetch(imgUrl);
    return Buffer.from(await imgRes.arrayBuffer());
  }

  return Buffer.from(await res.arrayBuffer());
}
```

### Langkah 2: Impor plugin baru ke dalam `whatsapp.ts`
Buka file `/plugin/whatsapp.ts`, lalu impor fungsi yang baru saja dibuat di bagian atas file:

```typescript
import { generateNulisImage } from './nulis';
```

### Langkah 3: Daftarkan Command Baru di Handler Pesan
Cari blok kode `messages.upsert` di dalam `/plugin/whatsapp.ts`. Di sana terdapat pengujian command dengan kata kunci `command.startsWith()`. Tambahkan penangan perintah baru di tempat tersebut:

```typescript
            if (command.startsWith('.nulis')) {
              let text = textContent.replace(/^\.nulis\s*/i, '').trim();
              if (!text && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                                   msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text || '';
                text = quotedText.trim();
              }

              if (!text) {
                await sendBotMessage(socket, senderJid, { text: 'Format salah! Gunakan: *.nulis [teks]* atau balas teks dengan *.nulis*.' });
                continue;
              }

              try {
                await sendBotMessage(socket, senderJid, { text: 'Sedang menulis teks pada kertas, mohon tunggu...' });
                
                const imageBuffer = await generateNulisImage(text);
                await sendBotMessage(socket, senderJid, { image: imageBuffer, caption: 'Sukses menulis secara otomatis!' });
              } catch (err: any) {
                console.error('Nulis command error:', err);
                await sendBotMessage(socket, senderJid, { text: `Gagal memproses tulisan: ${err?.message || 'Terjadi kesalahan.'}` });
              }
              continue;
            }
```

### Langkah 4: Daftarkan Fitur Baru pada Daftar Menu (`.menu`)
Cari baris teks menu di dalam penanganan perintah `.menu` di `/plugin/whatsapp.ts`, dan tambahkan item baru di dalamnya agar pengguna tahu fitur tersebut tersedia:

```typescript
- *.nulis*: Menulis teks indah pada buku/kertas secara otomatis.
```

---

## ⚙️ Cara Menjalankan Bot Secara Lokal

### Prasyarat
- Node.js versi 18 atau lebih tinggi
- Koneksi internet aktif

### 1. Instalasi Dependensi
Jalankan perintah berikut untuk mengunduh seluruh pustaka yang diperlukan:
```bash
npm install
```

### 2. Konfigurasi Environment (Opsional)
Apabila sistem memerlukan kunci API tertentu, daftarkan variabel lingkungan tersebut ke dalam file `.env`:
```env
PORT=8080
NODE_ENV=development
```

### 3. Menjalankan Server Pengembangan (Dev Mode)
Jalankan perintah dev berikut untuk memulai server lokal dengan fitur isi ulang cepat (*hot-reload*):
```bash
npm run dev
```
Setelah server aktif, buka browser di alamat [http://localhost:8080](http://localhost:8080) untuk mengakses dashboard admin.

---

## ⚠️ Peringatan Penting Sebelum Deploy ke Railway

Jika melakukan **Fork** repositori ini dan ingin mendeploy-nya ke platform cloud seperti Railway, ada aturan ketat yang harus dipatuhi untuk menghindari pemblokiran akun/proyek sepihak.

1. **Ubah Nama Repositori & Deskripsi:** Sebelum deploy, ubah nama repository dan deskripsinya di GitHub.
2. **Gunakan Nama Generik:** Gunakan nama generik yang aman seperti `halo`, `server`, `api`, `backend-service`, atau `my-app`.
3. **Hindari Kata Pemicu (Trigger Words):** Hindari menggunakan kata-kata yang mengindikasikan bot atau melanggar ToS Railway (seperti `bot`, `whatsapp`, `wa-bot`, `baileys`, `spammer`, dll).

Tujuannya adalah agar proyek **tidak terdeteksi sebagai skrip ilegal/bot** oleh sistem *automated screening* Railway. 🙏

---

## 🚂 Cara Deploy ke Railway

Sistem ini didesain sepenuhnya agar langsung siap di-deploy ke **Railway** tanpa memerlukan penyesuaian rumit.

### 📋 Spesifikasi Penting di Railway:
1. **Port Terbuka**: Pastikan Railway mengikat aplikasi pada PORT yang diberikan oleh sistem (Express di dalam `server.ts` mendeteksi port ini secara otomatis melalui `process.env.PORT || 8080`).
2. **Build & Start Commands**: Railway akan otomatis membaca konfigurasi `scripts` pada `package.json`:
   - Skrip Build: `npm run build`
   - Skrip Start: `npm run start`
3. **Penyimpanan Berkas Sesi (Sessions Persistence)**:
   Karena data sesi WhatsApp (kredensial login) disimpan di dalam folder root sebagai file JSON lokal, pastikan menambahkan **Railway Volume** dan memasangnya (*mount*) pada direktori kerja proyek jika ingin sesi tidak terputus saat bot di-restart oleh sistem Railway.
4. **Variabel Lingkungan (Environment Variables)**:
   Tambahkan variabel lingkungan berikut pada tab *Variables* di Railway:
   - `NODE_ENV` = `production`
   - `PORT` = `8080`

---

## 🖥️ Cara Deploy ke VPS (Virtual Private Server)

Bot ini sangat direkomendasikan untuk di-deploy ke VPS (seperti Hostinger, DigitalOcean, Linode, AWS, dll) agar dapat berjalan 24/7 tanpa batas waktu, serta keamanan file sesi WhatsApp (`data/sessions/`) tersimpan secara permanen di dalam disk.

### Prasyarat VPS
Pastikan VPS (disarankan menggunakan OS Ubuntu/Debian) sudah terinstal:
- **Git**
- **Node.js** (Minimal versi 18)
- **npm**

### Langkah-langkah Deployment:

**1. Clone Repository**
Masuk ke VPS melalui SSH, kemudian *clone* repository bot:
```bash
git clone https://github.com/Creatorsitee/Base-Bot-Whatsapp.git
cd Base-Bot-Whatsapp
```

**2. Instalasi Dependensi**
Unduh semua pustaka (library) yang dibutuhkan:
```bash
npm install
```

**3. Build Aplikasi**
Kompilasi kode TypeScript dan React frontend menjadi *production build*:
```bash
npm run build
```

**4. Instalasi PM2 (Process Manager)**
PM2 berfungsi agar bot dapat berjalan di latar belakang (*background*) terus-menerus, dan akan otomatis merestart bot jika terjadi error atau *crash*.
```bash
sudo npm install -g pm2
```

**5. Menjalankan Bot dengan PM2**
Jalankan bot menggunakan skrip start aplikasi:
```bash
pm2 start npm --name "wa-bot" -- start
```

**6. Konfigurasi Auto-Start (Penting!)**
Langkah ini agar bot otomatis menyala kembali dengan sendirinya setiap kali VPS direstart/reboot:
```bash
pm2 startup
pm2 save
```

### 💡 Perintah Berguna PM2:
- Melihat log aktivitas/error bot: `pm2 logs wa-bot`
- Menghentikan bot: `pm2 stop wa-bot`
- Merestart bot: `pm2 restart wa-bot`
- Menghapus proses bot: `pm2 delete wa-bot`

Setelah bot berjalan di PM2, akses dashboard admin web melalui IP VPS beserta portnya (contoh: `http://192.168.1.xxx:3000`) di browser komputer atau HP. **Pastikan port `3000` telah diizinkan (*allow/open*) pada pengaturan Firewall VPS.**

---

## 🛡️ Keamanan & Mekanisme Pairing Code
- **Mencegah Rate-Limit WhatsApp**: Dengan menghindari permintaan pairing code otomatis yang berlebihan, nomor WhatsApp aman dari blokir sementara atau pembatasan dari pihak WhatsApp.
- **Watchdog Latar Belakang (24/7 Watchdog)**: Sistem terus mendeteksi status koneksi aktif setiap 30 detik. Jika mendeteksi sesi yang sudah login mengalami putus koneksi (*disconnected*), sistem otomatis menyambungkan kembali tanpa meminta pairing code baru.

---

## 🛡️ Tips Keamanan Sesi WhatsApp
- **Hindari Spam Berlebihan**: Batasi pengiriman stiker berantai yang terlalu cepat untuk meminimalkan risiko nomor WhatsApp terkena blokir (*banned*) oleh sistem anti-spam resmi WhatsApp.
- **Watchdog Sistem**: Proyek ini dilengkapi dengan fitur *24/7 Watchdog* mandiri yang memantau status soket Baileys setiap 30 detik untuk menyambungkan kembali sesi yang terputus secara otomatis tanpa interaksi manual dari dashboard.
