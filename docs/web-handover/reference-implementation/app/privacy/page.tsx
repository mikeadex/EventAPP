import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy Policy" };

// TODO: paste the published Privacy Policy used for the App Store / Google Play listings.
export default function Page() {
  return (
    <Container className="max-w-[760px] pt-8 md:pt-12">
      <Eyebrow>Legal</Eyebrow>
      <h1 className="mt-3 text-[40px] leading-[1.05] text-strong md:text-[52px]">Privacy Policy</h1>
      <div className="rule-x my-8" />
      <p className="text-[17px] leading-[1.7] text-body">
        The full Privacy Policy will appear here. Questions in the meantime? Email{" "}
        <a className="text-accent underline" href="mailto:david@ekklesiaevents.com">
          david@ekklesiaevents.com
        </a>
        .
      </p>
    </Container>
  );
}
