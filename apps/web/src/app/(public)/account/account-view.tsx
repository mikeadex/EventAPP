'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Field, PasswordInput } from '@/components/controls';
import { Icon } from '@/components/icons';
import { PASSWORD_MIN, PasswordMeter } from '@/components/password-meter';
import { Avatar, ErrorCard, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { authClient, changePassword, signOut, updateUser } from '@/lib/auth-client';
import { HOST_ROLES, ROLE_LABEL } from '@/lib/host';
import { useActiveInView } from '@/lib/use-active-in-view';
import type { Me } from '@/lib/types';
import { useMe, useRequireSession } from '@/lib/use-api';

// TODO(confirm): the design also has a Notifications section (event
// reminders, new events from followed hosts, changes, monthly roundup). The
// API stores no notification preferences yet, so it is left out rather than
// showing switches that do nothing.
type Section = 'profile' | 'hosting' | 'security';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'hosting', label: 'Hosting' },
  { id: 'security', label: 'Sign-in & security' },
];

/** The design's side-nav item: plain text, soft fill and accent when current. */
const NAV_ITEM =
  'flex flex-none items-center whitespace-nowrap rounded-[14px] px-3.5 py-3 text-left text-[15px] text-ink-2 transition-colors hover:text-ink md:w-full aria-[current=page]:bg-soft aria-[current=page]:text-accent-ink';

export function AccountView() {
  const { user, ready } = useRequireSession();
  const me = useMe(ready);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const raw = params.get('section');
  const section: Section = SECTIONS.some((s) => s.id === raw) ? (raw as Section) : 'profile';
  const navRef = useActiveInView<HTMLElement>(section);

  return (
    <>
      <header className="mb-10 flex items-center gap-5">
        {user ? (
          <Avatar name={user.name} src={user.image ?? (me.status === 'ready' ? me.data.profile?.avatarUrl : null)} size={80} />
        ) : (
          <Skeleton className="h-20 w-20 flex-none rounded-full" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[28px] leading-tight text-strong [overflow-wrap:anywhere] sm:text-[36px]">
            {user?.name || 'Your account'}
          </h1>
          {user && <p className="text-[15px] text-muted [overflow-wrap:anywhere]">{user.email}</p>}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 md:grid-cols-[260px_minmax(0,1fr)] md:gap-12">
        <nav ref={navRef} aria-label="Account sections" className="flex gap-1 overflow-x-auto md:flex-col">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`${pathname}?section=${s.id}` as never}
              aria-current={section === s.id ? 'page' : undefined}
              className={NAV_ITEM}
              scroll={false}
            >
              {s.label}
            </Link>
          ))}
          <div className="rule-x my-3 hidden md:block" />
          <Link href="/me/tickets" className={NAV_ITEM}>
            Your tickets
          </Link>
          <Link href="/saved" className={NAV_ITEM}>
            Saved events
          </Link>
          <button
            type="button"
            className={`${NAV_ITEM} !text-accent`}
            onClick={async () => {
              await signOut();
              router.replace('/');
              router.refresh();
            }}
          >
            Sign out
          </button>
        </nav>

        <div className="min-w-0">
          {me.status === 'loading' || !user ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-72 rounded-card" />
            </div>
          ) : me.status === 'error' ? (
            <ErrorCard message={me.error} />
          ) : section === 'profile' ? (
            <Profile email={me.data.email} name={user.name} />
          ) : section === 'hosting' ? (
            <Hosting me={me.data} />
          ) : (
            <Security />
          )}
        </div>
      </div>
    </>
  );
}

function Card({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-6 sm:p-8">
      <h2 id={id} className="text-[24px] text-strong">
        {title}
      </h2>
      {intro && <p className="mt-1.5 text-[15px] leading-relaxed text-body">{intro}</p>}
      {children}
    </section>
  );
}

function splitName(name: string) {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return { first, last: rest.join(' ') };
}

function Profile({ email, name: initial }: { email: string; name: string }) {
  const [first, setFirst] = useState(() => splitName(initial).first);
  const [last, setLast] = useState(() => splitName(initial).last);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function reset() {
    const parts = splitName(initial);
    setFirst(parts.first);
    setLast(parts.last);
  }
  useEffect(reset, [initial]);

  const name = [first.trim(), last.trim()].filter(Boolean).join(' ');
  const changed = name !== initial.trim();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!first.trim()) return;
    setPending(true);
    setMsg(null);
    const res = await updateUser({ name });
    setPending(false);
    setMsg(res.error ? { ok: false, text: res.error.message ?? 'Couldn’t save.' } : { ok: true, text: 'Saved.' });
  }

  return (
    <Card id="h-profile" title="Profile" intro="Hosts see your name on their attendee list.">
      {/* TODO(confirm): the design also asks for a mobile number and home
          city. The API has no field for a phone number and no way to update
          the city, so neither is shown. */}
      <form onSubmit={save} className="mt-7">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          <Field label="First name">
            {(p) => (
              <input
                {...p}
                className="input"
                required
                maxLength={60}
                autoComplete="given-name"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
              />
            )}
          </Field>
          <Field label="Last name">
            {(p) => (
              <input
                {...p}
                className="input"
                maxLength={60}
                autoComplete="family-name"
                value={last}
                onChange={(e) => setLast(e.target.value)}
              />
            )}
          </Field>
          <Field label="Email address" hint="This can’t be changed here. Contact support to move your account.">
            {(p) => <input {...p} type="email" className="input" value={email} readOnly disabled />}
          </Field>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
          {msg && (
            <span role={msg.ok ? 'status' : 'alert'} className={`mr-auto ${msg.ok ? 'text-[14px] text-ink-2' : 'error-text'}`}>
              {msg.text}
            </span>
          )}
          <button
            type="button"
            className="btn btn-outline"
            disabled={!changed || pending}
            onClick={() => {
              reset();
              setMsg(null);
            }}
          >
            Cancel
          </button>
          <button type="submit" disabled={pending || !changed || !first.trim()} className="btn btn-primary">
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Hosting({ me }: { me: Me }) {
  if (me.memberships.length === 0) {
    return (
      <Card
        id="h-host"
        title="Hosting"
        intro="Set up your church or ministry to publish events, take RSVPs and check people in at the door."
      >
        <Link href="/organizer/organizations/new" className="btn btn-primary mt-6">
          Become a host
        </Link>
      </Card>
    );
  }
  const hosted = me.memberships.filter((m) => HOST_ROLES.includes(m.role)).length;
  const intro =
    hosted === 0
      ? 'You belong to these host pages.'
      : `You manage ${hosted === 1 ? 'one host page' : `${hosted} host pages`}.`;
  return (
    <Card id="h-host" title="Hosting" intro={intro}>
      {/* TODO(confirm): the design shows "· 3 upcoming events" per page; the
          memberships in /v1/me carry no event count, so it's left off. */}
      <ul className="mt-6 flex flex-col gap-3">
        {me.memberships.map((m) => {
          const canHost = HOST_ROLES.includes(m.role);
          return (
            <li key={m.organizationId}>
              <Link
                href={(canHost ? `/organizer/organizations/${m.organizationId}` : `/${m.slug}`) as never}
                className="card card-link flex items-center gap-4 bg-raised p-5"
              >
                <Avatar name={m.name} size={52} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[17px] text-strong [overflow-wrap:anywhere]">{m.name}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                    {ROLE_LABEL[m.role] ?? m.role}
                    {m.verificationStatus !== 'VERIFIED' && canHost && <span className="tag-muted">Not yet verified</span>}
                  </span>
                </span>
                <span className="hidden flex-none text-[14px] text-accent sm:inline">
                  {canHost ? 'Open dashboard →' : 'View page →'}
                </span>
                <Icon name="arrowRight" size={18} className="flex-none text-accent sm:hidden" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/organizer/organizations/new" className="btn btn-outline mt-4">
        Set up another host page
      </Link>
    </Card>
  );
}

type AccountRow = { providerId: string; updatedAt: Date | string };
type SessionRow = { token: string; userAgent?: string | null };

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', apple: 'Apple', credential: 'Email and password' };

/** "Chrome on Mac" from a user-agent string; the mobile app and others fall back. */
function deviceOf(ua: string | null | undefined) {
  if (!ua) return 'Another device';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  if (browser && os) return `${browser} on ${os}`;
  return os ?? browser ?? 'Another device';
}

function Row({ title, hint, children, last = false }: { title: string; hint?: ReactNode; children?: ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 py-[18px] ${last ? '' : 'border-b border-line'}`}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[16px] text-ink">{title}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Security() {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [open, setOpen] = useState<'password' | 'delete' | null>(null);
  const [signOutMsg, setSignOutMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function load() {
    const [a, s] = await Promise.all([authClient.listAccounts(), authClient.listSessions()]);
    setAccounts((a.data as AccountRow[] | null) ?? []);
    setSessions((s.data as SessionRow[] | null) ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  const credential = accounts?.find((a) => a.providerId === 'credential');
  const social = accounts?.filter((a) => a.providerId !== 'credential').map((a) => PROVIDER_LABEL[a.providerId] ?? a.providerId);
  const others = sessions ? Math.max(sessions.length - 1, 0) : 0;
  const devices = sessions ? [...new Set(sessions.map((s) => deviceOf(s.userAgent)))].join(' · ') : null;

  async function signOutOthers() {
    setSigningOut(true);
    setSignOutMsg(null);
    const res = await authClient.revokeOtherSessions();
    setSigningOut(false);
    if (res.error) {
      setSignOutMsg({ ok: false, text: res.error.message ?? 'We couldn’t sign out your other devices.' });
      return;
    }
    setSignOutMsg({ ok: true, text: 'Your other devices have been signed out.' });
    void load();
  }

  return (
    <Card id="h-sec" title="Sign-in & security">
      <div className="mt-3">
        <Row
          title="Password"
          hint={
            accounts === null
              ? '…'
              : credential
                ? `Last changed ${new Date(credential.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'You sign in with Google or Apple, so there’s no password yet.'
          }
        >
          {accounts !== null &&
            (credential ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                aria-expanded={open === 'password'}
                aria-controls="change-password"
                onClick={() => setOpen(open === 'password' ? null : 'password')}
              >
                {open === 'password' ? 'Cancel' : 'Change'}
              </button>
            ) : (
              <Link href="/reset-password" className="btn btn-outline btn-sm">
                Set one by email
              </Link>
            ))}
        </Row>
        {open === 'password' && (
          <ChangePassword
            onDone={() => {
              setOpen(null);
              void load();
            }}
          />
        )}

        {/* TODO(confirm): the design has "Manage" here. Linking and unlinking
            Google or Apple isn't built yet, so this only lists them. */}
        <Row
          title="Connected accounts"
          hint={social === undefined ? '…' : social.length ? social.join(' · ') : 'None — you sign in with email'}
        />

        <Row
          title="Signed-in devices"
          hint={
            <>
              {devices ?? '…'}
              {signOutMsg && (
                <span role={signOutMsg.ok ? 'status' : 'alert'} className={`block ${signOutMsg.ok ? 'text-ink-2' : 'error-text'}`}>
                  {signOutMsg.text}
                </span>
              )}
            </>
          }
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={others === 0 || signingOut}
            onClick={() => void signOutOthers()}
          >
            {signingOut ? 'Signing out…' : 'Sign out others'}
          </button>
        </Row>

        <Row title="Delete account" hint="Removes your profile, tickets and saved events" last={open !== 'delete'}>
          <button
            type="button"
            className="btn btn-sm border border-line-3 text-accent"
            aria-expanded={open === 'delete'}
            aria-controls="delete-account"
            onClick={() => setOpen(open === 'delete' ? null : 'delete')}
          >
            {open === 'delete' ? 'Cancel' : 'Delete'}
          </button>
        </Row>
        {open === 'delete' && <DeleteAccount />}
      </div>
    </Card>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < PASSWORD_MIN) return setMsg({ ok: false, text: `Use at least ${PASSWORD_MIN} characters.` });
    setPending(true);
    setMsg(null);
    const res = await changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (res.error) {
      setMsg({ ok: false, text: res.error.message ?? 'We couldn’t change your password.' });
      return;
    }
    onDone();
  }

  return (
    <form id="change-password" onSubmit={submit} className="flex flex-col gap-5 border-b border-line pb-6 pt-2">
      <Field label="Current password">
        {(p) => (
          <PasswordInput
            {...p}
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
      </Field>
      <Field label="New password" hint="Changing it signs you out on your other devices.">
        {(p) => (
          <PasswordInput
            {...p}
            required
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        )}
      </Field>
      <PasswordMeter value={next} summary />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? 'Saving…' : 'Change password'}
        </button>
        {msg && (
          <span role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-[14px] text-ink-2' : 'error-text'}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setDeleting(true);
    setError(null);
    try {
      await apiClient('/v1/me', { method: 'DELETE' });
      await signOut().catch(() => {});
      router.replace('/');
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setError(err instanceof ApiError ? err.message : 'We couldn’t delete your account.');
    }
  }

  return (
    <div id="delete-account" className="flex flex-col gap-4 pt-2">
      <p className="text-[14px] leading-relaxed text-body">
        This can&rsquo;t be undone.{' '}
        <Link href="/delete-account" className="text-accent">
          What gets deleted
        </Link>
      </p>
      <Field label='Type "DELETE" to confirm'>
        {(p) => (
          <input
            {...p}
            className="input max-w-[280px]"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-outline self-start"
        disabled={confirm !== 'DELETE' || deleting}
        onClick={() => void onDelete()}
      >
        {deleting ? 'Deleting…' : 'Delete my account'}
      </button>
    </div>
  );
}
