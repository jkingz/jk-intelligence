import type { Metadata } from "next";
import { ProfileCard, SignOutButton, getProfileView } from "@/components/features/user-profile";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Profile — JK Intelligence",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getProfileView();
  if (!profile) redirect("/auth/login");

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-3 px-4">
      <ProfileCard profile={profile} />
      <div className="w-full max-w-md">
        <SignOutButton />
      </div>
    </main>
  );
}
