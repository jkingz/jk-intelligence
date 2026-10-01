import type { Metadata } from "next";

import { ConnectionsPage } from "@/components/features/connections";
import { listConnections } from "@/lib/db/repository";

export const metadata: Metadata = {
  title: "Connections — JK Intelligence",
};

/** Dynamic on purpose: it reads the session cookie through the RLS gate. Do not
 *  add `revalidate` or a cache wrapper — see architecture-context.md invariant 4-5.
 *
 *  `force-dynamic` is load-bearing, not decorative: the cookie read happens
 *  inside `databaseOperation()`, whose catch-all turns Next's prerender bailout
 *  into `Error("Database operation failed")`, so a static attempt fails the build
 *  instead of opting the route out. Declaring the segment dynamic stops the
 *  attempt before it reaches that catch. */
export const dynamic = "force-dynamic";

export default async function Page() {
  return <ConnectionsPage connections={await listConnections()} />;
}
