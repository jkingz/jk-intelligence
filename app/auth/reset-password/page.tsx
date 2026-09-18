import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, EmailAuthForm } from "@/components/features/email-password-auth";
import { safeNext } from "@/lib/auth/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reset password — JK Intelligence",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  let canReset = false;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    canReset = !error && Boolean(data.user);
  } catch {
    canReset = false;
  }

  if (!canReset) {
    return (
      <AuthCard title="Reset link invalid" description="This password reset link is invalid or has expired.">
        <p role="alert" className="rounded-lg border border-default bg-state-warning/10 px-3 py-2 text-xs text-state-warning">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link
          href={`/auth/forgot-password${query}`}
          className="text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Request a new reset email
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Enter a new password for your account.">
      <EmailAuthForm mode="reset-password" />
      <Link href="/auth/login" className="text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Continue to sign in
      </Link>
    </AuthCard>
  );
}
