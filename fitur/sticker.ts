import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadContentFromMessage } from '@itsliaaa/baileys';

export async function createSticker(mediaMsg: any, mediaType: 'image' | 'video'): Promise<Buffer> {
  const stream = await downloadContentFromMessage(mediaMsg, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }

  const sticker = new Sticker(buffer, {
    pack: 'Base Bot WhatsApp',
    author: 'by Cmnty',
    type: StickerTypes.FULL,
    quality: 70,
    categories: [],
  });

  return sticker.toBuffer();
}
