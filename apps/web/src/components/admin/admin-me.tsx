'use client';

import { createContext, useContext } from 'react';
import type { AdminMe } from '@/lib/admin-api';

const AdminMeContext = createContext<AdminMe | null>(null);

/** Provided by the console shell once `GET /v1/admin/me` has cleared the session. */
export const AdminMeProvider = AdminMeContext.Provider;

/** The signed-in staff member. Only valid inside the console shell. */
export function useAdminMe(): AdminMe {
  const me = useContext(AdminMeContext);
  if (!me) throw new Error('useAdminMe must be used inside the admin console');
  return me;
}
