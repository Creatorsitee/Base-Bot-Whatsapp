import https from 'https';
import zlib from 'zlib';
import { URL } from 'url';
import axios from 'axios';

const agent = new https.Agent({ keepAlive: true });

function request(url: string, { method = 'GET', headers = {} as Record<string, string>, body = null as any } = {}): Promise<{ text: string; headers: any; status: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: body ? { ...headers, 'content-length': Buffer.byteLength(body).toString() } : headers,
      agent,
      maxHeaderSize: 1048576,
    };

    const req = https.request(opts, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const newHeaders = { ...headers };
        delete newHeaders.host;
        return resolve(request(res.headers.location, { method, headers: newHeaders, body }));
      }

      const chunks: any[] = [];
      const encoding = res.headers['content-encoding'];
      const stream =
        encoding === 'gzip' ? res.pipe(zlib.createGunzip()) :
        encoding === 'br' ? res.pipe(zlib.createBrotliDecompress()) :
        encoding === 'deflate' ? res.pipe(zlib.createInflate()) :
        res;

      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8'), headers: res.headers, status: res.statusCode || 200 }));
      stream.on('error', reject);
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function extractItemStruct(html: string): any {
  const apiMatch = html.match(/<script id="api-data"[^>]*>([\s\S]+?)<\/script>/);
  if (apiMatch) {
    try {
      const j = JSON.parse(apiMatch[1]);
      let s = j?.videoDetail?.itemInfo?.itemStruct || j?.itemInfo?.itemStruct;
      if (s) return s;
      if (j?.ItemModule) {
        const firstId = Object.keys(j.ItemModule)[0];
        if (firstId && j.ItemModule[firstId]) return j.ItemModule[firstId];
      }
    } catch (_) {}
  }
  const uniMatch = html.match(/<script id="UNIVERSAL_DATA_FOR_REHYDRATION"[^>]*>([\s\S]+?)<\/script>/);
  if (uniMatch) {
    try {
      const j = JSON.parse(uniMatch[1]);
      const defaultScope = j?.DEFAULT_SCOPE || {};
      for (const key of Object.keys(defaultScope)) {
        const s = defaultScope[key]?.itemInfo?.itemStruct;
        if (s) return s;
      }
    } catch (_) {}
  }
  return null;
}

export async function tiktok(url: string): Promise<any> {
  try {
    console.log(`[tiktok] Mengambil data dari TikWM untuk URL: ${url}`);
    const tikwmRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    if (tikwmRes.status === 200) {
      const result = tikwmRes.data;
      if (result && result.code === 0 && result.data) {
        const data = result.data;
        const images = data.images || [];
        const isImage = images.length > 0;
        
        let download: string[] = [];
        if (isImage) {
          download = images;
        } else {
          download = [data.play, data.wmplay, data.hdplay].filter(Boolean);
        }

        console.log(`[tiktok] Ekstraksi TikWM berhasil. Tipe: ${isImage ? 'Postingan Gambar' : 'Video'}`);
        return {
          cookies: '',
          id: data.id || null,
          isVideo: !isImage,
          title: data.title || '',
          region: data.region || null,
          duration: `${data.duration || 0} second`,
          cover: data.cover || data.origin_cover || null,
          stats: {
            like: data.digg_count || 0,
            views: data.play_count || 0,
            share: data.share_count || 0,
            comment: data.comment_count || 0,
            collect: data.collect_count || 0
          },
          download,
          author: {
            id: data.author?.id || '',
            secUid: '',
            username: data.author?.unique_id || '',
            nickname: data.author?.nickname || '',
            avatar: data.author?.avatar || null,
            verified: false,
            followers: 0,
            following: 0,
            like: 0,
            videoCount: 0
          },
          music: {
            id: data.music_info?.id || null,
            title: data.music_info?.title || '',
            author: data.music_info?.author || '',
            thumbnail: data.music_info?.cover || null,
            duration: `${data.music_info?.duration || 0} second`,
            url: data.music || data.music_info?.play || null
          }
        };
      } else {
        console.warn(`[tiktok] API TikWM mengembalikan kode non-nol atau data kosong:`, result);
      }
    }
  } catch (err: any) {
    console.error(`[tiktok] API TikWM gagal: ${err?.message || err}. Beralih ke scraper lokal...`);
  }

  const { text, headers } = await request(url, {
    headers: {
      'sec-ch-ua': '"Mises";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-dest': 'document',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
      'priority': 'u=0, i'
    }
  });

  const detail = extractItemStruct(text);
  if (!detail) {
    throw new Error('Gagal mengekstrak data dari TikTok. Pastikan URL valid dan publik.');
  }

  const isImage = !!detail.imagePost;
  let download: string[] = [];
  if (isImage) {
    download = (detail.imagePost.images || []).reduce((acc: string[], img: any) => {
      return acc.concat(img?.imageURL?.urlList || []);
    }, []);
  } else {
    download = [detail.video?.downloadAddr, detail.video?.playAddr].filter(Boolean);
    if (detail.id) {
      try {
        const pUrl = `https://www.tiktok.com/player/api/v1/items?item_ids=${detail.id}`;
        const pText = await request(pUrl).then(r => r.text);
        const pJson = JSON.parse(pText);
        const directUrl = pJson.items?.[0]?.video_info?.url_list?.[0];
        if (directUrl) download.unshift(directUrl);
      } catch (e) {
      }
    }
  }

  const cookies = (headers['set-cookie'] || []).map((c: string) => c.split(';')[0]).join('; ');

  return {
    cookies,
    id: detail.id || detail.aweme_id || null,
    isVideo: !isImage,
    title: detail.desc || detail.suggestedWords?.[0] || '',
    region: detail.locationCreated || null,
    duration: `${detail.video?.duration || detail.music?.duration || 0} second`,
    cover: detail.video?.cover || detail.video?.originCover || null,
    stats: {
      like: detail.stats?.diggCount || 0,
      views: detail.stats?.playCount || 0,
      share: detail.stats?.shareCount || 0,
      comment: detail.stats?.commentCount || 0,
      collect: detail.stats?.collectCount || 0
    },
    download,
    author: {
      id: detail.author?.id || '',
      secUid: detail.author?.secUid || '',
      username: detail.author?.uniqueId || '',
      nickname: detail.author?.nickname || '',
      avatar: detail.author?.avatarLarger || detail.author?.avatarMedium || detail.author?.avatarThumb || null,
      verified: detail.author?.verified || false,
      followers: detail.authorStats?.followerCount || detail.author?.followerCount || 0,
      following: detail.authorStats?.followingCount || detail.author?.followingCount || 0,
      like: detail.authorStats?.heartCount || detail.author?.heartCount || 0,
      videoCount: detail.authorStats?.videoCount || detail.author?.videoCount || 0
    },
    music: {
      id: detail.music?.id || null,
      title: detail.music?.title || '',
      author: detail.music?.authorName || '',
      thumbnail: detail.music?.coverLarge || detail.music?.coverMedium || detail.music?.coverThumb || null,
      duration: `${detail.music?.duration || 0} second`,
      url: detail.music?.playUrl || null
    }
  };
}

export function downloadMedia(url: string, cookies?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers: Record<string, string> = {
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'accept': '*/*',
      'accept-encoding': 'identity',
    };
    if (cookies) {
      headers['cookie'] = cookies;
    }

    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers,
      agent,
    };

    const req = https.request(opts, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadMedia(res.headers.location, cookies));
      }

      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.end();
  });
}
