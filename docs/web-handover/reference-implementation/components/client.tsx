"use client";

import { Heart, Moon, Sun, ShareNetwork, Check } from "@phosphor-icons/react";
import { useEffect, useState, useSyncExternalStore } from "react";

/* ---------------- Theme ---------------- */

type Theme = "dark" | "light";

const getTheme = (): Theme =>
  (typeof document !== "undefined" && (document.documentElement.dataset.theme as Theme)) || "dark";

const subscribeTheme = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("ek-theme", next);
        } catch {}
      }}
      aria-label={`Switch to ${next} mode`}
      className={`inline-flex size-10 items-center justify-center rounded-full border border-line-2 text-ink-2 transition-colors hover:border-line-3 hover:text-accent ${className}`}
    >
      {theme === "dark" ? <Sun size={18} weight="regular" /> : <Moon size={18} weight="regular" />}
    </button>
  );
}

/* ---------------- Saved events (per browser) ---------------- */

const SAVED_KEY = "ek-saved";
const listeners = new Set<() => void>();

function readSaved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

function toggleSaved(slug: string) {
  const cur = readSaved();
  const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

export function useSaved(slug: string) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setSaved(readSaved().includes(slug));
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, [slug]);
  return [saved, () => toggleSaved(slug)] as const;
}

export function SaveButton({ slug, title, size = "md" }: { slug: string; title: string; size?: "md" | "lg" }) {
  const [saved, toggle] = useSaved(slug);
  const dim = size === "lg" ? "size-[52px]" : "size-10";
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={`relative z-10 inline-flex ${dim} flex-none items-center justify-center rounded-full border backdrop-blur-md transition-colors ${
        saved
          ? "border-line-3 bg-accent-soft text-accent"
          : "border-line-2 bg-[rgb(var(--scrim-rgb)/0.55)] text-ink hover:text-accent"
      }`}
    >
      <Heart size={size === "lg" ? 22 : 18} weight={saved ? "fill" : "regular"} />
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Share ${title}`}
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        } catch {}
      }}
      className="inline-flex size-[52px] flex-none items-center justify-center rounded-full border border-line-2 bg-[rgb(var(--scrim-rgb)/0.55)] text-ink backdrop-blur-md transition-colors hover:text-accent"
    >
      {copied ? <Check size={20} /> : <ShareNetwork size={20} />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}
