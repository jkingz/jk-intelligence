import { AppNav } from "./app-nav";

/**
 * Server component, and it must stay one: a session read here would make
 * /dashboard dynamic again, which is the 4-5s-switch defect the client-side
 * boot fetch was built to fix. The rail renders no user data.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full flex-col lg:flex-row">
      <AppNav />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
