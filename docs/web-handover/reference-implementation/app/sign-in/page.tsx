import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col px-5 pb-10 pt-10 md:pt-16">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
