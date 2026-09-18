import type { Metadata } from "next";
import {
  AuthCard,
  AuthFlow,
  AuthPageShell,
} from "@/components/features/email-password-auth";
import { safeNext } from "@/lib/auth/routing";

export const metadata: Metadata = {
  title: "Sign in — JK Intelligence",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <AuthPageShell chrome={false}>
      <AuthCard description="Sign in to view agency reporting.">
        <AuthFlow initialMode="sign-in" next={next} error={Boolean(params.error)} />
      </AuthCard>
    </AuthPageShell>
  );
}