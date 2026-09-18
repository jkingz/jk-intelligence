import type { Metadata } from "next";
import { LegalPageShell } from "@/components/features/landing/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — JK Intelligence",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="September 19, 2026">
      <p>
        JK Intelligence collects the minimum data needed to operate the service: account
        credentials for the organic search and analytics platforms you connect, and the aggregated
        performance metrics those platforms return. We never sell or share raw client data with
        third parties.
      </p>
      <p>
        Metrics are stored per client and isolated at the database layer. Only users with an
        explicit role on a client (admin, client, or staff) can read that client&apos;s data.
      </p>
      <p>
        Authentication is handled by Google OAuth and Supabase Auth. We retain sync logs and
        operational telemetry for troubleshooting and audit purposes.
      </p>
      <p>
        To request access, correction, or deletion of your data, contact the account administrator
        for your organization.
      </p>
    </LegalPageShell>
  );
}