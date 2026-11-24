'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Icon } from './icons';

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
  /**
   * `box` (default) is the shape-driven drop area. `row` is the host
   * onboarding logo picker: a dashed row with a round preview and "Upload".
   * `cover` is the create-event cover: a 180px dashed area. Both of the
   * design variants put the hint above the control.
   */
  variant?: 'box' | 'row' | 'cover';
  /** Initials shown in the `row` preview before an image is chosen. */
  initials?: string;
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
  variant = 'box',
  initials = '',
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
          'Image uploads aren’t available right now. You can add one later.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      setProgress('idle');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const busy = progress === 'signing' ? 'Preparing upload…' : progress === 'uploading' ? 'Uploading…' : null;
  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="hidden"
      onChange={handleFile}
    />
  );
  const errorText = error && (
    <span role="alert" className="error-text">
      {error}
    </span>
  );

  if (variant === 'row' || variant === 'cover') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <span className="label">{label}</span>
        {hint && <span className="hint -mt-1">{hint}</span>}
        {variant === 'row' ? (
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line-3 bg-raised p-4">
            <span className="inline-flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-full border border-line-3 bg-avatar text-[18px] text-accent">
              {value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="" className="h-full w-full object-cover" />
              ) : (
                initials || <Icon name="image" size={20} />
              )}
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={progress !== 'idle'}
              aria-label={`${label}: ${busy ?? (value ? 'replace image' : 'upload an image')}`}
              className="text-[15px] text-accent disabled:opacity-60"
            >
              {busy ?? (value ? 'Replace' : 'Upload')}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                aria-label={`Remove ${label.toLowerCase()}`}
                className="ml-auto text-[14px] text-ink-2 hover:text-accent"
              >
                Remove
              </button>
            )}
          </div>
        ) : value ? (
          <div className="relative h-[180px] overflow-hidden rounded-[18px] border border-line-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <div className="absolute right-3 top-3 flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} aria-label={`Replace ${label.toLowerCase()}`} className="btn btn-sm glass border border-line-2">
                Replace
              </button>
              <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${label.toLowerCase()}`} className="btn btn-sm glass border border-line-2">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={progress !== 'idle'}
            aria-label={`${label}: ${busy ?? 'upload a photo'}`}
            className="flex h-[180px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-3 bg-raised p-4 text-center text-[15px] text-ink-2 transition-colors hover:text-accent disabled:opacity-60"
          >
            <Icon name="image" size={28} className="text-accent" />
            <span>{busy ?? 'Upload a photo · 16:9 works best'}</span>
          </button>
        )}
        {fileInput}
        {errorText}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="label">{label}</span>
      <div className={`${aspect} relative overflow-hidden rounded-panel border border-dashed border-line-2 bg-raised`}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <div className="absolute right-3 top-3 flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} aria-label={`Replace ${label.toLowerCase()}`} className="btn btn-sm glass border border-line-2">
                Replace
              </button>
              <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${label.toLowerCase()}`} className="btn btn-sm glass border border-line-2">
                Remove
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={progress !== 'idle'}
            aria-label={`${label}: ${progress === 'idle' ? 'choose an image' : 'uploading'}`}
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-[14px] text-ink-2 transition-colors hover:bg-softer hover:text-accent disabled:opacity-60"
          >
            <Icon name="image" size={24} />
            <span>
              {progress === 'signing' && 'Preparing upload…'}
              {progress === 'uploading' && 'Uploading…'}
              {progress === 'idle' && 'Choose an image'}
            </span>
            <span className="text-[12px] text-faint">PNG, JPEG or WebP, up to 8 MB</span>
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
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span role="alert" className="error-text">
          {error}
        </span>
      )}
    </div>
  );
}
