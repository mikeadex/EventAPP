"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, EnvelopeSimple, AppleLogo, GoogleLogo } from "@phosphor-icons/react";
import { Mark } from "@/components/brand";

// UI only — wire `requestCode` / `verifyCode` to the same auth the mobile app uses
// (email one-time code, plus Apple / Google sign-in).
export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div className="rounded-[28px] border border-line-2 bg-surface p-7 shadow-card md:p-9">
      <div className="flex flex-col items-center gap-4 text-center">
        <Mark size={52} />
        {step === "email" && (
          <>
            <h1 className="text-[30px] leading-tight text-strong">Welcome to Ekklesia</h1>
            <p className="text-[15px] text-body">Sign in or create an account to RSVP, keep your tickets and follow hosts.</p>
          </>
        )}
        {step === "code" && (
          <>
            <h1 className="text-[30px] leading-tight text-strong">Check your email</h1>
            <p className="text-[15px] text-body">
              We sent a 6-digit code to <span className="text-ink">{email}</span>.
            </p>
          </>
        )}
        {step === "done" && (
          <>
            <h1 className="text-[30px] leading-tight text-strong">You&apos;re signed in</h1>
            <p className="text-[15px] text-body">This preview doesn&apos;t connect to an account yet.</p>
            <Link href={next} className="mt-2 text-[15px] text-accent">
              Continue →
            </Link>
          </>
        )}
      </div>

      {step === "email" && (
        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes("@")) setStep("code");
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-[14px] text-ink">Email</span>
            <span className="flex h-14 items-center gap-3 rounded-2xl border border-line-2 bg-raised px-4 focus-within:border-accent">
              <EnvelopeSimple size={18} className="text-muted" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-full w-full bg-transparent text-[16px] text-ink placeholder:text-faint focus:outline-none"
              />
            </span>
          </label>
          <button
            type="submit"
            className="h-14 rounded-full border border-line-3 bg-accent-soft text-[16px] text-accent-ink transition-colors hover:border-accent"
          >
            Email me a code
          </button>
          <div className="my-2 flex items-center gap-4 text-[12px] text-faint">
            <span className="rule-x flex-1" /> or <span className="rule-x flex-1" />
          </div>
          <button type="button" className="flex h-14 items-center justify-center gap-3 rounded-full border border-line-2 text-[16px] text-ink hover:border-line-3">
            <AppleLogo size={20} weight="fill" /> Continue with Apple
          </button>
          <button type="button" className="flex h-14 items-center justify-center gap-3 rounded-full border border-line-2 text-[16px] text-ink hover:border-line-3">
            <GoogleLogo size={20} weight="bold" /> Continue with Google
          </button>
        </form>
      )}

      {step === "code" && (
        <form
          className="mt-8 flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.join("").length === 6) setStep("done");
          }}
        >
          <fieldset className="flex justify-between gap-2">
            <legend className="sr-only">6-digit code</legend>
            {code.map((c, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                aria-label={`Digit ${i + 1}`}
                value={c}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(-1);
                  setCode((prev) => prev.map((p, j) => (j === i ? v : p)));
                  if (v && i < 5) inputs.current[i + 1]?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus();
                }}
                className="h-14 w-full min-w-0 rounded-2xl border border-line-2 bg-raised text-center font-mono text-[22px] text-ink focus:border-accent focus:outline-none"
              />
            ))}
          </fieldset>
          <button
            type="submit"
            className="h-14 rounded-full border border-line-3 bg-accent-soft text-[16px] text-accent-ink transition-colors hover:border-accent"
          >
            Verify
          </button>
          <button type="button" onClick={() => setStep("email")} className="inline-flex items-center justify-center gap-2 text-[14px] text-ink-2 hover:text-accent">
            <ArrowLeft size={14} /> Use a different email
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-[12px] leading-relaxed text-faint">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline hover:text-accent">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-accent">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
