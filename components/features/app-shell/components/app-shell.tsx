import { AppNav } from "./app-nav";
import { MobileNav } from "./mobile-nav";
import { PersistentSidebarProvider } from "./sidebar-provider";

/**
 * Server component, and it must stay one: a session read here would make
 * /dashboard dynamic again, which is the 4-5s-switch defect the client-side
 * boot fetch was built to fix. The rail renders no user data; the account block
 * in its footer fetches its own identity from /api/auth/me after hydration.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PersistentSidebarProvider>
      <AppNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        {children}
      </div>
    </PersistentSidebarProvider>
  );
}
