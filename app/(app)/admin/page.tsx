import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPanel } from "@/components/features/admin";
import { getAdminView } from "@/lib/admin/provisioning";
import { requireAdmin } from "@/lib/agents/authAgent";

export const metadata: Metadata = {
  title: "Admin — JK Intelligence",
};

/** Dynamic for the same reason /connections is: the read is cookie-bound and the
 *  shared db wrapper would turn a prerender bailout into a build error. If this
 *  line ever stops being load-bearing, delete it and say so in the tracker. */
export const dynamic = "force-dynamic";

export default async function Page() {
  const decision = await requireAdmin();
  if (!decision.allow) redirect("/dashboard");
  return <AdminPanel view={await getAdminView()} />;
}
