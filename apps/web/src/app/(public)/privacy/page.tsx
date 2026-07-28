import type { Metadata } from 'next';
import { LegalPage, Section } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Ekklesia collects, uses and protects your personal data.',
};

const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? 'privacy@ekklesia.app';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="27 July 2026">
      <p>
        Ekklesia is a marketplace for discovering and attending events run by churches and
        faith-based organisations. This policy explains what personal data we collect, why we
        collect it, and the choices you have. It applies to our website and our iOS and Android
        apps.
      </p>

      <Section heading="Data we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account details</strong> — your name, email address and password. Passwords
            are stored only as salted hashes; we never see or store the plaintext.
          </li>
          <li>
            <strong>Activity in the app</strong> — events you save, tickets and RSVPs you hold,
            and organisations you belong to.
          </li>
          <li>
            <strong>Payment records</strong> — for paid tickets, the order, amount and status.
            Card details are entered directly with our payment processor and never reach our
            servers.
          </li>
          <li>
            <strong>Images you upload</strong> — event covers, organisation logos and profile
            pictures.
          </li>
          <li>
            <strong>Technical data</strong> — IP address and device/browser user agent, recorded
            alongside security-relevant actions so we can investigate abuse.
          </li>
        </ul>
      </Section>

      <Section heading="How we use it">
        <p>
          We use your data to run the service: authenticating you, issuing and validating
          tickets, showing events relevant to your chosen location, sending transactional email
          such as RSVP confirmations and password resets, and keeping the platform safe. We do
          not sell your personal data, and we do not use it for advertising or behavioural
          profiling.
        </p>
      </Section>

      <Section heading="Device permissions">
        <p>
          The mobile app can add an event to your calendar and open a venue in your maps app.
          Both actions happen only when you tap them, and both hand off to your device&apos;s own
          system apps — we do not read your calendar, contacts or location. The app does not
          request background location access.
        </p>
      </Section>

      <Section heading="Who we share it with">
        <p>
          We share the minimum necessary with service providers who process data on our behalf:
          our cloud hosting and database provider, our object storage provider for uploaded
          images, Stripe for payment processing, and our transactional email provider. Event
          organisers can see the attendee list for their own events, including your name and
          email, so they can manage attendance. We may disclose data where we are legally
          required to.
        </p>
      </Section>

      <Section heading="Retention and deletion">
        <p>
          You can permanently delete your account at any time from{' '}
          <strong>Settings → Delete account</strong> in the mobile app. Doing so removes your
          profile, credentials, sessions, saved events and organisation memberships.
        </p>
        <p>
          Financial records (orders, payments, donations) and trust &amp; safety records
          (reports and moderation actions) are retained in anonymised form after deletion — the
          record survives, but it is no longer linked to you. We keep these because we are
          required to retain transaction records for tax and accounting purposes, and because
          deleting moderation history would undermine platform safety.
        </p>
        <p>
          If you are the only owner of an organisation, you will be asked to transfer ownership
          or delete the organisation before deleting your account, so its events are not left
          unmanaged.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Depending on where you live — including under the UK GDPR and EU GDPR — you have the
          right to access, correct, export or erase your personal data, to object to or restrict
          certain processing, and to complain to your data protection authority. Contact us at{' '}
          <a className="text-brand-600 underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{' '}
          to exercise these rights.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          Ekklesia is not directed at children under 13, and we do not knowingly collect their
          personal data. Family-oriented events may be listed on the platform, but accounts are
          intended for adults. If you believe a child has created an account, contact us and we
          will remove it.
        </p>
      </Section>

      <Section heading="Changes and contact">
        <p>
          If we make material changes to this policy we will update the date above and, where
          appropriate, notify you in the app. Questions or requests:{' '}
          <a className="text-brand-600 underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
