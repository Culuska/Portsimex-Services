import LoginForm from "./LoginForm";
import { Logo } from "@/components/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 shadow-sm">
        <Logo size="lg" showTagline />
        <p className="mt-6 text-sm text-zinc-500">Sign in to your account</p>
        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl ?? "/"} />
        </div>
      </div>
    </div>
  );
}
