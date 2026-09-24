import { Suspense } from "react";

import { DashboardSkeleton } from "@/components/features/dashboard";
import { DashboardView } from "./dashboard-view";

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardView />
    </Suspense>
  );
}