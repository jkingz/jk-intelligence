"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../lib/sign-out-action";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-10 w-full"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        setError(null);
        startTransition(async () => {
          const result = await signOutAction();
          setError(result.error);
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </>
  );
}
