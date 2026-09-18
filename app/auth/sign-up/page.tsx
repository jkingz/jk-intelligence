import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, EmailAuthForm } from "@/components/features/email-password-auth";
import { safeNext } from "@/lib/auth/routing";

export const metadata: Metadata = {
  title: "Sign up — JK Intelligence",
};

interface SignUpPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthCard title="Create account" description="Sign up with your email and password.">
      <p className="rounded-lg border border-default bg-state-success/10 px-3 py-2 text-xs text-state-success">
        After signing up you will receive a confirmation email before you can sign in.
      </p>
      <EmailAuthForm mode="sign-up" next={next} />
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/auth/login${query}`} className="underline underline-offset-4 hover:text-foreground">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
