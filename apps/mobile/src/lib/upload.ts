import { requireOptionalNativeModule } from 'expo-modules-core';
import { api } from './api';

/**
 * Picking a photo and putting it in object storage.
 *
 * The upload itself does not go through our API — the server issues a presigned
 * URL and the phone PUTs the bytes straight to storage. That keeps image data
 * off a serverless function with a 30-second ceiling and a request size limit,
 * and it means a slow upload on a train never occupies an API worker.
 *
 * Gated on the native module like every other native capability here, because
 * this JS reaches installs built before expo-image-picker existed.
 */
export function canPickImages(): boolean {
  return requireOptionalNativeModule('ExponentImagePicker') != null;
}

type PickerModule = {
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  launchImageLibraryAsync(opts: Record<string, unknown>): Promise<{
    canceled: boolean;
    assets?: { uri: string; mimeType?: string; fileName?: string; fileSize?: number }[];
  }>;
  MediaTypeOptions: { Images: unknown };
};

export type PickedImage = { uri: string; mimeType: string; fileName: string; fileSize?: number };

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'unsupported' | 'denied' | 'cancelled' | 'failed'; message?: string };

/** Content types the API accepts; anything else is rejected before uploading. */
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function inferType(asset: { uri: string; mimeType?: string }): string {
  if (asset.mimeType) return asset.mimeType;
  // iOS sometimes hands back no mimeType; fall back to the extension.
  const ext = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** Open the photo library. Returns the chosen images, or why it did not. */
export async function pickImages(
  opts: { multiple?: boolean } = {},
): Promise<{ ok: true; images: PickedImage[] } | { ok: false; reason: 'unsupported' | 'denied' | 'cancelled' }> {
  if (!canPickImages()) return { ok: false, reason: 'unsupported' };

  try {
    // Required lazily so the module is only touched on a build that has it.
    const Picker = require('expo-image-picker') as PickerModule;

    const perm = await Picker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };

    const result = await Picker.launchImageLibraryAsync({
      mediaTypes: Picker.MediaTypeOptions.Images,
      allowsMultipleSelection: opts.multiple ?? true,
      selectionLimit: 10,
      // Re-encoded at 0.8 rather than sent untouched: a modern phone photo is
      // 4-8 MB, which is over the API's limit and pointless for a page that
      // displays it a few hundred pixels wide.
      quality: 0.8,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return { ok: false, reason: 'cancelled' };

    return {
      ok: true,
      images: result.assets.map((a) => ({
        uri: a.uri,
        mimeType: inferType(a),
        fileName: a.fileName ?? 'photo.jpg',
        fileSize: a.fileSize,
      })),
    };
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
}

/**
 * Upload one picked image and return its public URL.
 *
 * `purpose` decides the size limit and where the object lands, so it has to
 * match one the API knows about.
 */
export async function uploadImage(
  image: PickedImage,
  purpose: 'event_cover' | 'org_logo' | 'user_avatar' = 'event_cover',
): Promise<UploadResult> {
  if (!ALLOWED.has(image.mimeType)) {
    return { ok: false, reason: 'failed', message: 'That file type is not supported' };
  }

  try {
    // Read first: the presign needs the exact byte size, and the picker's
    // reported fileSize is missing on some platforms and stale after the
    // quality re-encode on others. The blob is the only reliable source.
    const blob = await (await fetch(image.uri)).blob();

    const sign = await api<{ uploadUrl: string; publicUrl: string }>('/v1/uploads/sign', {
      method: 'POST',
      body: { purpose, contentType: image.mimeType, byteSize: blob.size },
    });

    const put = await fetch(sign.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': image.mimeType },
      body: blob,
    });

    if (!put.ok) {
      // Almost always the bucket's CORS rules rather than anything we sent.
      return {
        ok: false,
        reason: 'failed',
        message: `Upload rejected by storage (${put.status})`,
      };
    }
    return { ok: true, url: sign.publicUrl };
  } catch (e) {
    return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : undefined };
  }
}
