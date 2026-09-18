import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProfileView } from "../lib/profile";
import { EditProfileForm } from "./edit-profile-form";
import { ProfileDetails } from "./profile-details";

export function ProfileCard({ profile }: { profile: ProfileView }) {
  return (
    <Card className="w-full max-w-md rounded-2xl bg-elevated">
      <CardHeader className="gap-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-serif text-xl font-bold text-primary-foreground">
          {(profile.name || profile.email || "J").charAt(0).toUpperCase()}
        </div>
        <CardTitle className="font-serif text-xl">Profile</CardTitle>
        <CardDescription className="text-muted-foreground">
          Your account details.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ProfileDetails profile={profile} />
        <EditProfileForm currentName={profile.name} />
      </CardContent>
    </Card>
  );
}
