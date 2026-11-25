import { Injectable } from '@nestjs/common';
import { getAuth } from '../auth/auth.js';
import { ClaimAccounts } from './claims.service.js';

/**
 * Creates the claimer's account the way Better Auth's own sign-up would —
 * through its internal adapter and password hasher — so the result signs in
 * with `signIn.email` like any other account. No session is created here.
 */
@Injectable()
export class BetterAuthClaimAccounts extends ClaimAccounts {
  async createPasswordUser(input: { email: string; name: string; password: string }) {
    const ctx = await (await getAuth()).$context;
    // Verified: they reached this by clicking a link sent to the address.
    const user = await ctx.internalAdapter.createUser({
      email: input.email,
      name: input.name,
      emailVerified: true,
    });
    try {
      await ctx.internalAdapter.linkAccount({
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: await ctx.password.hash(input.password),
      });
    } catch (err) {
      await ctx.internalAdapter.deleteUser(user.id);
      throw err;
    }
    return { id: user.id };
  }

  async hashPassword(password: string) {
    const ctx = await (await getAuth()).$context;
    return ctx.password.hash(password);
  }

  async deleteUser(id: string) {
    const ctx = await (await getAuth()).$context;
    await ctx.internalAdapter.deleteUser(id);
  }
}
