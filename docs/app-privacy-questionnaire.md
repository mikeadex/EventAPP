# App Privacy questionnaire — answers

What to select in **App Store Connect → your app → App Privacy**, and why.
Google Play's Data safety form asks mostly the same questions in different
words — but since paid ticketing the two diverge on payment info, so Play has
its own table below rather than carrying the answers over wholesale.

Derived from the code on 7 September 2026 and re-checked against it on
24 November 2026 when paid ticketing landed — each "no" below was checked
against the repo, not assumed. Re-check this document whenever data handling
changes; an answer that no longer matches the app is a compliance problem, not
a paperwork one.

## The short version

**Nothing is used for tracking.** There is no advertising SDK, no analytics SDK,
and no data broker in the app — verified: `apps/mobile/package.json` contains no
analytics, Firebase, Segment, Amplitude, Mixpanel, Facebook, AppsFlyer, Adjust or
Sentry dependency. So answer **"No"** to *Used for Tracking* on every data type,
and no App Tracking Transparency prompt is required.

Everything collected is **linked to the user's identity** — it all hangs off an
account — and every purpose is **App Functionality**.

## Data to declare as collected

| Apple data type | What it actually is | Linked | Tracking | Purpose |
|---|---|---|---|---|
| Contact Info → **Name** | Account name, shown to organisers on an RSVP | Yes | No | App Functionality |
| Contact Info → **Email Address** | Sign-in address; passed to the organiser when you RSVP | Yes | No | App Functionality |
| **Sensitive Info** | See below — this is the one people miss | Yes | No | App Functionality |
| User Content → **Photos or Videos** | Event cover images, organisation logos, profile pictures | Yes | No | App Functionality |
| User Content → **Customer Support** | Content reports and messages sent to us | Yes | No | App Functionality |
| Identifiers → **User ID** | The account id every record hangs off | Yes | No | App Functionality |
| Identifiers → **Device ID** | Expo push token, stored per device (`Device.token`) | Yes | No | App Functionality |
| Location → **Coarse Location** | The city chosen to filter events — see the note below | Yes | No | App Functionality |
| Purchases → **Purchase History** | Orders, amounts, currency and ticket records — see Payments below | Yes | No | App Functionality |
| **Other Data** | IP address and user agent, stored against security events in `AuditLog` | Yes | No | App Functionality |

### Sensitive Info — do not skip this

Apple's *Sensitive Info* category explicitly includes **religious or
philosophical beliefs**. Ekklesia lists events run by churches and faith
organisations, so an RSVP reveals something about the attendee's beliefs.

The Privacy Policy already says this in §3 and treats it as Article 9 special
category data under UK GDPR. If the questionnaire says otherwise, the app's two
public statements about the same data contradict each other — and the policy is
linked from the store listing where a reviewer will read it.

Declare it: **Sensitive Info → collected, linked to the user, not used for
tracking, purpose App Functionality.**

### Coarse Location — a judgement call, declared conservatively

The app **never reads device location**: there is no `expo-location`, no
geolocation call, and no location permission in either native manifest. The city
is picked by the user from a list to filter the feed.

An argument exists that a self-selected city filter is a preference rather than
collected location data. Declaring it is the safer side of that line: it costs
nothing, and under-declaring is the failure mode that causes problems. If you
would rather not, the defensible alternative is to declare nothing under Location
and be ready to explain that no location API is used — but do not declare
*Precise Location*, which would be untrue.

## Data to declare as NOT collected

Each of these was checked, not assumed:

- **Financial Info → Payment Info** — we never see a card. The Stripe payment
  sheet collects it and sends it to Stripe; nothing card-shaped reaches our
  servers or database. Verified: `Order` and `Payment` hold amounts, currency,
  status and Stripe's own ids (`stripePaymentIntentId`, `stripeChargeId`) and
  nothing else — no PAN, no last four, no brand, no expiry.
  **But see the Stripe SDK note under Payments** before answering Play's
  version of this question, which is asked differently.
- **Health & Fitness** — nothing.
- **Location → Precise Location** — no location API in the app at all.
- **Contacts** — never read.
- **Browsing History** / **Search History** — searches are not persisted per user;
  there is no search-history model.
- **Usage Data → Advertising Data** — no advertising anywhere.
- **Usage Data → Product Interaction** — no analytics SDK and no interaction
  logging. (Saved events and RSVPs are declared above as the functional records
  they are, not as analytics.)
- **Diagnostics → Crash Data / Performance Data** — no crash reporting SDK. The
  Privacy Policy says the same, in the same words.
- **Audio Data**, **Gameplay Content** — nothing.

## Payments — new on 24 November 2026

Paid ticketing changed three answers. It was added after the original pass, so
anything filled in before this date is out of date.

### What we store

Orders and payments: amount, currency, status, the event and organisation, and
Stripe's own identifiers. Optionally a guest email. That is **Purchase History**
— declared above as collected, linked, App Functionality.

### What we never store

Card number, last four, brand, expiry, CVC. The app presents Stripe's own
payment sheet and the card goes straight to Stripe. Our database has no column
that could hold one.

### The Stripe SDK question — a judgement call, declared conservatively

Google Play treats data collected by an SDK **embedded in your app** as
collected by your app. `@stripe/stripe-react-native` is embedded, and its sheet
takes a card number and billing postcode inside our UI before sending them to
Stripe. Two readings follow:

- **Narrow:** we never receive it, so we do not collect it.
- **Broad:** it is collected in our app by our SDK, so it must be declared.

**Declare it.** Over-declaring costs nothing; under-declaring is a policy
violation, and Play's own guidance leans to the broad reading for embedded
SDKs. So on the Play form answer **User payment info: collected and shared,
App functionality, not optional** — and keep Apple's **Payment Info** as not
collected, because Apple asks specifically about data *you* receive, which this
is not. The two forms disagreeing here is correct, not an inconsistency.

### Organiser payouts

Setting up payouts sends the organiser to **Stripe's own hosted onboarding** in
a browser, where Stripe collects identity and bank details directly. That is a
user being explicitly directed to a third party, not in-app collection, and is
not declared on either form. We store only `stripeAccountId` and a status.

### Third parties

Stripe is now a processor and belongs in the policy's §6. What goes to Stripe
from our servers is the amount, currency, our own ids and the event title — no
buyer name or email. Confirm §6 names Stripe before submitting.

## Google Play — Data safety, field by field

Play asks per data type: *collected?*, *shared?*, *processed ephemerally?*,
*required or optional?*, and *purpose*. Nothing here is ephemeral — it is all
stored — and nothing is optional except where noted.

**Security practices** (asked once, at the top):
- Data encrypted in transit — **Yes**. Verified 24 Nov 2026: production answers
  over HTTP/2 with `Strict-Transport-Security: max-age=31536000;
  includeSubDomains`, and the iOS build sets
  `NSAllowsArbitraryLoads: false` so the app cannot fall back to cleartext.
- Users can request data deletion — **Yes**, `https://ekklesiaevents.com/delete-account`.
- Committed to the Play Families Policy — **No** (not a children's app; rated 13+).
- Independent security review — **No**.

| Play data type | Collected | Shared | Purpose | Note |
|---|---|---|---|---|
| Personal info › **Name** | Yes | Yes | App functionality | Shared with the organiser whose event you book |
| Personal info › **Email address** | Yes | Yes | App functionality | Same |
| Personal info › **User IDs** | Yes | No | App functionality | Account id |
| **Financial info › User payment info** | **Yes** | **Yes** | App functionality | Collected by the embedded Stripe SDK, shared with Stripe. See the judgement call above — Apple's equivalent is answered No, deliberately |
| **Financial info › Purchase history** | **Yes** | No | App functionality | Orders, amounts, ticket records |
| Photos and videos › **Photos** | Yes | Yes | App functionality | Event covers, logos, profile pictures — public once published |
| Messages › **Other in-app messages** | Yes | No | App functionality | Host announcements, content reports |
| App activity › **Other actions** | Yes | No | App functionality | RSVPs and saved events — functional records, not analytics |
| Location › **Approximate location** | Yes | No | App functionality | The city you pick to filter by. Chosen, never sensed — no location API in the app |
| Device or other IDs › **Device ID** | Yes | No | App functionality | Expo push token, per device |
| **Personal info › Religious beliefs** | Yes | Yes | App functionality | See *Sensitive Info* above. Attending a faith event reveals belief; Play has no exact category, so declare under Personal info › Other info and say so in the policy |

**Declare as not collected:** precise location, contacts, SMS, call logs,
calendar (verified: the only calendar calls are `createEventInCalendarAsync` and the permission request — the app writes an event and never reads one), health and
fitness, web browsing history, installed apps, crash logs, diagnostics,
advertising ID, purchase-free financial data such as credit score.

## Keep these three consistent

The store listing, the questionnaire and the policy are read together:

1. **Privacy Policy URL** on the listing → `https://ekklesiaevents.com/privacy`
2. **This questionnaire**
3. **The policy text itself**, especially §2 (what we collect), §3 (religious
   belief), and §6 (who we share with)

If any answer here changes, change the policy in the same pass.

## Also relevant to review

- **Account deletion** (guideline 5.1.1(v)) — in-app at Settings → Delete
  account, and on the web at `/delete-account` for people who removed the app.
- **Permission strings** — the app declares only calendar, camera and photo
  library, each with a purpose-specific string. Microphone, Reminders and
  `SYSTEM_ALERT_WINDOW` were removed once a prebuild showed they were being
  requested but never used.

---

# Age rating questionnaire — answers

A separate questionnaire from App Privacy, in the same part of App Store
Connect. Apple's current tiers are **4+, 9+, 13+, 16+, 18+** (the old 12+ and
17+ were retired in 2025).

## Content questions — all "None"

Ekklesia ships no content of its own in any of these categories:

- Violence, cartoon/fantasy or realistic — **None**
- Sexual content or nudity — **None**
- Profanity or crude humour — **None**
- Alcohol, tobacco or drug use or references — **None**
- Mature or suggestive themes — **None**
- Horror or fear themes — **None**
- Medical or treatment-focused content — **None**
- Gambling, simulated or real — **None**
- Contests — **None**

These answer for what *we* publish. What other people publish is the
user-generated content question below, which is where it belongs.

## The questions that decide the rating

**User-generated content — Yes.** Organisations write their own listings and
upload their own images. This is the answer that matters, and Apple follows it
with questions about controls. All three are true and all three are built:

- *Content is moderated* — listings are screened on create and update
  (`packages/shared/src/content-filter.ts`), and a moderator queue acts on
  reports at `/admin/reports`.
- *Users can report content* — from any event or host page in the app, and by
  email. The Terms commit us to acting within 24 hours.
- *Users can block other users* — from a host page, undone in Settings →
  Blocked.

**Unrestricted web access — No.** The app has no browser. The only web view is
the video player in the event gallery, and it is penned in: `originWhitelist`
allows `youtube.com` and `player.vimeo.com` only, and the URL is rebuilt
server-side from a validated video id rather than from anything stored
(`embedUrlFor`). There is no address bar and no arbitrary navigation.

**Messaging or chat between users — No.** There are no messaging models in the
schema and no direct messages in the app. An organiser can send a push
announcement to people holding tickets for their own event
(`POST /v1/events/:eventId/announce`); that is one-way, scoped to one event, and
not a conversation.

**Location sharing with other users — No.** The app never reads device
location, and nothing shares a user's location with anyone.

**In-app purchases or commerce — No.** Every event is free and no payments are
processed.

## Outcome: Apple calculates 4+ — override it to 13+

With every content answer at None, the questionnaire calculates **4+**. The
user-generated content capability is disclosed separately and does not raise the
number by itself.

Do not ship 4+. On the same screen Apple offers *Override to Higher Age Rating*
and says it is for an app that "has a EULA with age requirements" — which is
exactly this one. **Set 13+**, because:

- The Terms set a minimum age of 13 and the Privacy Policy says the same. A 4+
  rating contradicts a document linked from the same listing.
- Listings and images come from third parties, screened but not pre-approved by
  a human. If something inappropriate ever reaches a public page, having shipped
  under a 4+ rating is a much worse position to defend.

Related answers on that screen: **Made for Kids — no** (the Kids Category brings
parental gates, SDK restrictions and COPPA obligations, and the Terms exclude
under-13s anyway). **Age Suitability URL** — optional, but
`https://ekklesiaevents.com/terms` points a reviewer at §2 Eligibility, which
states the age requirement the override rests on.
