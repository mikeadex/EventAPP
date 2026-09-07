# App Privacy questionnaire — answers

What to select in **App Store Connect → your app → App Privacy**, and why.
Google Play's Data safety form asks the same questions in different words, so
the same answers carry over.

Derived from the code on 7 September 2026, not from assumption — each "no" below
was checked against the repo. Re-check this document whenever data handling
changes; an App Privacy answer that no longer matches the app is a compliance
problem, not a paperwork one.

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

- **Financial Info** and **Purchases** — no payments exist; every event is free
  and Stripe is not active.
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
