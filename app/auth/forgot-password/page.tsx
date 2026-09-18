import type { Metadata } from "next";
import { AuthCard, EmailAuthForm } from "@/components/features/email-password-auth";
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

  return (
    <AuthCard title="Reset password" description="Enter your email to receive a password reset link.">
      <EmailAuthForm mode="forgot-password" next={next} />
    </AuthCard>
  );
}
