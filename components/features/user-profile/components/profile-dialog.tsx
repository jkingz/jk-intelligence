"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileView } from "../lib/profile";
import { EditProfileForm } from "./edit-profile-form";
import { ProfileDetails } from "./profile-details";
import { SignOutButton } from "./sign-out-button";

export function ProfileDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: ProfileView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const initial = (profile.name || profile.email || "J").charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/50 backdrop-blur-sm"
        className="sm:max-w-md"
      >
        <DialogHeader className="items-center gap-2 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-serif text-xl font-bold text-primary-foreground">
            {initial}
          </div>
          <DialogTitle className="font-serif text-xl">Profile</DialogTitle>
          <DialogDescription>{profile.email ?? "Your account details."}</DialogDescription>
        </DialogHeader>
        <ProfileDetails profile={profile} />
        <EditProfileForm
          key={open ? "open" : "closed"}
          currentName={profile.name}
          onSaved={() => onOpenChange(false)}
        />
        <SignOutButton />
      </DialogContent>
    </Dialog>
  );
}
