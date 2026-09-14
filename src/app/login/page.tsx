import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-brand-800 dark:text-brand-200">
          Portsimex <span className="text-accent-600">Services</span>
        </h1>
        <p className="text-xs font-medium text-zinc-400">Your World brought closer</p>
        <p className="mt-3 text-sm text-zinc-500">Sign in to your account</p>
        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl ?? "/"} />
        </div>
      </div>
    </div>
  );
}
