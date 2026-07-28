import type { Metadata } from 'next';
import { LegalPage, Section } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Ekklesia.',
};

const CONTACT = process.env.NEXT_PUBLIC_SUPPORT_CONTACT ?? 'support@ekklesia.app';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="27 July 2026">
      <p>
        These terms govern your use of Ekklesia, a marketplace where churches and faith-based
        organisations publish events and attendees discover and book them. By creating an
        account or using the service, you agree to them.
      </p>

      <Section heading="Accounts">
        <p>
          You must provide accurate details and keep your password secure. You are responsible
          for activity under your account. You can delete your account at any time from Settings
          in the mobile app. We may suspend accounts that breach these terms or that we
          reasonably believe are being used fraudulently.
        </p>
      </Section>

      <Section heading="Our role in bookings">
        <p>
          Events are created and run by independent organisations, not by Ekklesia. We provide
          the platform that lists them and issues tickets. The organiser is responsible for the
          event itself — its description, timing, venue, safety and delivery. Any contract for
          attendance is between you and the organiser.
        </p>
      </Section>

      <Section heading="Tickets, payment and refunds">
        <p>
          Many events are free to attend and simply require an RSVP. Where an event is paid,
          payment is processed by Stripe and the organiser receives the proceeds less our
          platform fee. Refunds are determined by the organiser&apos;s policy for that event; if
          an event is cancelled, contact the organiser in the first instance. We will help
          mediate where we reasonably can.
        </p>
        <p>
          Tickets are personal to you and may not be resold for profit. We may void tickets
          obtained fraudulently.
        </p>
      </Section>

      <Section heading="Organiser responsibilities">
        <p>
          If you publish events, you confirm you are authorised to act for the organisation, that
          your listings are accurate and lawful, and that you hold any necessary licences,
          insurance and safeguarding measures. You are responsible for handling attendee data
          you receive in line with applicable data protection law.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          Do not use Ekklesia to post unlawful, misleading, hateful or harassing content, to
          infringe others&apos; intellectual property, to run fraudulent listings, or to attempt
          to disrupt or gain unauthorised access to the service. You can report a listing or an
          organisation from within the app; we review reports and may remove content or suspend
          accounts.
        </p>
      </Section>

      <Section heading="Content you upload">
        <p>
          You keep ownership of images and text you upload. You grant us a licence to host,
          display and distribute that content for the purpose of operating and promoting the
          service. You confirm you have the rights to anything you upload, including permission
          from identifiable people shown in photographs.
        </p>
      </Section>

      <Section heading="Availability and liability">
        <p>
          The service is provided on an &quot;as is&quot; basis. We work to keep it available and
          accurate but we do not guarantee uninterrupted service. To the fullest extent permitted
          by law, we are not liable for indirect or consequential loss, or for the acts or
          omissions of event organisers. Nothing in these terms limits liability that cannot be
          limited by law, including for death or personal injury caused by negligence, or your
          statutory consumer rights.
        </p>
      </Section>

      <Section heading="Changes and contact">
        <p>
          We may update these terms; material changes will be reflected in the date above.
          Continued use after a change means you accept the revised terms. Questions:{' '}
          <a className="text-brand-600 underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
