import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with Ekklesia, report a problem, or contact us.',
};

const CONTACT = 'david@ekklesiaevents.com';

function Mail() {
  return <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
}

/**
 * The Support URL for the App Store and Play listings, and the published point
 * of contact that App Store guideline 1.2 requires of an app carrying
 * user-generated content.
 *
 * Kept as a real page rather than pointing the listing at the home page: a
 * reviewer follows that link, and so does anyone with a problem at 9pm the
 * night before an event.
 */
export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="14 September 2026">
      <p>
        Email <strong><Mail /></strong> and a person will read it. We reply within two working
        days, and faster for anything about safety.
      </p>

      <Section heading="Reporting something on Ekklesia">
        <p>
          If a listing, organisation or person on Ekklesia is misleading, abusive or unsafe, report
          it from inside the app — there is a <strong>Report</strong> option on every event and
          every host page — or email <Mail /> if you would rather not use the app.
        </p>
        <p>
          <strong>We review every report and act on objectionable content within 24 hours.</strong>{' '}
          Reports are private: the person or organisation reported is not told who reported them.
        </p>
        <p>
          You can also <strong>block</strong> a host or a person from their page in the app. Their
          events stop appearing for you, they are not notified, and you can undo it at any time
          from Settings → Blocked.
        </p>
        <p>
          If someone is in immediate danger, contact the emergency services first. We will help
          however we can afterwards.
        </p>
      </Section>

      <Section heading="Common questions">
        <p>
          <strong>I can&rsquo;t sign in.</strong> If you have just signed up, check your email for a
          verification link — you need to confirm your address before your first sign-in. The link
          lasts 24 hours; the sign-in page will send a fresh one if yours has expired.
        </p>
        <p>
          <strong>My verification email never arrived.</strong> Check your spam folder, then try
          signing in — you will be offered a new link. If it still does not arrive, email us.
        </p>
        <p>
          <strong>I want to cancel an RSVP.</strong> Open the event in the app and cancel there, so
          your place goes to someone else.
        </p>
        <p>
          <strong>I run a church and want to list events.</strong> Create an account, then choose
          &ldquo;Manage your events&rdquo; from your profile to set your organisation up.
        </p>
        <p>
          <strong>I want to delete my account.</strong> See{' '}
          <Link href="/delete-account">deleting your account</Link>.
        </p>
      </Section>

      <Section heading="Contact">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Support, safety reports and privacy:</strong> <Mail />
          </li>
          <li>
            <strong>Post:</strong> David Taribo, trading as Ekklesia Events, 76 Millard Road,
            Deptford, London SE8 3GB, United Kingdom
          </li>
        </ul>
        <p>
          See also our <Link href="/privacy">Privacy Policy</Link> and{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
