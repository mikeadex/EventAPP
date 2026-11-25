'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { ApiError, apiClient } from '@/lib/api-client';
import { SUPPORT_EMAIL } from '@/lib/contact';
import type { TakedownInfo } from '@/lib/types';
import { Field } from '@/components/controls';
import { Icon, type IconName } from '@/components/icons';

type GoneCode = 'INVALID' | 'USED' | 'CLAIMED';
type State =
  | { s: 'loading' }
  | { s: 'ready'; name: string }
  | { s: 'done'; name: string }
  | { s: 'gone'; code: GoneCode }
  | { s: 'error'; message: string };

const REASON_MAX = 1000;
const TOO_MANY = 'Too many tries from this connection. Wait a minute, then try again.';

function goneCode(err: unknown): GoneCode | undefined {
  if (!(err instanceof ApiError) || err.status !== 410) return undefined;
  const code = (err.payload as { code?: unknown } | null)?.code;
  // EXPIRED never applies to a take-down link; read anything else as INVALID.
  return code === 'USED' || code === 'CLAIMED' ? code : 'INVALID';
}
const tooMany = (err: unknown) => err instanceof ApiError && err.status === 429;

/**
 * The page behind the take-down link in a claim email: a church that never
 * asked to be listed removes its page in one step.
 */
export function TakedownForm({ token }: { token: string }) {
  const [state, setState] = useState<State>({ s: 'loading' });
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  // The form the button was in is gone; move focus (and the view) to the
  // result, so keyboard and screen-reader users land on what happened.
  useEffect(() => {
    if (state.s !== 'done') return;
    doneHeading.current?.focus();
    doneHeading.current?.scrollIntoView({ block: 'center' });
  }, [state.s]);

  useEffect(() => {
    let cancelled = false;
    apiClient<TakedownInfo>(`/v1/takedown/${encodeURIComponent(token)}`)
      .then((info) => !cancelled && setState({ s: 'ready', name: info.organization.name }))
      .catch((err) => {
        if (cancelled) return;
        const code = goneCode(err);
        if (code) setState({ s: 'gone', code });
        else
          setState({
            s: 'error',
            message: tooMany(err) ? TOO_MANY : 'We couldn’t open this link. Please try again.',
          });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent, name: string) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const trimmed = reason.trim();
      await apiClient(`/v1/takedown/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: trimmed ? { reason: trimmed } : {},
      });
      setState({ s: 'done', name });
    } catch (err) {
      setPending(false);
      const code = goneCode(err);
      if (code) return setState({ s: 'gone', code });
      setError(tooMany(err) ? TOO_MANY : 'We couldn’t take it down just now. Please try again.');
    }
  }

  const contact = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline underline-offset-4">
      {SUPPORT_EMAIL}
    </a>
  );

  if (state.s === 'loading') {
    return (
      <p role="status" className="py-10 text-center text-[15px] text-body">
        Opening your link…
      </p>
    );
  }
  if (state.s === 'error') return <Notice icon="alert" title="Something went wrong" body={state.message} />;
  if (state.s === 'done') {
    return (
      <Notice
        icon="check"
        title="Taken down"
        headingRef={doneHeading}
        body={
          <>
            We&rsquo;ve taken it down and let our team know. {state.name} no longer appears on
            Ekklesia, and its events are cancelled.
          </>
        }
      />
    );
  }
  if (state.s === 'gone') {
    if (state.code === 'CLAIMED') {
      return (
        <Notice
          icon="alert"
          title="This church has been claimed"
          body={
            <>
              Someone has claimed this page, so this link no longer works. If that wasn&rsquo;t anyone
              from your church, contact us at {contact}.
            </>
          }
        />
      );
    }
    return (
      <Notice
        icon="calendarX"
        title="This link no longer works"
        body={
          <>
            If the page has already been taken down, there&rsquo;s nothing more to do. Otherwise,
            contact us at {contact}.
          </>
        }
      />
    );
  }

  const { name } = state;
  return (
    <form onSubmit={(e) => void onSubmit(e, name)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">Take down</span>
        <h1 className="text-[30px] text-strong">{name}</h1>
        <p className="text-[15px] leading-relaxed text-body">
          We added this page so people could find your events. If you&rsquo;d rather not be listed,
          take it down: the page and its events disappear from Ekklesia, and the events are
          cancelled.
        </p>
      </div>
      <Field label="Reason (optional)" hint="Only our team sees this." error={error}>
        {(p) => (
          <textarea
            {...p}
            rows={4}
            maxLength={REASON_MAX}
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-lg bg-badge text-badge-ink hover:opacity-90"
      >
        {pending ? 'Taking it down…' : 'Take it down'}
      </button>
      <p className="text-[13px] leading-relaxed text-muted">
        Want to keep the page and run it yourself instead? Use the claim link in the same email.
      </p>
    </form>
  );
}

function Notice({
  icon,
  title,
  body,
  headingRef,
}: {
  icon: IconName;
  title: string;
  body: ReactNode;
  /** Given when focus moves to the heading; makes it focusable from script. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
        <Icon name={icon} size={24} />
      </span>
      <h1
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="text-[26px] text-strong focus:outline-none"
      >
        {title}
      </h1>
      <p className="text-[15px] leading-relaxed text-body">{body}</p>
    </div>
  );
}
