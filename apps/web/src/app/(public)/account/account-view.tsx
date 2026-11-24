'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, PasswordInput } from '@/components/controls';
import { Icon, type IconName } from '@/components/icons';
import { PASSWORD_MIN, PasswordMeter } from '@/components/password-meter';
import { Avatar, ErrorCard, PageIntro, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { changePassword, signOut, updateUser } from '@/lib/auth-client';
import { HOST_ROLES, ROLE_LABEL } from '@/lib/host';
import { useActiveInView } from '@/lib/use-active-in-view';
import type { Me } from '@/lib/types';
import { useMe, useRequireSession } from '@/lib/use-api';

type Section = 'profile' | 'hosting' | 'security';
const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'hosting', label: 'Hosting', icon: 'building' },
  { id: 'security', label: 'Sign-in & security', icon: 'settings' },
];

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
      <PageIntro eyebrow="Account" title={user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Your account'} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav ref={navRef} aria-label="Account sections" className="flex gap-2 overflow-x-auto md:flex-col">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`${pathname}?section=${s.id}` as never}
              aria-current={section === s.id ? 'page' : undefined}
              className="chip flex-none gap-2 md:justify-start"
              scroll={false}
            >
              <Icon name={s.icon} size={16} /> {s.label}
            </Link>
          ))}
          <button
            type="button"
            className="chip flex-none gap-2 md:justify-start"
            onClick={async () => {
              await signOut();
              router.replace('/');
              router.refresh();
            }}
          >
            <Icon name="logout" size={16} /> Sign out
          </button>
        </nav>

        <div className="min-w-0">
          {me.status === 'loading' || !user ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-48 rounded-card" />
              <Skeleton className="h-32 rounded-card" />
            </div>
          ) : me.status === 'error' ? (
            <ErrorCard message={me.error} />
          ) : section === 'profile' ? (
            <Profile me={me.data} name={user.name} image={user.image ?? null} />
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

function Profile({ me, name: initial, image }: { me: Me; name: string; image: string | null }) {
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setName(initial), [initial]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setMsg(null);
    const res = await updateUser({ name: name.trim() });
    setPending(false);
    setMsg(res.error ? { ok: false, text: res.error.message ?? 'Couldn’t save.' } : { ok: true, text: 'Saved.' });
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <Avatar name={name} src={image ?? me.profile?.avatarUrl} size={64} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[20px] text-strong">{name || 'Your name'}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-muted">
            <span className="min-w-0 truncate">{me.email}</span>
            {me.emailVerified && <span className="tag">Verified</span>}
          </span>
        </div>
      </div>
      <div className="rule-x" />
      <Field label="Name" hint="Shown to hosts on their attendee list, and on “Who’s going” if you opt in.">
        {(p) => (
          <input
            {...p}
            className="input"
            required
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      <Field label="Email" hint="Your email can’t be changed here. Contact support if you need to move your account.">
        {(p) => <input {...p} className="input" value={me.email} readOnly disabled />}
      </Field>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending || name.trim() === initial} className="btn btn-primary">
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        {msg && (
          <span role="status" className={msg.ok ? 'text-[14px] text-ink-2' : 'error-text'}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

function Hosting({ me }: { me: Me }) {
  if (me.memberships.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-4 p-6 sm:p-8">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line-2 text-accent">
          <Icon name="building" size={20} />
        </span>
        <h2 className="text-[22px] text-strong">Host events with Ekklesia</h2>
        <p className="max-w-[460px] text-[15px] leading-relaxed text-body">
          Set up your church or ministry to publish events, take RSVPs and check people in at the door.
        </p>
        <Link href="/organizer/organizations/new" className="btn btn-primary">
          Become a host
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="card divide-y divide-line">
        {me.memberships.map((m) => {
          const canHost = HOST_ROLES.includes(m.role);
          return (
            <li key={m.organizationId} className="flex items-center gap-4 p-5">
              <Avatar name={m.name} size={44} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[17px] text-strong">{m.name}</span>
                <span className="flex flex-wrap gap-2 text-[13px] text-muted">
                  {ROLE_LABEL[m.role] ?? m.role}
                  {m.verificationStatus !== 'VERIFIED' && canHost && <span className="tag-muted">Not yet verified</span>}
                </span>
              </div>
              {canHost ? (
                <Link href={`/organizer/organizations/${m.organizationId}` as never} className="btn btn-outline btn-sm">
                  Dashboard
                </Link>
              ) : (
                <Link href={`/${m.slug}` as never} className="btn btn-ghost btn-sm">
                  View
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <Link href="/organizer/organizations/new" className="btn btn-ghost self-start">
        <Icon name="plus" size={16} /> Set up another organisation
      </Link>
    </div>
  );
}

function Security() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onChangePassword(e: FormEvent) {
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
    setCurrent('');
    setNext('');
    setMsg({ ok: true, text: 'Password changed. Other devices have been signed out.' });
  }

  async function onDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient('/v1/me', { method: 'DELETE' });
      await signOut().catch(() => {});
      router.replace('/');
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setDeleteError(err instanceof ApiError ? err.message : 'We couldn’t delete your account.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onChangePassword} className="card flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] text-strong">Change password</h2>
          <p className="text-[14px] text-body">
            Signed up with Google or Apple? Your account has no password —{' '}
            <Link href="/reset-password" className="text-accent">
              set one by email
            </Link>{' '}
            instead.
          </p>
        </div>
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
        <Field label="New password">
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
        <PasswordMeter value={next} />
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

      <section className="card flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] text-strong">Delete account</h2>
          <p className="text-[14px] leading-relaxed text-body">
            Removes your profile, tickets and saved events. This can&rsquo;t be undone.{' '}
            <Link href="/delete-account" className="text-accent">
              What gets deleted
            </Link>
          </p>
        </div>
        <Field label='Type "DELETE" to confirm'>
          {(p) => (
            <input
              {...p}
              className="input max-w-[280px]"
              autoComplete="off"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
            />
          )}
        </Field>
        {deleteError && (
          <p role="alert" className="error-text">
            {deleteError}
          </p>
        )}
        <button
          type="button"
          className="btn btn-outline self-start"
          disabled={confirmDelete !== 'DELETE' || deleting}
          onClick={() => void onDelete()}
        >
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </section>
    </div>
  );
}
