import { AppShell } from "@/components/features/app-shell";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
