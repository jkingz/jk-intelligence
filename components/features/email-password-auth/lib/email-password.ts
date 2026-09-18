import { z } from "zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/routing";

export type EmailAuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";

interface EmailAuthInput {
  email: string;
  password: string;
}

type EmailAuthResult =
  | { status: "success" | "error"; message: string }
  | { status: "redirect"; destination: string };

const emailSchema = z.email();
const passwordSchema = z.string().min(8);
const confirmationMessage = "If sign-up can proceed, check your email to confirm your account. Open the link in this browser.";
const recoveryMessage = "If an account matches that email, you will receive a reset link. Open the link in this browser.";

export async function submitEmailAuth(
  mode: EmailAuthMode,
  input: EmailAuthInput,
  origin: string,
  next?: string,
): Promise<EmailAuthResult> {
  const email = input.email.trim();
  if (mode !== "reset-password" && !emailSchema.safeParse(email).success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (mode !== "forgot-password" && !passwordSchema.safeParse(input.password).success) {
    return { status: "error", message: "Use at least 8 characters for your password." };
  }

  try {
    const supabase = createBrowserSupabaseClient();
    const destination = safeNext(next) ?? "/";

    if (mode === "sign-in") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
      if (error || !data.session) {
        return { status: "error", message: "Sign-in did not complete. Check your details and try again." };
      }
      return { status: "redirect", destination };
    }

    if (mode === "sign-up") {
      const callback = new URL("/auth/callback", origin);
      callback.searchParams.set("next", destination);
      const { error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: { emailRedirectTo: callback.toString() },
      });
      if (error && error.code !== "user_already_exists" && error.code !== "email_exists") {
        return { status: "error", message: "Unable to complete sign-up. Please try again." };
      }
      return { status: "success", message: confirmationMessage };
    }

    if (mode === "forgot-password") {
      const callback = new URL("/auth/callback", origin);
      callback.searchParams.set("next", "/auth/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
      if (error) {
        return { status: "error", message: "Unable to request a reset email. Please try again." };
      }
      return { status: "success", message: recoveryMessage };
    }

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      return { status: "error", message: "Reset link invalid or expired. Please request a new one." };
    }
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) {
      return { status: "error", message: "Unable to update your password. Please try again or request a new reset link." };
    }
    return { status: "success", message: "Password updated. You can now sign in with your new password." };
  } catch {
    return { status: "error", message: "Unable to complete your request. Please try again." };
  }
}
