# Ekklesia — Tools, Services and Costs

*Prepared 29 August 2026, for discussion with the project owner.*

This sets out every third-party service Ekklesia needs to run in production, what
each one costs, what is already in place, and what still needs a decision. It
also covers **Stripe in detail**, because taking payments is the one area where
the choice of approach has legal consequences as well as technical ones.

Development has been provided pro bono. The final section covers a contribution
toward hours already worked and subscriptions paid out of pocket.

> **On prices.** Figures below are indicative and were correct to the best of my
> knowledge when written. Providers change pricing, and free tiers in particular
> get revised. Verify current rates before committing to anything.

---

## 1. Cost summary

| | Amount |
| --- | --- |
| **One-off, already paid** | ~£110 |
| **Recurring, at current scale** | **£0–£15 / month** |
| **Recurring, once busy** | ~£70–£110 / month |
| **Annual legal/regulatory** | ~£52 / year (ICO) |
| **Contribution to development** | **£1,200** *(see section 6)* |

The important point: **at the scale of a beta, nearly everything runs on free
tiers.** The monthly cost only becomes real once there is meaningful traffic —
and by then the platform should be earning from ticket fees. What cannot be
avoided is the Apple and Google developer registration, the domain, and the ICO
fee.

---

## 2. Already acquired

| Service | Purpose | Cost |
| --- | --- | --- |
| **Domain** — `ekklesiaevents.com` | Web and API addresses | ~£10–15 / year |
| **Apple Developer Program** | Required to ship an iOS app at all | ~£79 / year |
| **Google Play Console** | Required to ship an Android app | ~£20 one-off |

Both stores are live: iOS is in TestFlight, Android has an internal-testing
release. The domain is fully migrated — the web app, the API and email all run
on it.

---

## 3. Running now, free at current scale

These are configured and working. Each has a free tier that comfortably covers a
beta, with a paid tier that only matters at volume.

| Service | What it does | Free tier | Paid tier |
| --- | --- | --- | --- |
| **Vercel** | Hosts the website and the API | Generous; fine for a beta | ~£16/mo (Pro) when traffic or build minutes exceed it |
| **Neon** | The Postgres database | Includes a limited backup window | ~£15/mo for longer retention and more compute |
| **Resend** | All outbound email — password resets, ticket confirmations | 3,000 emails/month | ~£16/mo beyond that |
| **Expo** | Push notifications and over-the-air app updates | Covers this app's usage | Only relevant at large scale |
| **Sign in with Google / Apple / Microsoft** | Social login | Free | — |

**Note on Neon backups.** The free tier's backup window is short. Before real
users depend on the data, either move to a paid Neon tier or add an independent
nightly dump to separate storage. Backups living only with the database provider
is a single point of failure — a paid tier at one provider is usually simpler and
cheaper than running a second one, but either is better than the current
position.

---

## 4. Needed, not yet set up

| Service | Why it matters | Indicative cost |
| --- | --- | --- |
| **Cloudflare R2** (object storage) | Hosts uploaded event images. **Currently unavailable** — organisers can only use external image URLs | ~£1–4/mo at this scale |
| **Sentry** (error tracking) | Reports crashes and failures automatically | Free to 5k events/mo; ~£21/mo beyond |
| **Uptime monitoring** | Alerts if the site or API goes down | Free (Better Stack or UptimeRobot) |
| **Google Maps API** | Map display and address lookup | Pay-as-you-go with a monthly free allowance; likely £0 at this scale |
| **ICO registration** | **Legal requirement** for UK data controllers | ~£52 / year |

**R2 over AWS S3.** The code already talks to a configurable S3 endpoint, so R2
is a drop-in — six environment variables, no code changes. R2 charges nothing
for egress, where S3 charges for every image served. For an image-heavy events
app that difference compounds.

**Sentry is the highest-value item on this list.** Without it, problems are found
when a user reports them. With it, they are found when they happen. Several bugs
during development were only diagnosed by reproducing them by hand because there
was no error reporting to consult.

---

## 5. Stripe — taking payments

This is the most consequential decision in the document, so it is covered in
full. Nothing here is built yet beyond scaffolding; the design needs agreeing
first.

### 5.1 What we want to happen

1. An attendee buys a ticket.
2. The money is held.
3. Five days after the event, the host receives their share in their bank
   account.
4. Refunds are possible before and, in some cases, after the event.

### 5.2 The thing that shapes everything else

There is a critical distinction in step 2: **where is the money held?**

If funds land in **Ekklesia's own business bank account** and Ekklesia then pays
hosts out of it, that is *money transmission*. In the UK it is regulated under
the Payment Services Regulations 2017 and requires FCA authorisation. Operating
without it is a criminal offence, not a compliance oversight.

If funds sit in **Ekklesia's Stripe balance** and Stripe transfers them to the
host, Stripe is the regulated party. This achieves exactly the same outcome —
money held, released after five days — with none of the exposure.

**Recommendation: Stripe Connect, with the money held at Stripe.** This is the
standard marketplace arrangement and is what Stripe Connect was built for.

### 5.3 How hosts get set up

Every host receiving money needs a *connected account*. This is unavoidable, and
it is not really a Stripe rule — anyone paying money into another party's bank
account must verify who they are, under anti-money-laundering law. Either Stripe
does that verification, or Ekklesia does and becomes the regulated party.

Stripe offers three ways to do it:

| Type | What the host sees | What we build | Our exposure |
| --- | --- | --- | --- |
| **Express** *(recommended)* | A Stripe-hosted page: name, address, date of birth, bank details. Few minutes. | Nothing | Lowest |
| **Custom** | Our own form. Stripe never appears. | The full onboarding journey, including what happens when verification needs more documents | Higher — more compliance and fraud responsibility |
| **Standard** | Creates their own full Stripe account | Nothing | Lowest, but most friction |

**On "why can't we just take their bank details, like Eventbrite?"** — Eventbrite
is itself a licensed payment institution. They hold the regulatory permissions and
run their own identity-verification operation. "Just enter your bank details" is
the visible surface of a large compliance function. Reaching that point means FCA
authorisation: a months-long process with capital requirements and ongoing cost.

**Custom accounts get close to that experience** without the licence — the host
enters details in our form and never sees Stripe. The cost is that we build the
onboarding *and* every unhappy path: Stripe frequently comes back asking for a
passport or proof of address, and those screens have to exist.

**Recommendation: start with Express.** It is already scaffolded in the codebase,
requires no additional build, and Stripe absorbs the awkward parts. If real hosts
demonstrably abandon that screen, Custom is a later migration using the same
underlying accounts — a friction problem worth confirming before building for it.

### 5.4 Two things that reduce friction regardless

**Ask late.** Nothing about payments should appear until a host sets a ticket
price above zero. Everything today is free RSVP, which needs no bank details at
all. Putting a bank form in front of a church that wants to list a free Sunday
service will lose some of them there.

**Defer verification.** Stripe allows an account to be created with minimal
information, so a host can start selling immediately, with full verification
required only before the first payout moves. The friction then lands at the
moment they are most motivated to push through it — when there is money waiting.
This is very likely how Eventbrite feels so effortless at signup.

### 5.5 What it costs

Stripe charges no monthly fee. Costs are per transaction, and are indicative:

- **Card processing** — roughly 1.5% + 20p for UK consumer cards. European and
  international cards cost more.
- **Connect** — a small monthly fee per *active* connected account, and in some
  cases a payout fee. Only charged for accounts actually receiving money.
- **Refunds** — Stripe does **not** return the processing fee. A refunded £20
  ticket costs roughly 50p regardless.
- **Disputes** — a chargeback carries a fee of around £15, whatever the outcome.

### 5.6 Risks worth being explicit about

**We become merchant of record.** Holding funds and transferring them later means
refunds and chargebacks come out of the Ekklesia Stripe balance. If a host sells
£3,000 of tickets, is paid out, and attendees then dispute the charges, Ekklesia
carries it. The five-day hold is the main protection, which is why the question
of *what it protects against* matters.

**A host cancelling a sold-out event** is the case most likely to go wrong
visibly. If payout has already happened, refunding requires reversing the
transfer, and the money may no longer be there.

**Apple's in-app purchase rules do not apply.** Tickets to real-world events are
explicitly exempt, so card payment is permitted and Apple takes no cut.

### 5.7 Three decisions needed before building

1. **What is the five-day hold protecting against?** Refund requests, no-shows,
   or host disputes? The answer decides whether it runs from the event date or
   the purchase date — and whether five days is the right number.
2. **Who absorbs the Stripe fee on a refund?** It is never returned. Either it
   comes out of Ekklesia's margin or it is deducted from the host's payout.
3. **What happens when a host cancels after payout?** Reverse the transfer,
   absorb the loss, or hold longer for higher-value events?

---

## 6. Development contribution — £1,200

The build itself has been provided pro bono. This figure covers:

- **Subscriptions and services paid out of pocket** during development — the
  domain, the Apple Developer Program, the Play Console registration, and tooling
  used to build and test the apps.
- **A contribution toward hours worked.** The platform comprises a web app, iOS
  and Android apps, and a backend — including authentication with Google and
  Apple sign-in, ticketing and check-in, organiser tools, push notifications,
  transactional email, and the store submissions for both platforms.

This is offered as a contribution rather than a commercial rate, which would be a
substantial multiple of it for work of this scope.

---

## 7. Recommended order

1. **Cloudflare R2** — organiser image uploads do not work without it, and it is
   the most visible gap in the product today.
2. **Sentry** — stop finding problems by user report.
3. **Uptime monitoring** — free, and takes minutes.
4. **ICO registration** — a legal requirement, not a nice-to-have.
5. **Legal review** of the privacy policy and terms. Both are drafted and live
   but have not been seen by a solicitor. Church attendance is special-category
   data under UK GDPR, which raises the bar.
6. **Neon backup retention** — before real users depend on the data.
7. **Stripe** — only once the three decisions in 5.7 are settled.

Items 1 to 3 cost nothing or nearly nothing and are the difference between a
platform that works when watched and one that runs unattended.
