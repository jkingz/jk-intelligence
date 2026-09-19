"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import { signOutAction } from "../lib/sign-out-action";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  const limiter = useRef(new SlidingWindowLimiter({ max: 3, windowMs: 30_000 })).current;
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-10 w-full"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (pending) return;
        if (!limiter.trySubmit()) {
          toast.add({
            type: "error",
            title: "Too many attempts",
            description: "Please wait a moment before trying again.",
          });
          return;
        }
        const statusId = startStatusToast("Sign out");
        startTransition(async () => {
          const result = await signOutAction();
          if (!result.success) {
            finishStatusToast(statusId, {
              status: "error",
              title: "Sign out failed",
              description: result.error,
            });
            return;
          }
          finishStatusToast(statusId, {
            status: "success",
            title: "Signed out",
            description: "You have been logged out.",
          });
          router.push("/");
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
