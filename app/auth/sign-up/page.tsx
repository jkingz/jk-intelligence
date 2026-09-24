import type { Metadata } from "next";
import {
  AuthCard,
  AuthFlow,
  AuthPageShell,
} from "@/components/features/email-password-auth";
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
  const demoEmail = process.env.DEMO_EMAIL;
  const demoPassword = process.env.DEMO_PASSWORD;

  return (
    <AuthPageShell chrome={false}>
      <AuthCard description="Create your account.">
        <AuthFlow
          initialMode="sign-up"
          next={next}
          demoEmail={demoEmail}
          demoPassword={demoPassword}
        />
      </AuthCard>
    </AuthPageShell>
  );
}