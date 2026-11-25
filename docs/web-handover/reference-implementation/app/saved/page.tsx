import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui";
import { SavedList } from "./saved-list";

export const metadata: Metadata = { title: "Saved events" };

export default function SavedPage() {
  return (
    <Container className="pt-8 md:pt-12">
      <div className="mb-10 flex flex-col gap-3">
        <Eyebrow>Saved</Eyebrow>
        <h1 className="text-[40px] leading-[1.05] text-strong md:text-[52px]">Your saved events</h1>
        <p className="max-w-xl text-[16px] text-body">
          Saved on this browser. Sign in to sync with the Ekklesia app.
        </p>
      </div>
      <SavedList />
    </Container>
  );
}
