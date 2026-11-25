'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/client';
import { Icon } from '@/components/icons';

const ENV_LABELS: Record<string, string> = {
  production: 'Production',
  staging: 'Staging',
};

/** Set `NEXT_PUBLIC_ENV=production|staging` per deployment; anything else reads as Development. */
const ENV_LABEL = ENV_LABELS[process.env.NEXT_PUBLIC_ENV ?? ''] ?? 'Development';

/**
 * Console top bar. This slice has no global search or notifications; the
 * environment pill, public-site link and theme toggle are as designed.
 */
export function AdminTop({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="atop">
      <div className="at-in">
        <div className="ml-auto flex items-center gap-2.5">
          <span className="at-env">
            <i aria-hidden="true" />
            {ENV_LABEL}
          </span>
          <Link href="/" className="icon-btn" aria-label="View public site">
            <Icon name="external" />
          </Link>
          <ThemeToggle />
          {onSignOut ? (
            <button type="button" className="icon-btn at-signout" aria-label="Sign out" onClick={onSignOut}>
              <Icon name="logout" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
