"use server";

import { headers } from "next/headers";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { clientIp, loginLockout } from "@/lib/login";
import { minutesText } from "@/lib/security-rules";

export type LoginState = { error: string | null; needCode?: boolean };

// Only same-site paths are allowed as the post-login destination.
function safeCallback(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      code,
      redirectTo: safeCallback(formData.get("callbackUrl")),
    });
    return { error: null };
  } catch (err) {
    if (err instanceof CredentialsSignin) {
      switch (err.code) {
        case "mfa_required":
          return { error: null, needCode: true };
        case "mfa_invalid":
          return { error: "That code didn't work. Enter the current 6-digit code from your authenticator app, or a recovery code.", needCode: true };
        case "locked": {
          const wait = await loginLockout(email.trim().toLowerCase(), clientIp(await headers()));
          return { error: `Too many failed attempts. For your security, sign-in is paused -- try again in ${minutesText(wait)}, or reset your password.` };
        }
        default:
          return { error: "Invalid email or password.", needCode: !!code };
      }
    }
    if (err instanceof AuthError) return { error: "Invalid email or password." };
    throw err;
  }
}
