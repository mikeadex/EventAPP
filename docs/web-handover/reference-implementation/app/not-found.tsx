import { Mark } from "@/components/brand";
import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-6 py-28 text-center">
      <Mark size={64} />
      <h1 className="text-[40px] leading-tight text-strong">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-[16px] text-body">The event may have finished, or the link might be wrong.</p>
      <div className="flex gap-3">
        <ButtonLink href="/events">Discover events</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
    </Container>
  );
}
