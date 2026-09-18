import type { ProfileView } from "../lib/profile";

const roleLabels: Record<NonNullable<ProfileView["role"]>, string> = {
  admin: "Admin",
  client: "Client",
};

export function ProfileDetails({ profile }: { profile: ProfileView }) {
  return (
    <dl className="flex flex-col gap-2 rounded-xl border border-default bg-surface p-4 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Name</dt>
        <dd className="text-primary">{profile.name ?? "—"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="text-primary">{profile.email ?? "—"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Role</dt>
        <dd className="text-primary">{profile.role ? roleLabels[profile.role] : "—"}</dd>
      </div>
      {profile.role === "client" && profile.clientId && (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Client</dt>
          <dd className="font-mono text-xs text-primary">{profile.clientId}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Sign-in methods</dt>
        <dd className="text-primary">
          {profile.providers.length > 0
            ? profile.providers.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")
            : "—"}
        </dd>
      </div>
    </dl>
  );
}
