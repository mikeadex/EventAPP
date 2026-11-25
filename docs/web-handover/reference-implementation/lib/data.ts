// Sample content so the site renders end to end.
// Replace with your API (the mobile app's backend) — keep the shapes.

export type Category =
  | "Worship"
  | "Conference"
  | "Class"
  | "Outreach"
  | "Fundraiser"
  | "Youth"
  | "Prayer"
  | "Concert";

export const categories: Category[] = [
  "Worship",
  "Conference",
  "Class",
  "Outreach",
  "Fundraiser",
  "Youth",
  "Prayer",
  "Concert",
];

export type TicketTier = {
  id: string;
  name: string;
  description?: string;
  price: number; // GBP, 0 = free
  remaining: number;
};

export type HostType = "Church" | "Ministry" | "Community";

export type Host = {
  slug: string;
  name: string;
  type: HostType;
  area: string;
  city: string;
  bio: string;
  followers: number;
  initials: string;
  since: string;
};

export type EventItem = {
  slug: string;
  title: string;
  category: Category;
  hostSlug: string;
  start: string; // ISO, Europe/London
  end: string;
  venue: string;
  address: string;
  city: string;
  summary: string;
  description: string[];
  image?: string; // /images/... — falls back to generated cover art
  going: number;
  capacity: number;
  tiers: TicketTier[];
  donations?: boolean;
  featured?: boolean;
};

export const hosts: Host[] = [
  {
    slug: "love-salvation-church",
    name: "Love Salvation Church",
    type: "Church",
    area: "Woolwich",
    city: "London",
    bio: "A family church in south-east London, serving our city through worship, outreach and practical care since 2009.",
    followers: 1240,
    initials: "LS",
    since: "2024",
  },
  {
    slug: "grace-community",
    name: "Grace Community",
    type: "Church",
    area: "Lewisham",
    city: "London",
    bio: "An open, multi-generational church running the Alpha Course, midweek groups and Sunday gatherings in Lewisham.",
    followers: 860,
    initials: "GC",
    since: "2024",
  },
  {
    slug: "kingdom-youth-network",
    name: "Kingdom Youth Network",
    type: "Ministry",
    area: "Croydon",
    city: "London",
    bio: "Equipping young people aged 14–25 through camps, nights of worship and mentoring across south London.",
    followers: 2310,
    initials: "KY",
    since: "2025",
  },
  {
    slug: "the-upper-room",
    name: "The Upper Room",
    type: "Community",
    area: "Bermondsey",
    city: "London",
    bio: "A city-wide prayer community. Monthly nights of prayer and an annual 24-hour prayer room.",
    followers: 540,
    initials: "UR",
    since: "2025",
  },
  {
    slug: "harvest-mission-trust",
    name: "Harvest Mission Trust",
    type: "Ministry",
    area: "Bromley",
    city: "London",
    bio: "A charity resourcing food banks, winter shelters and family support across the boroughs of south-east London.",
    followers: 980,
    initials: "HM",
    since: "2024",
  },
  {
    slug: "st-marks-greenwich",
    name: "St Mark's Greenwich",
    type: "Church",
    area: "Greenwich",
    city: "London",
    bio: "A historic parish church with a choir, a thriving music programme and seasonal concerts open to everyone.",
    followers: 1570,
    initials: "SM",
    since: "2025",
  },
];

export const events: EventItem[] = [
  {
    slug: "city-outreach-day",
    title: "City Outreach Day",
    category: "Outreach",
    hostSlug: "love-salvation-church",
    start: "2026-12-12T09:00:00",
    end: "2026-12-12T15:00:00",
    venue: "Grace Hall",
    address: "14 Powis Street, SE18 6LF",
    city: "London",
    summary: "Serving our city together — packing and delivering food parcels across five London boroughs.",
    description: [
      "Join volunteers from churches across London for a day of practical love. We'll meet at Grace Hall for a short briefing, then pack and deliver food parcels to families across Greenwich, Lewisham, Bexley, Bromley and Southwark.",
      "No experience needed. Lunch is provided, and drivers are especially welcome — let us know when you RSVP.",
    ],
    image: "/images/city-outreach.jpg",
    going: 44,
    capacity: 120,
    tiers: [{ id: "volunteer", name: "Volunteer", description: "Free — lunch included", price: 0, remaining: 76 }],
    featured: true,
  },
  {
    slug: "alpha-course-winter",
    title: "Alpha Course",
    category: "Class",
    hostSlug: "grace-community",
    start: "2027-01-13T19:30:00",
    end: "2027-01-13T21:30:00",
    venue: "Grace Community Centre",
    address: "2 Ladywell Road, SE13 7UW",
    city: "London",
    summary: "Eleven relaxed weeks exploring life, faith and meaning — dinner, a short talk and honest conversation.",
    description: [
      "Alpha is a space to explore the big questions of life in a friendly, open environment. Each evening starts with food, followed by a short talk and time to discuss in small groups.",
      "Come as you are — no question is off limits, and there's no pressure to say anything at all.",
    ],
    image: "/images/alpha-course.jpg",
    going: 16,
    capacity: 40,
    tiers: [{ id: "place", name: "Course place", description: "Free — dinner included each week", price: 0, remaining: 24 }],
    featured: true,
  },
  {
    slug: "charity-gala-dinner",
    title: "Charity Gala Dinner",
    category: "Fundraiser",
    hostSlug: "harvest-mission-trust",
    start: "2026-12-05T19:00:00",
    end: "2026-12-05T23:00:00",
    venue: "The Bromley Court Hotel",
    address: "Bromley Hill, BR1 4JD",
    city: "London",
    summary: "An evening of dinner, live music and auction in support of winter shelters across south-east London.",
    description: [
      "Our annual gala raises the funds that keep our winter shelters open from December to March. Enjoy a three-course dinner, live music and a silent auction.",
      "Book a single seat or reserve a table for ten. Every ticket includes a donation to the shelter programme.",
    ],
    going: 182,
    capacity: 240,
    tiers: [
      { id: "seat", name: "Single seat", description: "Three-course dinner", price: 65, remaining: 38 },
      { id: "table", name: "Table of 10", description: "Reserved table near the stage", price: 600, remaining: 4 },
    ],
    donations: true,
    featured: true,
  },
  {
    slug: "carols-by-candlelight",
    title: "Carols by Candlelight",
    category: "Concert",
    hostSlug: "st-marks-greenwich",
    start: "2026-12-20T18:30:00",
    end: "2026-12-20T20:00:00",
    venue: "St Mark's Church",
    address: "Royal Hill, SE10 8RT",
    city: "London",
    summary: "Our much-loved candlelit service of carols and readings with the St Mark's choir.",
    description: [
      "Lessons and carols by candlelight with the St Mark's choir and brass ensemble. Mince pies and mulled drinks afterwards in the church hall.",
      "Entry is free but places are ticketed so we can manage capacity safely.",
    ],
    going: 310,
    capacity: 400,
    tiers: [{ id: "free", name: "General admission", price: 0, remaining: 90 }],
    donations: true,
  },
  {
    slug: "ignite-youth-night",
    title: "Ignite Youth Night",
    category: "Youth",
    hostSlug: "kingdom-youth-network",
    start: "2027-01-08T19:00:00",
    end: "2027-01-08T22:00:00",
    venue: "Fairfield Halls",
    address: "Park Lane, CR9 1DG",
    city: "London",
    summary: "Worship, a guest speaker and food trucks — the first Ignite of the new year for ages 14–25.",
    description: [
      "Kick off the year with a night of worship led by the KYN band, a message from our guest speaker and food trucks in the foyer.",
      "Under-16s need a parent or guardian's consent form, sent by email after booking.",
    ],
    going: 420,
    capacity: 600,
    tiers: [
      { id: "standard", name: "Standard", price: 5, remaining: 150 },
      { id: "group", name: "Youth group (10)", description: "For leaders booking a group", price: 40, remaining: 12 },
    ],
  },
  {
    slug: "night-of-prayer",
    title: "Night of Prayer",
    category: "Prayer",
    hostSlug: "the-upper-room",
    start: "2026-12-04T20:00:00",
    end: "2026-12-04T23:30:00",
    venue: "The Upper Room",
    address: "48 Druid Street, SE1 2EZ",
    city: "London",
    summary: "A monthly gathering of churches praying for London — worship, scripture and intercession.",
    description: [
      "Churches from across the city gather once a month to pray for London. Expect extended worship, scripture readings and guided times of intercession.",
      "Come for an hour or stay the whole night. Tea and coffee provided.",
    ],
    going: 96,
    capacity: 150,
    tiers: [{ id: "free", name: "RSVP", price: 0, remaining: 54 }],
  },
  {
    slug: "leaders-summit-2027",
    title: "Leaders Summit 2027",
    category: "Conference",
    hostSlug: "kingdom-youth-network",
    start: "2027-02-06T09:30:00",
    end: "2027-02-06T17:00:00",
    venue: "Emmanuel Centre",
    address: "9–23 Marsham Street, SW1P 3DW",
    city: "London",
    summary: "A one-day summit for youth and children's leaders — keynotes, workshops and practical tools.",
    description: [
      "A day of teaching and training for everyone who leads young people. Choose from twelve practical workshops across safeguarding, discipleship, mental health and running great events.",
      "Lunch and refreshments are included in every ticket.",
    ],
    going: 268,
    capacity: 500,
    tiers: [
      { id: "early", name: "Early bird", description: "Until 31 December", price: 25, remaining: 40 },
      { id: "standard", name: "Standard", price: 35, remaining: 192 },
    ],
  },
  {
    slug: "sunday-celebration",
    title: "Sunday Celebration",
    category: "Worship",
    hostSlug: "love-salvation-church",
    start: "2026-11-29T10:30:00",
    end: "2026-11-29T12:30:00",
    venue: "Love Salvation Church",
    address: "Woolwich New Road, SE18 6EU",
    city: "London",
    summary: "Our weekly Sunday gathering with worship, teaching and kids' church. Everyone welcome.",
    description: [
      "Join us for worship, a message from the Bible and refreshments afterwards. Kids' church runs during the service for ages 3–11.",
      "First time? Say hello at the welcome desk — we'd love to meet you.",
    ],
    going: 210,
    capacity: 350,
    tiers: [{ id: "free", name: "RSVP", price: 0, remaining: 140 }],
  },
  {
    slug: "marriage-course",
    title: "The Marriage Course",
    category: "Class",
    hostSlug: "grace-community",
    start: "2027-01-20T19:30:00",
    end: "2027-01-20T21:30:00",
    venue: "Grace Community Centre",
    address: "2 Ladywell Road, SE13 7UW",
    city: "London",
    summary: "Seven candlelit evenings for couples to invest in their relationship — dinner for two included.",
    description: [
      "Designed for any couple who wants to build a strong, healthy relationship. Each session includes a meal for two, a short talk and time to talk privately as a couple.",
      "There's no group discussion — conversations are just between the two of you.",
    ],
    going: 22,
    capacity: 30,
    tiers: [{ id: "couple", name: "Couple", description: "Covers both of you for all seven weeks", price: 20, remaining: 4 }],
  },
];

export const getEvent = (slug: string) => events.find((e) => e.slug === slug);
export const getHost = (slug: string) => hosts.find((h) => h.slug === slug);
export const eventsByHost = (slug: string) => events.filter((e) => e.hostSlug === slug);

export const sortedEvents = () => [...events].sort((a, b) => a.start.localeCompare(b.start));
