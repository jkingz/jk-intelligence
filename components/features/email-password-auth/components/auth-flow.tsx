"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { EmailAuthForm } from "./email-auth-form";
import { GoogleSignInButton } from "./google-sign-in";

type AuthMode = "sign-in" | "sign-up";

interface AuthFlowProps {
  initialMode: AuthMode;
  next?: string;
  error?: boolean;
}

export function AuthFlow({ initialMode, next, error }: AuthFlowProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const headline = {
    "sign-in": "Welcome back",
    "sign-up": "Create your account",
  }[mode];

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg border border-default bg-state-warning/10 px-3 py-2 text-xs text-state-warning">
          Sign-in did not complete. Please try again.
        </p>
      )}
      {mode === "sign-up" && (
        <p className="rounded-lg border border-default bg-state-success/10 px-3 py-2 text-xs text-state-success">
          After signing up you will receive a confirmation email before you can sign in.
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-3"
        >
          <h1 className="font-serif text-lg text-foreground">{headline}</h1>
          <EmailAuthForm mode={mode} next={next} />
          <div aria-hidden="true" className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton next={next} />
        </motion.div>
      </AnimatePresence>

      {mode === "sign-in" ? (
        <div className="flex flex-col gap-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
              <ArrowLeft className="size-3" aria-hidden="true" />
              Back to home
            </Link>
            <Link href={`/auth/forgot-password${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline underline-offset-4 hover:text-foreground">
              Forgot your password?
            </Link>
          </div>
          <p className="text-center">
            New to JK Intelligence?{" "}
            <button type="button" onClick={() => setMode("sign-up")} className="underline underline-offset-4 hover:text-foreground">
              Create an account
            </button>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-xs text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
            <ArrowLeft className="size-3" aria-hidden="true" />
            Back to home
          </Link>
          <p className="text-center">
            Already have an account?{" "}
            <button type="button" onClick={() => setMode("sign-in")} className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </button>
          </p>
        </div>
      )}
    </div>
  );
}