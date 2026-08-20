import axios from 'axios';

export interface PlayResult {
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  author: string;
  ago: string;
  views: string | number;
  downloadUrl: string;
}

export async function searchYouTube(query: string): Promise<PlayResult | null> {
  try {
    console.log(`[searchYouTube] Nexray API ONLY for query: ${query}`);
    const res = await axios.get(`https://api.nexray.eu.cc/downloader/ytplay?q=${encodeURIComponent(query)}`, { timeout: 20000 });
    
    if (res.data && res.data.status && res.data.result) {
      const r = res.data.result;
      return {
        title: r.title,
        url: r.url,
        thumbnail: r.thumbnail,
        duration: r.duration,
        author: r.channel,
        ago: r.upload_at,
        views: r.views,
        downloadUrl: r.download_url
      };
    }
    return null;
  } catch (err: any) {
    console.error(`[searchYouTube] Nexray API Error:`, err?.message || err);
    throw new Error('Gagal mencari lagu melalui Nexray API.');
  }
}

export async function downloadAudio(url: string, directDownloadUrl?: string): Promise<Buffer> {
  const downloadUrl = directDownloadUrl;
  
  if (!downloadUrl) {
    throw new Error('URL unduhan tidak ditemukan dalam hasil pencarian Nexray.');
  }

  try {
    console.log(`[downloadAudio] Nexray Download ONLY: ${downloadUrl}`);
    const res = await axios.get(downloadUrl, { 
      responseType: 'arraybuffer', 
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (res.status === 200) {
      const buffer = Buffer.from(res.data);
      if (buffer.length < 50 * 1024) {
        throw new Error('File audio terlalu kecil atau rusak.');
      }
      return buffer;
    }
    throw new Error(`Server Nexray merespons dengan status: ${res.status}`);
  } catch (err: any) {
    console.error(`[downloadAudio] Nexray Download Error:`, err?.message || err);
    throw new Error('Gagal mengunduh audio dari server Nexray.');
  }
}
