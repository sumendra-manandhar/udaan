import { db } from '../db/db';
import type { MediaRef } from '../db/types';
import { queueMedia, newId } from '../sync/mutate';
import { publicMediaUrl } from './supabase';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Shrink photos on the device before storing, to save data on mobile networks. */
async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', quality),
  );
}

/** Store a picked file on the device and queue it for upload. */
export async function addMedia(file: File, userId: string): Promise<MediaRef> {
  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Clips must be under 50 MB. Trim it first.');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const path = `${userId}/${newId()}.${ext}`;
    await queueMedia(path, file);
    return { path, kind: 'video' };
  }
  if (!file.type.startsWith('image/')) throw new Error('Only photos and video clips can be added.');
  const blob = await compressImage(file);
  const path = `${userId}/${newId()}.jpg`;
  await queueMedia(path, blob);
  return { path, kind: 'image' };
}

const objectUrls = new Map<string, string>();

/** A URL for a media item: the local copy while it waits to upload, the
 * public (and service-worker cached) URL afterwards. */
export async function mediaUrl(ref: MediaRef): Promise<string> {
  const local = await db.media.get(ref.path);
  if (local) {
    let url = objectUrls.get(ref.path);
    if (!url) {
      url = URL.createObjectURL(local.blob);
      objectUrls.set(ref.path, url);
    }
    return url;
  }
  return publicMediaUrl(ref.path);
}
