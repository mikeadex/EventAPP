'use client';

import type { ConnectStatus, PayoutStatus } from './types';
import { useApi, useMe } from './use-api';

/**
 * Whether a host can sell paid tickets, and if not, why.
 *
 * Two gates, both from the API: the `paid_tickets` feature flag on `/v1/me`
 * (off by default; switched on per organisation or platform-wide) and the
 * organisation's Stripe Connect status, which must be ENABLED — the orders
 * API refuses to sell for anyone else, so offering a price field before then
 * would publish an event nobody could buy into.
 *
 * The status call needs the `payout:view` permission (owners and admins).
 * An organiser without it gets `payout: 'UNKNOWN'` and is told who to ask.
 */
export type PaidTicketsGate =
  | { status: 'loading'; canSell: false }
  | { status: 'ready'; canSell: boolean; flag: boolean; payout: PayoutStatus | 'UNKNOWN'; canManagePayouts: boolean };

export function usePaidTicketsGate(orgId: string | undefined): PaidTicketsGate {
  const me = useMe();
  const flag = me.data?.capabilities?.paid_tickets === true;
  const perms = (orgId && me.data?.permissionsByOrg[orgId]) || [];
  const canView = perms.includes('payout:view');
  const connect = useApi<ConnectStatus>(orgId && flag && canView ? `/v1/organizations/${orgId}/connect/status` : null);

  if (me.status === 'loading' || (flag && canView && connect.status === 'loading')) {
    return { status: 'loading', canSell: false };
  }
  const payout: PayoutStatus | 'UNKNOWN' = connect.status === 'ready' ? connect.data.status : 'UNKNOWN';
  return {
    status: 'ready',
    flag,
    payout,
    canSell: flag && payout === 'ENABLED',
    canManagePayouts: perms.includes('payout:manage'),
  };
}
