import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import { consumeVerifyToken } from "@/lib/auth-tokens";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const user = await consumeVerifyToken(token);
  return (
    <AuthCard title={user ? "Email confirmed" : "Link expired"}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {user ? `Thanks ${user.name.split(" ")[0]} -- ${user.email} is confirmed.` : "This confirmation link has expired or was already used. Send a new one from My account."}
      </p>
      <Link href="/" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
        Continue
      </Link>
    </AuthCard>
  );
}
