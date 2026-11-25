"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Plus, Check, HandHeart, LockSimple } from "@phosphor-icons/react";
import type { EventItem } from "@/lib/data";
import { money } from "@/lib/format";

const giftOptions = [5, 10, 25];

export function BookingPanel({ event }: { event: EventItem }) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(event.tiers.map((t, i) => [t.id, event.tiers.length === 1 && i === 0 ? 1 : 0])),
  );
  const [gift, setGift] = useState(0);

  const { count, subtotal } = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    for (const t of event.tiers) {
      count += qty[t.id] ?? 0;
      subtotal += (qty[t.id] ?? 0) * t.price;
    }
    return { count, subtotal };
  }, [qty, event.tiers]);

  const total = subtotal + (count ? gift : 0);
  const free = event.tiers.every((t) => t.price === 0);
  const nextUrl = `/sign-in?next=${encodeURIComponent(`/events/${event.slug}`)}`;

  const change = (id: string, delta: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, Math.min(10, (q[id] ?? 0) + delta))) }));

  return (
    <aside aria-label="Book" className="rounded-[24px] border border-line-2 bg-surface p-6 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[22px] text-strong">{free ? "Reserve your place" : "Tickets"}</h2>
        <span className="text-[13px] text-faint">GBP</span>
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {event.tiers.map((t) => {
          const n = qty[t.id] ?? 0;
          const max = Math.min(t.remaining, 10);
          return (
            <li
              key={t.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                n ? "border-line-3 bg-accent-softer" : "border-line"
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[16px] text-ink">{t.name}</span>
                {t.description && <span className="text-[13px] text-muted">{t.description}</span>}
                <span className="text-[15px] text-accent">{money(t.price)}</span>
                {t.remaining <= 10 && <span className="text-[12px] text-faint">Only {t.remaining} left</span>}
              </div>
              <div className="flex items-center gap-2" role="group" aria-label={`${t.name} quantity`}>
                <Stepper label={`Remove one ${t.name}`} disabled={n === 0} onClick={() => change(t.id, -1, max)}>
                  <Minus size={14} />
                </Stepper>
                <span className="w-6 text-center text-[16px] tabular-nums text-ink" aria-live="polite">
                  {n}
                </span>
                <Stepper label={`Add one ${t.name}`} disabled={n >= max} onClick={() => change(t.id, 1, max)}>
                  <Plus size={14} />
                </Stepper>
              </div>
            </li>
          );
        })}
      </ul>

      {event.donations && (
        <fieldset className="mt-5 rounded-2xl border border-line p-4">
          <legend className="flex items-center gap-2 px-1 text-[14px] text-ink">
            <HandHeart size={16} className="text-accent" /> Add a gift (optional)
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {[0, ...giftOptions].map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={gift === g}
                onClick={() => setGift(g)}
                className={`inline-flex h-9 items-center rounded-full border px-4 text-[14px] transition-colors ${
                  gift === g ? "border-line-3 bg-accent-soft text-accent" : "border-line text-ink-2 hover:text-ink"
                }`}
              >
                {g === 0 ? "No gift" : money(g)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="rule-x my-6" />

      <div className="flex items-center justify-between text-[15px]">
        <span className="text-ink-2">
          {count} {count === 1 ? "place" : "places"}
        </span>
        <span className="text-[22px] text-strong">{total ? money(total) : "Free"}</span>
      </div>

      {count ? (
        <Link
          href={nextUrl}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-full border border-line-3 bg-accent-soft text-[16px] text-accent-ink transition-colors hover:border-accent"
        >
          <Check size={18} weight="bold" /> {free ? "RSVP" : `Continue · ${money(total)}`}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-5 flex h-14 w-full items-center justify-center rounded-full border border-line text-[16px] text-faint"
        >
          Choose a ticket
        </button>
      )}

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-[12px] text-faint">
        <LockSimple size={13} /> {free ? "Sign in to confirm — it takes seconds." : "Secure checkout with card or Apple Pay."}
      </p>
    </aside>
  );
}

function Stepper({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full border border-line-2 text-accent transition-colors hover:border-line-3 disabled:border-line disabled:text-faint"
    >
      {children}
    </button>
  );
}
