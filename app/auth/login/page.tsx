import type { Metadata } from "next";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthCard, EmailAuthForm } from "@/components/features/email-password-auth";
import { safeNext } from "@/lib/auth/routing";
import { GoogleSignInButton } from "./google-sign-in";

export const metadata: Metadata = {
  title: "Sign in — JK Intelligence",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthCard title="Sign in" description="Sign in to view agency reporting.">
      {params.error && (
        <p role="alert" className="rounded-lg border border-default bg-state-warning/10 px-3 py-2 text-xs text-state-warning">
          Sign-in did not complete. Please try again.
        </p>
      )}
      <Tabs defaultValue="google" className="gap-3">
        <TabsList className="w-full" aria-label="Sign-in method">
          <TabsTrigger value="google">Google OAuth</TabsTrigger>
          <TabsTrigger value="email">Email/Password</TabsTrigger>
        </TabsList>
        <TabsContent value="google">
          <GoogleSignInButton next={next} />
        </TabsContent>
        <TabsContent value="email" className="flex flex-col gap-3">
          <EmailAuthForm mode="sign-in" next={next} />
          <Link href={`/auth/forgot-password${query}`} className="text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Forgot your password?
          </Link>
        </TabsContent>
      </Tabs>
      <p className="text-center text-xs text-muted-foreground">
        Need an account?{" "}
        <Link href={`/auth/sign-up${query}`} className="underline underline-offset-4 hover:text-foreground">
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
