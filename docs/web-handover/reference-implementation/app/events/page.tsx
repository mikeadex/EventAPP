import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, Eyebrow } from "@/components/ui";
import { Discover } from "./discover";

export const metadata: Metadata = {
  title: "Discover events",
  description: "Browse worship nights, conferences, courses, outreach and more from churches and ministries near you.",
};

export default function EventsPage() {
  return (
    <Container className="pt-8 md:pt-12">
      <div className="mb-10 flex flex-col gap-3">
        <Eyebrow>Discover</Eyebrow>
        <h1 className="text-[40px] leading-[1.05] text-strong md:text-[52px]">What&apos;s on</h1>
        <p className="max-w-xl text-[16px] text-body">
          Events from churches, ministries and faith communities. Browse freely — you only sign in to RSVP.
        </p>
      </div>
      <Suspense>
        <Discover />
      </Suspense>
    </Container>
  );
}
