"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";
import type { ProfileView } from "../lib/profile";
import { signOutAction } from "../lib/sign-out-action";
import { ProfileDialog } from "./profile-dialog";

export function AccountMenu({ profile }: { profile: ProfileView | null }) {
  const [pending, startTransition] = useTransition();
  const [profileOpen, setProfileOpen] = useState(false);
  const limiter = useRef(new SlidingWindowLimiter({ max: 3, windowMs: 30_000 })).current;
  const router = useRouter();

  const name = profile?.name ?? null;
  const email = profile?.email ?? undefined;
  const initial = (name?.trim() || email || "").charAt(0).toUpperCase();

  function logOut() {
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
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account menu" />}>
          <Avatar>
            <AvatarFallback>{initial || <UserRound aria-hidden="true" />}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-1 px-1.5 py-1.5">
              <span className="truncate text-sm font-medium text-foreground">{name || "My account"}</span>
              {email && <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <UserRound aria-hidden="true" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logOut} closeOnClick={false} disabled={pending} aria-busy={pending}>
              <LogOut aria-hidden="true" />
              {pending ? "Logging out…" : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {profile && (
        <ProfileDialog profile={profile} open={profileOpen} onOpenChange={setProfileOpen} />
      )}
    </>
  );
}
