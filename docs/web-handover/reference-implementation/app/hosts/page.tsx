import type { Metadata } from "next";
import { hosts } from "@/lib/data";
import { HostCard } from "@/components/host-card";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { ArrowRight } from "@phosphor-icons/react/ssr";

export const metadata: Metadata = {
  title: "Hosts",
  description: "Churches, ministries and faith communities publishing events on Ekklesia.",
};

export default function HostsPage() {
  const groups = (["Church", "Ministry", "Community"] as const).map((t) => ({
    type: t,
    list: hosts.filter((h) => h.type === t),
  }));
  return (
    <Container className="pt-8 md:pt-12">
      <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <Eyebrow>Host directory</Eyebrow>
          <h1 className="text-[40px] leading-[1.05] text-strong md:text-[52px]">Browse hosts</h1>
          <p className="max-w-xl text-[16px] text-body">
            Follow the churches and ministries you love to see their events first.
          </p>
        </div>
        <ButtonLink href="/for-hosts" variant="outline">
          List your church <ArrowRight size={16} />
        </ButtonLink>
      </div>
      <div className="flex flex-col gap-16">
        {groups.map(
          (g) =>
            g.list.length > 0 && (
              <section key={g.type} aria-labelledby={`g-${g.type}`}>
                <h2 id={`g-${g.type}`} className="eyebrow mb-5 text-faint">
                  {g.type === "Community" ? "Communities" : g.type === "Ministry" ? "Ministries" : "Churches"}
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.list.map((h) => (
                    <HostCard key={h.slug} host={h} />
                  ))}
                </div>
              </section>
            ),
        )}
      </div>
    </Container>
  );
}
