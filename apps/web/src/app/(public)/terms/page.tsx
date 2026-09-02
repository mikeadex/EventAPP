import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section } from '../legal-layout';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Ekklesia.',
};

const CONTACT = 'david@ekklesiaevents.com';
const ADDRESS = '76 Millard Road, Deptford, London SE8 3GB, United Kingdom';

function Mail() {
  return <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="2 September 2026">
      <p>
        These terms govern your use of Ekklesia, a platform where churches and faith-based
        organisations publish events and where attendees discover and book them. By creating an
        account or using the service, you agree to them. Please read section 13 (liability) and
        section 16 (Apple App Store) carefully.
      </p>

      <Section heading="1. Who we are">
        <p>
          Ekklesia is operated by David Taribo, a sole trader trading as Ekklesia Events, based at{' '}
          {ADDRESS}. We are registered with the UK Information Commissioner&rsquo;s Office as a
          data controller.
        </p>
        <p>
          In these terms, &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;Ekklesia&rdquo; mean David
          Taribo trading as Ekklesia Events. &ldquo;You&rdquo; means you as a user, whether you are
          attending events, publishing them, or both.
        </p>
        <p>
          Contact: <Mail />
        </p>
      </Section>

      <Section heading="2. Eligibility">
        <p>
          You must be at least 13 years old to create an account. If you live in the EEA and your
          country requires a higher age to consent to online services, you must meet that higher
          age. If you are under 18, you should have your parent or guardian&rsquo;s permission to
          use Ekklesia and to attend events you book through it.
        </p>
        <p>
          If you create an account on behalf of an organisation, you confirm you are authorised to
          bind that organisation to these terms.
        </p>
      </Section>

      <Section heading="3. Browsing without an account">
        <p>
          You can browse and search events on Ekklesia without creating an account. You need an
          account only to RSVP or book a ticket, save events, or publish events as an
          organisation.
        </p>
      </Section>

      <Section heading="4. Accounts">
        <p>
          Provide accurate details and keep your password secure. You are responsible for activity
          that takes place under your account, and you should tell us immediately at <Mail /> if
          you think someone else has accessed it.
        </p>
        <p>
          You can delete your account at any time from Settings → Delete account in the mobile
          app, or at <Link href="/delete-account">ekklesiaevents.com/delete-account</Link>. See our{' '}
          <Link href="/privacy">Privacy Policy</Link> for what happens to your data.
        </p>
        <p>
          We may suspend or close accounts that breach these terms, that we reasonably believe are
          being used fraudulently, or where we are required to by law. Where we do this we will
          tell you why, unless telling you would be unlawful or would compromise an investigation,
          and you can appeal by writing to <Mail />.
        </p>
      </Section>

      <Section heading="5. Our role in bookings">
        <p>
          Events are created and run by independent organisations, not by Ekklesia. We provide the
          platform that lists them and issues tickets and RSVPs.
        </p>
        <p>
          The organiser is responsible for the event itself — its description, timing, venue,
          accessibility, safety, safeguarding and delivery. Any contract for attendance is between
          you and the organiser. We are not a party to it, we do not vet organisers beyond basic
          account checks, and we do not verify the accuracy of listings before they are published.
        </p>
        <p>
          We will help mediate a dispute with an organiser where we reasonably can, and we will
          act on reports of misleading or fraudulent listings under section 8.
        </p>
      </Section>

      <Section heading="6. RSVPs, tickets and payment">
        <p>
          All events on Ekklesia are currently free. Booking a place means submitting an RSVP; no
          payment is taken, either by us or by the organiser through the platform.
        </p>
        <p>
          When you RSVP, your name and email address are passed to the organising organisation so
          it can manage attendance. See our <Link href="/privacy">Privacy Policy</Link> for what that
          means.
        </p>
        <p>
          RSVPs and tickets are personal to you and may not be resold. We may void an RSVP or
          ticket obtained fraudulently or in breach of these terms. If you can no longer attend,
          cancel your RSVP in the app so the place goes to someone else.
        </p>
        <p>
          <strong>If paid ticketing launches.</strong> We may introduce paid events in future. If
          we do, we will update these terms and give you notice under section 15 before any charge
          applies. At that point payment would be processed by Stripe, the organiser would receive
          the proceeds less our platform fee, and refunds would follow the organiser&rsquo;s stated
          policy for the event. Note that under the Consumer Contracts (Information, Cancellation
          and Additional Charges) Regulations 2013, tickets for events on a specified date are not
          covered by the usual 14-day cancellation right.
        </p>
      </Section>

      <Section heading="7. Organiser responsibilities">
        <p>If you publish events on Ekklesia, you confirm and agree that:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>you are authorised to act for the organisation you are publishing under;</li>
          <li>
            your listings are accurate, complete and not misleading, including on price, capacity,
            timing, venue and accessibility;
          </li>
          <li>
            you hold any licences, permissions, insurance and safeguarding measures the event
            requires, and you comply with applicable health and safety law;
          </li>
          <li>
            where children or vulnerable adults will attend, you have appropriate safeguarding
            policies and DBS checks in place;
          </li>
          <li>
            you will honour bookings made through the platform, and will notify attendees promptly
            if an event changes or is cancelled;
          </li>
          <li>
            you will handle attendee data you receive in line with applicable data protection law,
            as an independent controller, and will not use it for marketing without a lawful basis
            for doing so; and
          </li>
          <li>
            you will not use Ekklesia to solicit donations or payments outside the platform in a
            way that misleads attendees.
          </li>
        </ul>
        <p>
          You are responsible for your listings and for your event. You agree to indemnify us
          against claims, losses and reasonable costs arising from your breach of this section,
          from your event, or from content you publish. This does not apply to claims arising from
          our own breach or negligence.
        </p>
      </Section>

      <Section heading="8. Acceptable use, content standards and reporting">
        <p>We have zero tolerance for objectionable content and abusive behaviour.</p>
        <p>You must not use Ekklesia to post or share content that is:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>unlawful, or that promotes or facilitates unlawful activity;</li>
          <li>
            hateful, harassing, threatening, or that attacks or demeans people on the basis of
            race, ethnicity, national origin, religion, disability, sex, gender identity, sexual
            orientation or age;
          </li>
          <li>sexually explicit, violent or graphic;</li>
          <li>
            fraudulent, deceptive or a misleading listing for an event that will not take place as
            described;
          </li>
          <li>infringing on someone else&rsquo;s intellectual property or privacy; or</li>
          <li>
            spam, or an attempt to disrupt the service or gain unauthorised access to it.
          </li>
        </ul>
        <p>
          <strong>Reporting.</strong> You can report an event listing, an organisation or a user
          from within the app, or by emailing <Mail />. We review every report and act on
          objectionable content within 24 hours of receiving it, removing the content and, where
          appropriate, suspending or permanently ejecting the account responsible.
        </p>
        <p>
          <strong>Blocking.</strong> You can block a user or an organisation from within the app.
          Blocking hides their content from you and prevents them contacting you through the
          platform.
        </p>
        <p>
          <strong>Filtering.</strong> We screen uploaded content and listings for objectionable
          material before and after publication, and we act on what we find.
        </p>
        <p>
          <strong>Appeals.</strong> If we remove your content or restrict your account, we will
          tell you what we removed and why. You can appeal to <Mail /> and we will review the
          decision.
        </p>
      </Section>

      <Section heading="9. Content you upload">
        <p>
          You keep ownership of the images and text you upload. You grant us a worldwide,
          non-exclusive, royalty-free licence to host, store, reproduce, adapt for display, and
          distribute that content for the purpose of operating, improving and promoting the
          service. This licence ends when you delete the content, except for copies retained in
          backups for a reasonable period and where we must keep a record under section 8.
        </p>
        <p>
          You confirm you have the rights to everything you upload, including permission from any
          identifiable people shown in photographs, and that your content does not infringe
          anyone&rsquo;s rights.
        </p>
        <p>
          If you believe content on Ekklesia infringes your copyright, contact <Mail /> with
          details of the work, the location of the content, and a statement that you are authorised
          to act. We will investigate and remove infringing content.
        </p>
      </Section>

      <Section heading="10. Our intellectual property">
        <p>
          The Ekklesia name, logo, software, design and content are owned by us or licensed to us.
          These terms give you a personal, non-transferable, revocable licence to use the app and
          website for their intended purpose. You may not copy, reverse engineer, scrape, or build
          a competing service from our platform.
        </p>
      </Section>

      <Section heading="11. Availability">
        <p>
          We work hard to keep Ekklesia available, accurate and secure, but we do not guarantee
          uninterrupted or error-free service. We may suspend the service for maintenance, and we
          will give notice where we reasonably can. We may change or discontinue features; if we
          discontinue something significant, we will give you reasonable notice.
        </p>
      </Section>

      <Section heading="12. Ending these terms">
        <p>You may stop using Ekklesia and delete your account at any time.</p>
        <p>
          We may suspend or end your access if you materially breach these terms, if we are
          required to by law, or if we discontinue the service. If we discontinue the service
          entirely we will give you at least 30 days&rsquo; notice and will help organisers export
          their attendee lists.
        </p>
        <p>
          Sections 9 (your licence to us, as to content already published), 13, 14 and 17 survive
          termination.
        </p>
      </Section>

      <Section heading="13. Liability">
        <p>Nothing in these terms limits or excludes our liability for:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>death or personal injury caused by our negligence;</li>
          <li>fraud or fraudulent misrepresentation;</li>
          <li>
            breach of your statutory rights as a consumer, including your rights under the
            Consumer Rights Act 2015 to have digital services supplied with reasonable care and
            skill; or
          </li>
          <li>anything else that cannot lawfully be limited or excluded.</li>
        </ul>
        <p>Subject to that:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            We are not liable for the acts or omissions of event organisers, for the events
            themselves, or for anything that happens at an event. Our role is to provide the
            listing and booking platform.
          </li>
          <li>
            We are not liable for loss that was not reasonably foreseeable at the time you started
            using the service, for business losses, or for indirect or consequential loss.
          </li>
          <li>
            Our total liability to you arising out of or in connection with these terms is limited
            to £100, or to the total amount you have paid us in the 12 months before the claim,
            whichever is greater. (Note that we do not currently charge attendees anything.)
          </li>
        </ul>
        <p>
          If you are a consumer, you have legal rights that these terms do not affect. You can get
          free advice from Citizens Advice at{' '}
          <a href="https://www.citizensadvice.org.uk" rel="noreferrer">
            citizensadvice.org.uk
          </a>
          .
        </p>
      </Section>

      <Section heading="14. Governing law and disputes">
        <p>
          These terms are governed by the law of England and Wales. Disputes may be brought in the
          courts of England and Wales.
        </p>
        <p>
          If you are a consumer resident in Scotland, Northern Ireland, or an EEA country, you keep
          the benefit of any mandatory consumer protection rules of your home country, and you may
          bring proceedings in your local courts.
        </p>
        <p>
          Before going to court, please contact us at <Mail /> so we can try to resolve things
          directly.
        </p>
      </Section>

      <Section heading="15. Changes to these terms">
        <p>
          We may update these terms to reflect changes to the service, to the law, or to how we
          operate. For material changes — including any introduction of charges — we will give you
          at least 30 days&rsquo; notice by email or in the app before they take effect. If you do
          not accept a change, you may close your account before it takes effect at no cost. Minor
          changes that do not affect your rights take effect when posted, and the date at the top
          will be updated.
        </p>
      </Section>

      <Section heading="16. Additional terms for the Apple App Store">
        <p>These terms apply if you downloaded the Ekklesia app from the Apple App Store.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            These terms are between you and us only, not with Apple. We, not Apple, are solely
            responsible for the app and its content.
          </li>
          <li>
            Your licence to use the app is a non-transferable licence to use it on any
            Apple-branded device you own or control, as permitted by the App Store Terms of
            Service.
          </li>
          <li>Apple has no obligation to provide maintenance or support for the app.</li>
          <li>
            If the app fails to conform to any applicable warranty, you may notify Apple, and Apple
            will refund the purchase price (if any). To the maximum extent permitted by law, Apple
            has no other warranty obligation with respect to the app. Any other claims, losses,
            liabilities, damages, costs or expenses attributable to a failure to conform to a
            warranty are our responsibility.
          </li>
          <li>
            We, not Apple, are responsible for addressing any claims relating to the app, including
            product liability claims, claims that the app fails to conform to a legal or regulatory
            requirement, and claims arising under consumer protection or similar legislation.
          </li>
          <li>
            If a third party claims the app infringes their intellectual property rights, we, not
            Apple, are responsible for the investigation, defence, settlement and discharge of that
            claim.
          </li>
          <li>
            You confirm that you are not located in a country subject to a US Government embargo or
            designated as a &ldquo;terrorist supporting&rdquo; country, and that you are not on any
            US Government list of prohibited or restricted parties.
          </li>
          <li>
            Apple and its subsidiaries are third-party beneficiaries of these terms and, on your
            acceptance of them, will have the right to enforce them against you.
          </li>
        </ul>
      </Section>

      <Section heading="17. General">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Severability.</strong> If any part of these terms is found unenforceable, the
            rest remains in force.
          </li>
          <li>
            <strong>No waiver.</strong> If we do not enforce a right straight away, we do not lose
            it.
          </li>
          <li>
            <strong>Assignment.</strong> You may not transfer your rights under these terms. We may
            transfer ours to a company that takes over our business, provided your rights are not
            reduced.
          </li>
          <li>
            <strong>Entire agreement.</strong> These terms and the{' '}
            <Link href="/privacy">Privacy Policy</Link> are the whole agreement between us regarding the
            service.
          </li>
        </ul>
      </Section>

      <Section heading="18. Contact and complaints">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Support, content reports and privacy:</strong> <Mail />
          </li>
          <li>
            <strong>Post:</strong> David Taribo, trading as Ekklesia Events, {ADDRESS}
          </li>
        </ul>
        <p>
          For users in the EU, the above addresses are also our single point of contact for the
          purposes of the Digital Services Act. You may contact us in English.
        </p>
      </Section>
    </LegalPage>
  );
}
