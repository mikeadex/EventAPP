import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to permanently delete your Ekklesia account and what happens to your data.',
};

const CONTACT = 'david@ekklesiaevents.com';

/**
 * How to delete an account without the app installed.
 *
 * Required by App Store guideline 5.1.1(v) — an app that supports account
 * creation must let people delete the account, and the route cannot depend on
 * still having the app. Someone who deleted it from their phone first is
 * exactly the person who needs this page.
 *
 * Deliberately a static page rather than a form. A deletion request form that
 * anyone can submit against any email address is a way to attack other people's
 * accounts; deletion belongs behind a signed-in session, which is what the
 * in-app route already is.
 */
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your account" updated="2 September 2026">
      <p>
        You can permanently delete your Ekklesia account at any time. Deletion is
        immediate for your profile and sign-in details, and completes in full within
        30 days.
      </p>

      <Section heading="If you have the app">
        <p>
          Open Ekklesia and go to <strong>Settings → Delete account</strong>. You will be
          asked to confirm, and the account is removed straight away.
        </p>
      </Section>

      <Section heading="If you no longer have the app">
        <p>
          Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address on your
          account, asking us to delete it. We reply within two working days and complete
          the deletion within 30 days.
        </p>
        <p>
          We ask you to write from the account address because we cannot delete an
          account on the word of someone who might not own it. If you no longer have
          access to that mailbox, say so and we will find another way to confirm it is
          you.
        </p>
      </Section>

      <Section heading="What gets deleted">
        <p>
          Your profile, password and sign-in sessions, saved events, RSVPs and tickets,
          and your membership of any organisation.
        </p>
      </Section>

      <Section heading="What is kept, and why">
        <p>
          Two kinds of record survive, with your identity removed from them:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Trust and safety records</strong> — reports and moderation decisions.
            Erasing these would let a banned account return by deleting and signing up
            again.
          </li>
          <li>
            <strong>Financial records</strong>, where any exist, because UK tax law
            requires transaction records to be kept for six years. Ekklesia does not
            currently process payments, so for most people there are none.
          </li>
        </ul>
        <p>
          By &ldquo;identity removed&rdquo; we mean your name, email and account
          identifier are replaced with a reference that cannot be reversed. We do not
          keep a key that would let us link those records back to you.
        </p>
      </Section>

      <Section heading="If you run an organisation">
        <p>
          If you are the only owner of an organisation, we will ask you to transfer
          ownership to someone else first. If you would rather not, you can choose to
          have its upcoming events unpublished and the organisation archived as part of
          the deletion — your account deletion is never blocked by this.
        </p>
      </Section>

      <Section heading="Questions">
        <p>
          Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See our{' '}
          <Link href="/privacy">Privacy Policy</Link> for the full detail on retention.
        </p>
      </Section>
    </LegalPage>
  );
}
