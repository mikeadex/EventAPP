# 04 · Open questions (confirm before launch)

Leave a `// TODO(confirm):` where these appear. Don't invent answers.

| # | Item | Where | Current design value |
|---|---|---|---|
| 1 | Attendee booking fee | Checkout, `fees.ts › BOOKING_FEE_RATE` | 3% of subtotal (inferred from the app's £2.70 on £90) |
| 2 | Host platform fee | Onboarding step 3, Create event, Payouts | 3% + £0.20 per paid ticket (from the app's onboarding screen) |
| 3 | Payments live? | Booking panel footnote, Checkout | "Secure checkout with card or Apple Pay". The app currently has free events only |
| 4 | Refund policy | Checkout small print | "Refundable up to 48 hours before the event" (from the app screen) |
| 5 | Gift Aid declaration wording | Donation | Standard UK taxpayer declaration; check it with the payment provider and the charity |
| 6 | Host vetting claim | For churches FAQ | "We check every host page before it goes live" |
| 7 | Free events are free to publish | For churches CTA + FAQ | "It's free to publish free events" |
| 8 | Team access / roles | For churches FAQ, `User.hosts.role` | "Invite your team" (owner/admin/door roles assumed) |
| 9 | Countries | Onboarding, FAQ | GB, IE, US |
| 10 | Payout schedule | Onboarding, Payouts | Weekly, on Tuesdays |
| 11 | Store links | Footer, Home app band | `#`, so add the App Store / Google Play URLs |
| 12 | Privacy and Terms | `/privacy`, `/terms` | Placeholders: paste the published policies (support contact: david@ekklesiaevents.com) |
| 13 | Ticket QR payload | Ticket, Check-in | Ticket code shown; a signed token is recommended |
| 14 | Wallet passes | Ticket page | Apple / Google Wallet buttons drawn, backend support unknown |

All names, figures, sales numbers, attendee lists and payout amounts in the design are **sample data**.
