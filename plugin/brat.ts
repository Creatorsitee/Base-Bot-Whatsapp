import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export async function generateBratSticker(text: string): Promise<Buffer> {
  const url = `https://api.nexray.eu.cc/maker/brat?text=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });

  if (!res.ok) {
    throw new Error(`API NexRay error status ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  let imageBuffer: Buffer;

  if (contentType.includes('application/json')) {
    const json = await res.json();
    const imgUrl = typeof json.result === 'string' ? json.result : json.result?.url || json.url || json.data;
    if (!imgUrl) {
      throw new Error(json.message || json.error || 'URL gambar Brat tidak ditemukan.');
    }
    const imgRes = await fetch(imgUrl);
    imageBuffer = Buffer.from(await imgRes.arrayBuffer());
  } else {
    imageBuffer = Buffer.from(await res.arrayBuffer());
  }

  const sticker = new Sticker(imageBuffer, {
    pack: 'Brat Sticker',
    author: 'by Cmnty',
    type: StickerTypes.FULL,
    quality: 80,
    categories: [],
  });

  return sticker.toBuffer();
}

export async function generateBratVideoSticker(text: string): Promise<Buffer> {
  const url = `https://api.nexray.eu.cc/maker/bratvid?text=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });

  if (!res.ok) {
    throw new Error(`API NexRay error status ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  let videoBuffer: Buffer;

  if (contentType.includes('application/json')) {
    const json = await res.json();
    const videoUrl = typeof json.result === 'string' ? json.result : json.result?.url || json.url || json.data;
    if (!videoUrl) {
      throw new Error(json.message || json.error || 'URL video Brat tidak ditemukan.');
    }
    const videoRes = await fetch(videoUrl);
    videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  } else {
    videoBuffer = Buffer.from(await res.arrayBuffer());
  }

  const sticker = new Sticker(videoBuffer, {
    pack: 'Brat Animated',
    author: 'by Cmnty',
    type: StickerTypes.FULL,
    quality: 50,
    categories: [],
  });

  return sticker.toBuffer();
}
