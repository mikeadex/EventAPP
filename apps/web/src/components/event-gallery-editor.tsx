'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

interface Media {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  position: number;
  embedUrl?: string;
}

interface SignResponse {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Manage an event's photos and video from the organiser.
 *
 * Only rendered for an event that already exists — the gallery hangs off an
 * event id, so on the "new event" page there is nothing to attach to yet. The
 * create flow keeps the single cover upload and this appears on edit.
 *
 * Reordering is buttons rather than drag-and-drop, matching mobile. Drag would
 * be nicer with a mouse, but two implementations of the same idea drift, and
 * the whole-list reorder the API takes is the same either way.
 */
export function EventGalleryEditor({
  eventId,
  coverImageUrl,
  onCoverChange,
}: {
  eventId: string;
  coverImageUrl: string | null;
  onCoverChange?: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Media[] | null>(null);
  const [cover, setCover] = useState<string | null>(coverImageUrl);
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await apiClient<Media[]>(`/v1/events/${eventId}/media`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the gallery');
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);

    // Sequential, matching mobile: a failure partway is easier to explain when
    // the earlier files have already landed than when several fail together.
    for (const file of files) {
      setBusy(`Uploading ${file.name}…`);
      try {
        const sign = await apiClient<SignResponse>('/v1/uploads/sign', {
          method: 'POST',
          body: { purpose: 'event_cover', contentType: file.type, byteSize: file.size },
        });
        const put = await fetch(sign.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);

        await apiClient(`/v1/events/${eventId}/media`, {
          method: 'POST',
          body: { kind: 'IMAGE', url: sign.publicUrl },
        });
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Upload failed',
        );
        break;
      }
    }

    setBusy(null);
    // Clear the input or picking the same file twice in a row does nothing.
    if (fileRef.current) fileRef.current.value = '';
    await load();
  }

  async function addVideo() {
    const link = videoUrl.trim();
    if (!link) return;
    setBusy('Adding video…');
    setError(null);
    try {
      await apiClient(`/v1/events/${eventId}/media`, {
        method: 'POST',
        body: { kind: 'VIDEO', url: link },
      });
      setVideoUrl('');
      await load();
    } catch (e) {
      // The server says exactly what it could not parse; keep that.
      setError(e instanceof ApiError ? e.message : 'Could not add that video');
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];

    setItems(next);
    try {
      await apiClient(`/v1/events/${eventId}/media/reorder`, {
        method: 'PATCH',
        body: { ids: next.map((m) => m.id) },
      });
    } catch {
      setError('Could not save the new order');
      await load();
    }
  }

  async function remove(id: string) {
    setBusy('Removing…');
    try {
      await apiClient(`/v1/events/${eventId}/media/${id}`, { method: 'DELETE' });
      await load();
    } catch {
      setError('Could not remove that item');
    } finally {
      setBusy(null);
    }
  }

  async function makeCover(id: string) {
    try {
      const res = await apiClient<{ coverImageUrl: string }>(
        `/v1/events/${eventId}/media/${id}/cover`,
        { method: 'PATCH' },
      );
      setCover(res.coverImageUrl);
      onCoverChange?.(res.coverImageUrl);
    } catch {
      setError('Could not set the cover');
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-ink-900">Photos and video</h2>
        <p className="mt-1 text-sm text-ink-500">
          Show people what your events are like. The cover is used on cards and in
          shared links — click any photo to make it the cover.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
        >
          Add photos
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(e) => void addFiles(e)}
          className="hidden"
        />

        <div className="flex flex-1 gap-2">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Otherwise this submits the surrounding event form.
                e.preventDefault();
                void addVideo();
              }
            }}
            placeholder="Paste a YouTube or Vimeo link"
            className="min-w-0 flex-1 rounded-md border border-ink-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void addVideo()}
            disabled={!videoUrl.trim() || busy !== null}
            className="rounded-md border border-ink-900 px-4 py-2 text-sm font-medium text-ink-900 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {busy && <p className="text-sm text-ink-500">{busy}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          No photos yet. Add pictures from a previous event so people know what to expect.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m, i) => {
            const isCover = m.kind === 'IMAGE' && !!cover && m.url === cover;
            return (
              <li
                key={m.id}
                className="overflow-hidden rounded-md border border-ink-200 bg-white"
              >
                <div className="relative aspect-[4/3] bg-ink-100">
                  {/* Plain <img>: these are arbitrary storage URLs, and routing
                      them through next/image would need every bucket host in
                      the config. */}
                  {m.kind === 'IMAGE' || m.thumbnailUrl ? (
                    <img
                      src={m.kind === 'IMAGE' ? m.url : (m.thumbnailUrl ?? '')}
                      alt={m.caption ?? ''}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-ink-400">
                      Video
                    </div>
                  )}
                  {m.kind === 'VIDEO' && (
                    <span className="absolute bottom-1 right-1 rounded bg-ink-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Video
                    </span>
                  )}
                  {isCover && (
                    <span className="absolute left-1 top-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-900">
                      Cover
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 p-1.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => void move(i, -1)}
                      disabled={i === 0}
                      aria-label="Move earlier"
                      className="rounded px-1.5 py-0.5 text-ink-600 hover:bg-ink-100 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(i, 1)}
                      disabled={i === items.length - 1}
                      aria-label="Move later"
                      className="rounded px-1.5 py-0.5 text-ink-600 hover:bg-ink-100 disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>

                  <div className="flex gap-1">
                    {m.kind === 'IMAGE' && !isCover && (
                      <button
                        type="button"
                        onClick={() => void makeCover(m.id)}
                        className="rounded px-1.5 py-0.5 text-xs text-ink-600 hover:bg-ink-100"
                      >
                        Cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(m.id)}
                      aria-label="Remove"
                      className="rounded px-1.5 py-0.5 text-xs text-danger hover:bg-ink-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
