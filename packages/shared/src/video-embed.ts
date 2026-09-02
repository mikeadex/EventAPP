/**
 * Turning a pasted video link into something we can safely embed.
 *
 * Hosts paste whatever the address bar or the share sheet gave them, which for
 * YouTube alone means at least five shapes: watch?v=, youtu.be/, /embed/,
 * /shorts/ and /live/ — the last being the common one for churches, who
 * livestream services and then share the recording.
 *
 * We store the provider and the id, never the pasted URL, for two reasons. The
 * embed URL can then change without a migration. And an id validated on the way
 * in cannot smuggle anything into an iframe on the way out — building an embed
 * from `https://www.youtube.com/embed/${id}` with a checked id is safe in a way
 * that echoing back a user-supplied URL is not.
 */
export type VideoProvider = 'youtube' | 'vimeo';

export interface ParsedVideo {
  provider: VideoProvider;
  providerId: string;
  /** Canonical watch page, for opening outside the app. */
  url: string;
  /** Player URL, safe to put in an iframe or web view. */
  embedUrl: string;
  /** Poster frame, where the provider exposes one without an API call. */
  thumbnailUrl: string | null;
}

// Deliberately strict: YouTube ids are 11 chars of an unreserved alphabet, and
// Vimeo ids are numeric. Anything else is a link we do not understand, which is
// better reported than half-accepted.
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d+$/;

function youtube(id: string): ParsedVideo | null {
  if (!YOUTUBE_ID.test(id)) return null;
  return {
    provider: 'youtube',
    providerId: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

function vimeo(id: string): ParsedVideo | null {
  if (!VIMEO_ID.test(id)) return null;
  return {
    provider: 'vimeo',
    providerId: id,
    url: `https://vimeo.com/${id}`,
    embedUrl: `https://player.vimeo.com/video/${id}`,
    // Vimeo thumbnails need an API call, so this is filled in later or not at all.
    thumbnailUrl: null,
  };
}

/** Parse a pasted link. Returns null for anything we cannot embed. */
export function parseVideoUrl(input: string): ParsedVideo | null {
  const raw = input.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    // Tolerate a link pasted without a scheme, which is what copying from a
    // browser's address bar often gives you.
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return youtube(segments[0] ?? '');
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = parsed.searchParams.get('v');
    if (v) return youtube(v);
    // /embed/ID, /shorts/ID, /live/ID, /v/ID
    if (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '')) {
      return youtube(segments[1] ?? '');
    }
    return null;
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123456789 and player.vimeo.com/video/123456789
    const id = segments[0] === 'video' ? segments[1] : segments[0];
    return vimeo(id ?? '');
  }

  return null;
}

/** Rebuild an embed URL from stored values, without trusting anything stored. */
export function embedUrlFor(provider: string, providerId: string): string | null {
  if (provider === 'youtube') return youtube(providerId)?.embedUrl ?? null;
  if (provider === 'vimeo') return vimeo(providerId)?.embedUrl ?? null;
  return null;
}
