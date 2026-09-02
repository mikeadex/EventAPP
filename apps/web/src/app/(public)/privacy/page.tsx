import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalTable, Section } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Ekklesia collects, uses and protects your personal data.',
};

const CONTACT = 'david@ekklesiaevents.com';
const ADDRESS = '76 Millard Road, Deptford, London SE8 3GB, United Kingdom';

/** Written as a mailto so the address is never a dead-end piece of text. */
function Mail() {
  return <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2 September 2026">
      <p>
        Ekklesia is a platform for discovering and attending events run by churches and
        faith-based organisations. This policy explains what personal data we collect, why we
        collect it, the legal bases we rely on, and the choices you have. It applies to our
        website at ekklesiaevents.com and to our iOS and Android apps.
      </p>
      <p>
        You can browse events on Ekklesia without an account. You only need to sign in if you
        want to RSVP to an event, save events, or publish events as an organisation.
      </p>

      <Section heading="1. Who we are">
        <p>
          Ekklesia is operated by <strong>David Taribo</strong>, a sole trader trading as{' '}
          <strong>Ekklesia Events</strong>, based at {ADDRESS}. David Taribo is the data
          controller for the personal data described in this policy. In this policy,
          &ldquo;Ekklesia&rdquo; refers to the platform and apps operated under that trading
          name.
        </p>
        <p>
          We are registered with the UK Information Commissioner&rsquo;s Office as a data
          controller.
        </p>
        <p>
          You can reach us about anything in this policy, including to exercise your rights, at{' '}
          <strong>
            <Mail />
          </strong>
          . We aim to acknowledge within two working days.
        </p>
      </Section>

      <Section heading="2. Data we collect">
        <p>
          <strong>Account details.</strong> Your name, email address and password. Passwords are
          stored only as salted hashes; we never see or store the plaintext.
        </p>
        <p>
          <strong>Activity on the platform.</strong> Events you save, RSVPs and tickets you
          hold, the organisations you belong to, and your chosen location for finding nearby
          events.
        </p>
        <p>
          <strong>Images you upload.</strong> Event cover images, organisation logos and profile
          pictures.
        </p>
        <p>
          <strong>Communications.</strong> Messages you send us, including reports you submit
          about content or other users, and our correspondence with you.
        </p>
        <p>
          <strong>Technical and security data.</strong> Your IP address and device or browser
          user agent, recorded alongside security-relevant actions such as sign-in attempts and
          content reports, so we can investigate abuse.
        </p>
        <p>
          <strong>Diagnostic data.</strong> <em>Not currently collected.</em> We do not use a
          crash reporting or analytics SDK in our apps. Our servers keep operational error logs,
          which may incidentally include the technical and security data described above. If we
          introduce crash reporting, we will update this policy before doing so.
        </p>
        <p>
          <strong>Payment records.</strong> <em>Not currently collected.</em> Ekklesia does not
          process payments at this time and every event on the platform is free. If and when
          paid ticketing launches, we will collect the order, amount and status of your
          transactions, and we will update this policy before that happens. Card details would
          in any case be entered directly with our payment processor and would never reach our
          servers.
        </p>
      </Section>

      <Section heading="3. Information about religious beliefs">
        <p>
          Ekklesia lists events run by churches and faith-based organisations. Because of this,
          the fact that you have RSVP&rsquo;d to a particular event may reveal something about
          your religious or philosophical beliefs. Under UK and EU data protection law that is a{' '}
          <strong>special category of personal data</strong>, which carries extra protection.
        </p>
        <p>
          We rely on your <strong>explicit consent</strong> to process this information. You give
          that consent when you create an account, and you can withdraw it at any time by
          deleting your account or by contacting us at <Mail />. Withdrawing consent does not
          affect processing carried out before you withdrew it, but it does mean we can no longer
          hold your RSVP history.
        </p>
        <p>
          You can browse the whole platform without giving this consent, because browsing does
          not require an account and we do not record who views which event.
        </p>
        <p>
          We have an appropriate policy document in place governing our processing of special
          category data, as required by the Data Protection Act 2018. You can request a copy from{' '}
          <Mail />.
        </p>
      </Section>

      <Section heading="4. How we use your data, and our legal bases">
        <LegalTable
          columns={['What we do', 'Why', 'Legal basis']}
          rows={[
            [
              'Create and maintain your account, authenticate you',
              'To give you access to the service',
              'Performance of a contract with you',
            ],
            [
              'Take and confirm RSVPs, issue and validate tickets',
              'To deliver the core service you asked for',
              'Performance of a contract with you',
            ],
            [
              'Record that you are attending a faith-based event',
              'Inherent in taking an RSVP',
              'Explicit consent (Article 9(2)(a))',
            ],
            [
              'Show you events relevant to your chosen location',
              'To make the service useful',
              'Performance of a contract with you',
            ],
            [
              'Send transactional email — RSVP confirmations, password resets, event changes',
              'To keep you informed about bookings you made',
              'Performance of a contract with you',
            ],
            [
              'Send push notifications about your bookings',
              'To keep you informed',
              'Your consent, given at the OS permission prompt',
            ],
            [
              'Investigate abuse, fraud and security incidents; moderate content',
              'To keep the platform safe for everyone',
              'Our legitimate interests in running a safe platform',
            ],
            [
              'Diagnose faults and improve reliability',
              'To keep the service working',
              'Our legitimate interests in maintaining the service',
            ],
            ['Retain financial and tax records', 'Because the law requires it', 'Legal obligation'],
            ['Respond to legal requests', 'Because the law requires it', 'Legal obligation'],
          ]}
        />
        <p>
          We do <strong>not</strong> sell your personal data. We do <strong>not</strong> use it
          for advertising, behavioural profiling, or automated decision-making that produces legal
          or similarly significant effects.
        </p>
      </Section>

      <Section heading="5. Device permissions">
        <p>
          The mobile app can add an event to your calendar and open a venue in your maps app.
          Both actions happen only when you tap them, and both hand off to your device&rsquo;s
          own system apps. We do not read your calendar, your contacts or your location, and the
          app does not request background location access.
        </p>
        <p>
          If you allow push notifications, you can turn them off at any time in your device
          settings.
        </p>
      </Section>

      <Section heading="6. Who we share data with">
        <p>
          <strong>Service providers acting on our behalf.</strong> We share the minimum necessary
          with:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Vercel</strong> — application and website hosting
          </li>
          <li>
            <strong>Neon</strong> — database hosting
          </li>
          <li>
            <strong>Backblaze B2</strong> — storage of uploaded images
          </li>
          <li>
            <strong>Resend</strong> — sending account and RSVP emails
          </li>
          <li>
            <strong>Expo</strong> — delivering push notifications to your device
          </li>
          <li>
            <strong>Stripe</strong> — payment processing (
            <em>inactive; will apply only when paid ticketing launches</em>)
          </li>
        </ul>
        <p>
          Each of these is bound by a written data processing agreement and may only use your
          data on our instructions.
        </p>
        <p>
          <strong>Event organisers.</strong> When you RSVP to an event, the organisation running
          that event receives your name and email address so it can manage attendance. From that
          point the organisation is an <strong>independent data controller</strong> of your
          information and its own privacy practices apply, not ours. We tell you which
          organisation will receive your details before you confirm an RSVP. If you want your
          data removed from an organiser&rsquo;s records, contact the organiser directly; we will
          help you get in touch if you need us to.
        </p>
        <p>
          <strong>Legal disclosures.</strong> We may disclose data where we are legally required
          to, or where it is necessary to establish, exercise or defend legal claims, or to
          protect someone&rsquo;s vital interests.
        </p>
        <p>We do not share your data with anyone else.</p>
      </Section>

      <Section heading="7. International transfers">
        <p>
          Some of our service providers process data outside the UK and the European Economic
          Area, including in the United States. Where that happens, we rely on:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            the UK Government&rsquo;s adequacy regulations or the European Commission&rsquo;s
            adequacy decisions, where these cover the country in question; or
          </li>
          <li>
            the UK International Data Transfer Agreement, or the EU Standard Contractual Clauses
            together with the UK Addendum, supported by a transfer risk assessment.
          </li>
        </ul>
        <p>
          You can request details of the safeguards applying to a specific transfer at <Mail />.
        </p>
      </Section>

      <Section heading="8. How long we keep data">
        <LegalTable
          columns={['Data', 'Retention']}
          rows={[
            ['Account details and profile', 'Until you delete your account'],
            ['RSVPs, tickets and saved events', 'Until you delete your account'],
            [
              'Images you upload',
              'Until you or your organisation delete them, or until account deletion',
            ],
            ['Security logs (IP, user agent)', '12 months from the event recorded'],
            [
              'Trust and safety records (reports, moderation actions)',
              '3 years from the action, in de-identified form after account deletion',
            ],
            [
              'Financial and tax records',
              <>
                6 years from the end of the relevant accounting period, as required by UK tax law
                (<em>not currently applicable — no payments are processed</em>)
              </>,
            ],
            ['Support correspondence', '2 years from last contact'],
          ]}
        />
      </Section>

      <Section heading="9. Deleting your account">
        <p>
          You can permanently delete your account at any time from{' '}
          <strong>Settings → Delete account</strong> in the mobile app, or by visiting{' '}
          <Link href="/delete-account">ekklesiaevents.com/delete-account</Link> if you no longer have
          the app installed. We complete deletion within 30 days.
        </p>
        <p>
          Deletion removes your profile, credentials, sessions, saved events, RSVPs and
          organisation memberships.
        </p>
        <p>
          If you are the only owner of an organisation, we will ask you to transfer ownership
          first. If you would rather not, you can choose to have the organisation&rsquo;s upcoming
          events unpublished and the organisation archived as part of the deletion, so your
          account deletion is never blocked.
        </p>
        <p>Two categories of record survive deletion in de-identified form:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Trust and safety records</strong>, because removing moderation history would
            let banned users return and would undermine platform safety.
          </li>
          <li>
            <strong>Financial records</strong>, where these exist, because we are required to
            retain transaction records for tax and accounting purposes.
          </li>
        </ul>
        <p>
          To be precise about what &ldquo;de-identified&rdquo; means here: we sever the link
          between the record and your identity by removing your name, email and account
          identifier and replacing them with a non-reversible reference. We do not retain a key
          that would let us re-link these records to you.
        </p>
      </Section>

      <Section heading="10. Security">
        <p>
          We protect your data using encryption in transit (TLS) and at rest, salted password
          hashing, access controls limiting staff access to what is necessary, and logging of
          security-relevant actions. No system is perfectly secure, but if a breach occurs that is
          likely to result in a risk to your rights and freedoms, we will notify the ICO within 72
          hours and notify you without undue delay where the risk is high.
        </p>
      </Section>

      <Section heading="11. Your rights">
        <p>
          Depending on where you live, including under the UK GDPR and EU GDPR, you have the right
          to:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>access</strong> the personal data we hold about you;
          </li>
          <li>
            <strong>correct</strong> data that is inaccurate or incomplete;
          </li>
          <li>
            <strong>erase</strong> your data (see section 9);
          </li>
          <li>
            <strong>restrict</strong> or <strong>object to</strong> processing based on our
            legitimate interests;
          </li>
          <li>
            <strong>portability</strong> — receive your data in a structured, machine-readable
            format;
          </li>
          <li>
            <strong>withdraw consent</strong> at any time, where we rely on consent; and
          </li>
          <li>
            <strong>complain</strong> to a data protection authority.
          </li>
        </ul>
        <p>
          Contact <Mail /> to exercise any of these. We respond within one month, and will tell
          you if we need longer for a complex request.
        </p>
        <p>
          If you are in the UK you can complain to the Information Commissioner&rsquo;s Office at{' '}
          <a href="https://ico.org.uk" rel="noreferrer">
            ico.org.uk
          </a>{' '}
          or on 0303 123 1113. If you are in the EEA you can complain to your national supervisory
          authority.
        </p>
      </Section>

      <Section heading="12. Cookies and similar technologies">
        <p>
          Our website uses a small number of strictly necessary cookies to keep you signed in and
          to protect against cross-site request forgery. These are exempt from consent
          requirements because the service cannot work without them. We do not use advertising,
          tracking or third-party analytics cookies. The mobile apps do not use cookies; they
          store an authentication token in your device&rsquo;s secure storage.
        </p>
      </Section>

      <Section heading="13. Children">
        <p>
          You must be at least <strong>13 years old</strong> to create an Ekklesia account. In the
          EEA, where your country sets a higher age for consenting to online services, that higher
          age applies (16 in some member states).
        </p>
        <p>
          Ekklesia is not directed at children, and we do not knowingly collect personal data from
          anyone below these ages. Family-oriented events may be listed on the platform, but
          accounts are intended for adults and for older children with their parent&rsquo;s
          involvement. If you believe a child has created an account, contact <Mail /> and we will
          remove it promptly.
        </p>
      </Section>

      <Section heading="14. Changes to this policy">
        <p>
          If we make material changes we will update the date at the top and notify you in the app
          or by email before the changes take effect. Previous versions are available on request.
        </p>
      </Section>

      <Section heading="15. Contact">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Privacy, data protection and general support:</strong> <Mail />
          </li>
          <li>
            <strong>Post:</strong> David Taribo, trading as Ekklesia Events, {ADDRESS}
          </li>
        </ul>
      </Section>
    </LegalPage>
  );
}
