import { AppleLogo, GooglePlayLogo } from "@phosphor-icons/react/ssr";

// Swap the hrefs for the live App Store / Google Play listings once approved.
export const APP_STORE_URL = "#";
export const PLAY_STORE_URL = "#";

export function StoreBadges() {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={APP_STORE_URL}
        className="inline-flex h-12 items-center gap-3 rounded-xl border border-line-2 bg-surface px-4 text-ink transition-colors hover:border-line-3"
      >
        <AppleLogo size={22} weight="fill" />
        <span className="flex flex-col leading-none">
          <span className="text-[10px] text-faint">Download on the</span>
          <span className="mt-0.5 text-[15px]">App Store</span>
        </span>
      </a>
      <a
        href={PLAY_STORE_URL}
        className="inline-flex h-12 items-center gap-3 rounded-xl border border-line-2 bg-surface px-4 text-ink transition-colors hover:border-line-3"
      >
        <GooglePlayLogo size={22} weight="fill" />
        <span className="flex flex-col leading-none">
          <span className="text-[10px] text-faint">Get it on</span>
          <span className="mt-0.5 text-[15px]">Google Play</span>
        </span>
      </a>
    </div>
  );
}
