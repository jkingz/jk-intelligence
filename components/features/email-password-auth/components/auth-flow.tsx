"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailAuthForm } from "./email-auth-form";
import { GoogleSignInButton } from "./google-sign-in";
import { AppleSignInButton } from "./apple-sign-in";
import { DemoAccess } from "./demo-access";

type AuthMode = "sign-in" | "sign-up";

interface AuthFlowProps {
  initialMode: AuthMode;
  next?: string;
  error?: boolean;
  demoEmail?: string;
  demoPassword?: string;
}

export function AuthFlow({ initialMode, next, error, demoEmail, demoPassword }: AuthFlowProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

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
          <EmailAuthForm
            mode={mode}
            next={next}
            switchButton={
              mode === "sign-in" ? (
                <Button
                  type="button"
                  size="lg"
                  className="h-10 w-full"
                  onClick={() => setMode("sign-up")}
                >
                  <UserPlus className="size-4" data-icon="inline-start" aria-hidden="true" />
                  <span className="truncate">Create account</span>
                </Button>
              ) : undefined
            }
          />
          <div aria-hidden="true" className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <GoogleSignInButton next={next} />
            <AppleSignInButton next={next} />
          </div>
        </motion.div>
      </AnimatePresence>

      {mode === "sign-in" && (
        <DemoAccess email={demoEmail} password={demoPassword} next={next} />
      )}

      {mode === "sign-in" ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
            <ArrowLeft className="size-3" aria-hidden="true" />
            Back to home
          </Link>
          <Link href={`/auth/forgot-password${nextQuery}`} className="underline underline-offset-4 hover:text-foreground">
            Forgot your password?
          </Link>
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