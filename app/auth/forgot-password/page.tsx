import type { Metadata } from "next";
import Link from "next/link";
import {
  AuthCard,
  AuthPageShell,
  EmailAuthForm,
} from "@/components/features/email-password-auth";
import { safeNext } from "@/lib/auth/routing";

export const metadata: Metadata = {
  title: "Forgot password — JK Intelligence",
};

interface ForgotPasswordPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthPageShell>
      <AuthCard title="Reset password" description="Enter your email to receive a password reset link.">
        <EmailAuthForm mode="forgot-password" next={next} />
        <Link
          href={`/auth/login${query}`}
          className="text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to sign in
        </Link>
      </AuthCard>
    </AuthPageShell>
  );
}