import type { Metadata } from "next";
import { LegalPageShell } from "@/components/features/landing/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions — JK Intelligence",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms & Conditions" updated="September 19, 2026">
      <p>
        By using JK Intelligence you agree to these terms. The service provides automated organic
        performance reporting by reading from platforms you authorize. You are responsible for
        maintaining those authorizations and for the accuracy of the accounts you connect.
      </p>
      <p>
        We provide the service &quot;as is&quot; and make no guarantees about the completeness,
        accuracy, or timeliness of data pulled from third-party platforms. Third-party outages or
        rate limits may delay or prevent syncs.
      </p>
      <p>
        You may not resell the service, probe it for vulnerabilities, or use it to harvest data
        from clients you are not authorized to access. Accounts may be suspended for abuse.
      </p>
      <p>
        We may update these terms from time to time. Continued use of the service after changes
        take effect constitutes acceptance of the revised terms.
      </p>
    </LegalPageShell>
  );
}