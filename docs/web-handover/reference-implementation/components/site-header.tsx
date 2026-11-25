"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { List, X, Compass, Buildings, Ticket, Heart, User } from "@phosphor-icons/react";
import { Logo } from "./brand";
import { ThemeToggle } from "./client";
import { buttonClass } from "./ui";

const nav = [
  { href: "/events", label: "Discover", icon: Compass },
  { href: "/hosts", label: "Hosts", icon: Buildings },
  { href: "/for-hosts", label: "For churches", icon: Ticket },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <header
        className={`sticky top-0 z-50 transition-[background-color,border-color] duration-300 ${
          scrolled || open
            ? "border-b border-line bg-[rgb(var(--scrim-rgb)/0.86)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-[15px] transition-colors ${
                  active(n.href) ? "bg-accent-soft text-accent" : "text-ink-2 hover:text-accent"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/saved"
              aria-label="Saved events"
              className="hidden size-10 items-center justify-center rounded-full border border-line-2 text-ink-2 transition-colors hover:border-line-3 hover:text-accent sm:inline-flex"
            >
              <Heart size={18} />
            </Link>
            <Link href="/sign-in" className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>
              <User size={16} /> Sign in
            </Link>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-line-2 text-ink md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} /> : <List size={18} />}
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line md:hidden">
            <ul className="mx-auto flex max-w-[1240px] flex-col gap-1 px-5 py-4">
              {[...nav, { href: "/saved", label: "Saved", icon: Heart }, { href: "/sign-in", label: "Sign in", icon: User }].map(
                (n) => (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[17px] ${
                        active(n.href) ? "bg-accent-soft text-accent" : "text-ink"
                      }`}
                    >
                      <n.icon size={20} className="text-accent" /> {n.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}
