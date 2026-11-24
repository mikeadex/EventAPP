'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { Icon } from '@/components/icons';
import { checkInCode, describeResult, type CheckInResult } from '@/lib/check-in';
import { fmtTime } from '@/lib/format';
import type { AttendeeList } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** The same code seen again within this window is the camera, not a second scan. */
const REPEAT_MS = 3000;

type CameraState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

export default function CheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const event = useApi<{ title: string }>(`/v1/events/${eventId}`);
  // Door staff (VOLUNTEER) can admit people but may not see the full list; the
  // progress bar simply hides if this is refused.
  const list = useApi<AttendeeList>(`/v1/events/${eventId}/tickets`);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const lastSeen = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const inFlight = useRef(false);

  const [camera, setCamera] = useState<CameraState>('off');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [recent, setRecent] = useState<(CheckInResult & { seenAt: number })[]>([]);
  const [manual, setManual] = useState('');
  const [admitted, setAdmitted] = useState(0);

  const handle = useCallback(
    async (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code || inFlight.current) return;
      const now = Date.now();
      if (code === lastSeen.current.code && now - lastSeen.current.at < REPEAT_MS) return;
      lastSeen.current = { code, at: now };
      inFlight.current = true;
      const r = await checkInCode(eventId, code);
      inFlight.current = false;
      setResult(r);
      setRecent((p) => [{ ...r, seenAt: Date.now() }, ...p].slice(0, 8));
      if (r.kind === 'valid') setAdmitted((n) => n + 1);
      navigator.vibrate?.(r.kind === 'valid' ? 60 : [80, 60, 80]);
    },
    [eventId],
  );

  const stop = useCallback(() => {
    controls.current?.stop();
    controls.current = null;
    setCamera('off');
  }, []);

  const start = useCallback(async () => {
    if (!videoRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    setCamera('starting');
    try {
      // Loaded on demand: the decoder is only needed on this page.
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
      controls.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (res) => {
          if (res) void handle(res.getText());
        },
      );
      setCamera('on');
    } catch (err) {
      const name = (err as { name?: string }).name;
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }, [handle]);

  useEffect(() => () => controls.current?.stop(), []);

  function submitManual(e: FormEvent) {
    e.preventDefault();
    lastSeen.current = { code: '', at: 0 }; // typed on purpose: always send
    void handle(manual);
    setManual('');
  }

  const total = list.data?.total ?? null;
  const inCount = list.data ? list.data.checkedIn + admitted : null;
  const pct = total && inCount !== null ? Math.min(100, Math.round((inCount / total) * 100)) : 0;
  const shown = result ? describeResult(result) : null;
  const good = result?.kind === 'valid';

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">Door check-in</span>
        <h1 className="text-[30px] leading-tight text-strong">{event.data?.title ?? 'Check-in'}</h1>
      </div>

      {total !== null && inCount !== null && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="flex justify-between text-[14px]">
            <span className="text-ink-2">
              {inCount} of {total} checked in
            </span>
            <span className="text-faint">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="relative aspect-square overflow-hidden rounded-hero border border-line-2 bg-surface-2">
        <video ref={videoRef} className={`h-full w-full object-cover ${camera === 'on' ? '' : 'hidden'}`} muted playsInline />
        {camera === 'on' ? (
          <>
            <div className="pointer-events-none absolute inset-[14%] rounded-[24px] border-2 border-accent opacity-80" aria-hidden="true" />
            <div
              className="pointer-events-none absolute inset-x-[14%] h-0.5 bg-accent opacity-80 motion-safe:animate-[ek-scan_2.4s_ease-in-out_infinite]"
              style={{ top: '14%' }}
              aria-hidden="true"
            />
            <button type="button" onClick={stop} className="btn btn-sm glass absolute bottom-4 left-1/2 -translate-x-1/2 border border-line-2">
              Stop camera
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-line-2 text-accent">
              <Icon name="camera" size={26} />
            </span>
            {camera === 'denied' ? (
              <p className="text-[15px] text-body">
                Camera access was blocked. Allow it in your browser&rsquo;s site settings, or type codes below.
              </p>
            ) : camera === 'unavailable' ? (
              <p className="text-[15px] text-body">No camera available here. Type ticket codes below instead.</p>
            ) : (
              <p className="text-[15px] text-body">Point the camera at a ticket&rsquo;s QR code.</p>
            )}
            {camera !== 'unavailable' && (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => void start()} disabled={camera === 'starting'}>
                {camera === 'starting' ? 'Starting camera…' : 'Start scanning'}
              </button>
            )}
          </div>
        )}
      </div>

      <div aria-live="assertive" className="min-h-[92px]">
        {shown && result && (
          <div
            role="status"
            className={`flex items-center gap-4 rounded-panel border p-5 ${good ? 'border-line-3 bg-soft' : 'border-line-2 bg-raised'}`}
          >
            <span
              className={`inline-flex h-12 w-12 flex-none items-center justify-center rounded-full ${
                good ? 'bg-accent text-accent-ink' : 'border border-line-2 text-accent'
              }`}
            >
              <Icon name={good ? 'check' : 'alert'} size={22} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[20px] leading-tight text-strong">{shown.title}</span>
              <span className="text-[14px] text-body">{shown.body}</span>
              <span className="font-mono text-[12px] text-faint">{result.code}</span>
            </span>
          </div>
        )}
      </div>

      <form onSubmit={submitManual} className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Ticket code</span>
          <input
            className="input font-mono uppercase"
            placeholder="EK-XXXXXXXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-outline" disabled={!manual.trim()}>
          Check in
        </button>
      </form>

      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow text-[11px] text-faint">Recent scans</h2>
          <ul className="card divide-y divide-line">
            {recent.map((r) => {
              const d = describeResult(r);
              return (
                <li key={`${r.code}-${r.seenAt}`} className="flex items-center gap-3 px-4 py-3">
                  <Icon name={r.kind === 'valid' ? 'check' : 'alert'} size={16} className={r.kind === 'valid' ? 'text-accent' : 'text-faint'} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{d.title}</span>
                  <span className="font-mono text-[12px] text-faint">{fmtTime(new Date(r.seenAt).toISOString())}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
