import { SUPPORT_EMAIL } from '@/lib/contact';
import type { ClaimStatus } from '@/lib/types';

/**
 * One quiet line on the page of a church that staff added and the church has
 * not claimed yet. Deliberately plain text, not a badge: it says who put the
 * page up, it does not vouch for it.
 *
 * The claim link itself only ever travels by email to the church's contact,
 * so this asks them to get in touch rather than offering a claim flow here.
 *
 * TODO(confirm): final wording.
 */
export function UnclaimedNote({
  claimStatus,
  name,
  className = '',
}: {
  claimStatus?: ClaimStatus;
  name: string;
  className?: string;
}) {
  if (claimStatus !== 'UNCLAIMED') return null;
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Claiming ${name} on Ekklesia`)}`;
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-[14px] text-body ${className}`}>
      <span>Added by Ekklesia ·</span>
      <span>Is this your church?</span>
      {/* min-h keeps the link a 44px target although it reads as inline text. */}
      <a href={href} className="inline-flex min-h-[44px] items-center text-accent underline underline-offset-4">
        Contact us to claim it.
      </a>
    </p>
  );
}
