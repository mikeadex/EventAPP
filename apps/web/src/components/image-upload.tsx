'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

type Purpose = 'event_cover' | 'org_logo' | 'user_avatar';

interface SignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

interface Props {
  purpose: Purpose;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
  /** "wide" for hero/cover, "square" for logo/avatar. */
  shape?: 'wide' | 'square';
  className?: string;
}

/**
 * Reusable upload widget. Asks the API for a presigned PUT URL, uploads the
 * file straight to object storage, then hands the resulting public URL back
 * via `onChange`. The parent form stores the URL string and submits as
 * normal.
 *
 * If the API responds 503 (S3 not configured) we surface a friendly message
 * pointing to the README — easier than silently failing in dev.
 */
export function ImageUpload({
  purpose,
  value,
  onChange,
  label = 'Image',
  hint,
  shape = 'wide',
  className = '',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<'idle' | 'signing' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);

  const aspect = shape === 'square' ? 'aspect-square' : 'aspect-[16/7]';

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setProgress('signing');

    try {
      const sign = await apiClient<SignResponse>('/v1/uploads/sign', {
        method: 'POST',
        body: {
          purpose,
          contentType: file.type,
          byteSize: file.size,
        },
      });

      setProgress('uploading');
      const put = await fetch(sign.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`);
      }
      onChange(sign.publicUrl);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError(
          'Object storage is not running. Start MinIO (see README) or paste an image URL manually.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      setProgress('idle');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <p className="text-sm font-medium text-ink-700">{label}</p>
      <div
        className={`mt-1 ${aspect} relative overflow-hidden rounded-lg border-2 border-dashed border-ink-200 bg-ink-50`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 rounded-md bg-ink-900/70 px-2 py-1 text-xs text-white hover:bg-ink-900"
            >
              Remove
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={progress !== 'idle'}
            className="flex h-full w-full flex-col items-center justify-center text-sm text-ink-500 hover:bg-ink-100 disabled:opacity-60"
          >
            <span className="font-medium">
              {progress === 'signing' && 'Preparing upload…'}
              {progress === 'uploading' && 'Uploading…'}
              {progress === 'idle' && 'Click to upload'}
            </span>
            <span className="mt-1 text-xs text-ink-400">PNG, JPEG, WebP up to 8 MB</span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
