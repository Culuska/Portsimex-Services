import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; ended?: string; reset?: string }>;
}) {
  const { callbackUrl, ended, reset } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-brand-800 dark:text-brand-200">
          Portsimex <span className="text-accent-600">Services</span>
        </h1>
        <p className="text-xs font-medium text-zinc-400">Your World brought closer</p>
        <p className="mt-3 text-sm text-zinc-500">Sign in to your account</p>
        {ended && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Your session has ended. Please sign in again.
          </p>
        )}
        {reset && (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Your password has been changed. Sign in with your new password.
          </p>
        )}
        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl ?? "/"} />
        </div>
      </div>
    </div>
  );
}
