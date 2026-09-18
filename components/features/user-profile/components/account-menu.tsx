"use client";

import { useState, useTransition } from "react";
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
import type { ProfileView } from "../lib/profile";
import { signOutAction } from "../lib/sign-out-action";
import { ProfileDialog } from "./profile-dialog";

export function AccountMenu({ profile }: { profile: ProfileView | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const name = profile?.name ?? null;
  const email = profile?.email ?? undefined;
  const initial = (name?.trim() || email || "").charAt(0).toUpperCase();

  function logOut() {
    setError(null);
    startTransition(async () => {
      const result = await signOutAction();
      setError(result.error);
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
          {error && <p role="alert" className="px-2 py-1 text-xs text-destructive">{error}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
      {profile && (
        <ProfileDialog profile={profile} open={profileOpen} onOpenChange={setProfileOpen} />
      )}
    </>
  );
}
