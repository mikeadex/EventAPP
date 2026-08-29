-- Grandfather every account that existed before email verification was enforced.
--
-- requireEmailVerification is being turned on for email/password sign-in. Without
-- this, everyone who signed up earlier would be locked out of an app they are
-- already using — they never had a verification email to act on, and the sign-in
-- they have always used would simply start failing.
--
-- Deliberately unconditional on provider. Social accounts are already true (Google
-- and Apple assert the address), so they are unaffected; email/password accounts
-- are the ones this rescues. Enforcement applies from here on to new signups only.
--
-- Must run BEFORE the deploy that flips the flag, not after.
UPDATE "User"
SET "emailVerified" = true
WHERE "emailVerified" = false;
