'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { Icon } from '@/components/icons';
import { checkInCode, describeResult, type CheckInResult } from '@/lib/check-in';
import { fmtTime } from '@/lib/format';
import type { AttendeeList } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const RESULT_LABEL: Record<CheckInResult['kind'], string> = {
  valid: 'Checked in',
  used: 'Already used',
  wrong: 'Not for this event',
  invalid: 'Can’t admit',
};

/** The person's name when the API told us, otherwise what went wrong. */
const headline = (r: CheckInResult) => (r.kind === 'valid' || r.kind === 'used' ? r.name : 'Unknown ticket');

/** Right-hand status in the recent scans list. */
const recentStatus = (r: CheckInResult) =>
  r.kind === 'valid' ? `In · ${fmtTime(r.at)}` : r.kind === 'used' ? 'Already used' : RESULT_LABEL[r.kind];

/** The same code seen again within this window is the camera, not a second scan. */
const REPEAT_MS = 3000;

type CameraState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

export default function CheckInPage() {
  const { orgId, eventId } = useParams<{ orgId: string; eventId: string }>();
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="eyebrow text-accent">Check-in</span>
          <h1 className="text-[34px] leading-[1.1] text-strong [overflow-wrap:anywhere] sm:text-[40px]">
            {event.data?.title ?? 'Check-in'}
          </h1>
        </div>
        {total !== null && inCount !== null && (
          <div className="flex min-w-[220px] flex-col gap-2" aria-live="polite">
            <div className="flex justify-between gap-4 text-[14px]">
              <span className="text-ink-2">Checked in</span>
              <span className="text-strong">
                {inCount} / {total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-line-2 bg-surface-2"
          style={{ background: 'radial-gradient(circle at 50% 40%, var(--surface-2), var(--bg) 80%)' }}
        >
          <video ref={videoRef} className={`h-full w-full object-cover ${camera === 'on' ? '' : 'hidden'}`} muted playsInline />
          {camera === 'on' ? (
            <>
              {(['left-[22%] top-[14%] border-l-[3px] border-t-[3px] rounded-tl-[14px]', 'right-[22%] top-[14%] border-r-[3px] border-t-[3px] rounded-tr-[14px]', 'left-[22%] bottom-[14%] border-b-[3px] border-l-[3px] rounded-bl-[14px]', 'right-[22%] bottom-[14%] border-b-[3px] border-r-[3px] rounded-br-[14px]'] as const).map((c) => (
                <span key={c} aria-hidden="true" className={`pointer-events-none absolute h-11 w-11 border-accent ${c}`} />
              ))}
              <div
                className="pointer-events-none absolute inset-x-[24%] h-0.5 motion-safe:animate-[ek-scan_2.6s_ease-in-out_infinite]"
                style={{
                  top: '18%',
                  background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                  boxShadow: '0 0 18px rgba(var(--accent-rgb), .6)',
                }}
                aria-hidden="true"
              />
              <p className="absolute inset-x-0 bottom-16 text-center text-[14px] text-ink">Point the camera at a ticket QR code</p>
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
                  Camera access was blocked. Allow it in your browser&rsquo;s site settings, or type codes instead.
                </p>
              ) : camera === 'unavailable' ? (
                <p className="text-[15px] text-body">No camera available here. Type ticket codes instead.</p>
              ) : (
                <p className="text-[15px] text-body">Point the camera at a ticket QR code.</p>
              )}
              {camera !== 'unavailable' && (
                <button type="button" className="btn btn-primary btn-lg" onClick={() => void start()} disabled={camera === 'starting'}>
                  {camera === 'starting' ? 'Starting camera…' : 'Start scanning'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div aria-live="assertive">
            {/* TODO(confirm): the design adds places and ticket type ("×1
                Volunteer"), who scanned a used ticket, and which event a
                wrong ticket is for. The check-in API doesn't return these. */}
            {shown && result ? (
              <div
                role="status"
                className={`flex flex-col gap-3 rounded-[24px] border p-6 ${good ? 'border-line-3 bg-softer' : 'border-line-2 bg-surface'}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-full ${
                      good ? 'bg-accent text-bg' : 'bg-surface-2 text-accent'
                    }`}
                  >
                    <Icon name={good ? 'check' : 'alert'} size={20} />
                  </span>
                  <span className={`eyebrow ${good ? 'text-accent' : 'text-ink-2'}`}>{RESULT_LABEL[result.kind]}</span>
                </span>
                <span className="text-[26px] leading-tight text-strong [overflow-wrap:anywhere]">{headline(result)}</span>
                <span className="text-[15px] text-ink-2">{shown.body}</span>
                <span className="font-mono text-[13px] text-muted">{result.code}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-[24px] border border-line p-6">
                <span className="eyebrow text-faint">Ready to scan</span>
                <span className="text-[15px] text-ink-2">Each ticket&rsquo;s result shows here.</span>
              </div>
            )}
          </div>

          <form onSubmit={submitManual} className="card flex flex-col gap-3 p-5">
            <label htmlFor="manual-code" className="text-[14px] text-ink">
              Enter code
            </label>
            <input
              id="manual-code"
              className="h-12 rounded-[14px] border border-line-2 bg-raised px-4 font-mono uppercase tracking-[0.1em] text-ink outline-none focus:border-accent"
              placeholder="EK-XXXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button type="submit" className="btn btn-primary w-full" disabled={!manual.trim()}>
              Check in
            </button>
          </form>

          <section className="card p-5" aria-labelledby="recent-h">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-h" className="text-[17px] text-strong">
                Recent scans
              </h2>
              {/* Door volunteers may not be allowed the full list. */}
              {list.status === 'ready' && (
                <Link href={`/organizer/organizations/${orgId}/events/${eventId}/attendees` as never} className="text-[14px] text-accent">
                  Full list
                </Link>
              )}
            </div>
            {recent.length === 0 ? (
              <p className="pt-3 text-[14px] text-muted">Nothing scanned yet.</p>
            ) : (
              <ul className="mt-1">
                {recent.map((r) => (
                  <li
                    key={`${r.code}-${r.seenAt}`}
                    className="flex items-center justify-between gap-3 border-b border-line py-3 text-[14px] last:border-b-0"
                  >
                    <span className="min-w-0 truncate">
                      {r.kind === 'valid' || r.kind === 'used' ? r.name : <span className="font-mono">{r.code}</span>}
                    </span>
                    <span className={`flex-none ${r.kind === 'valid' ? 'text-accent' : 'text-muted'}`}>{recentStatus(r)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
