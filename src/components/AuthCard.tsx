// The centered card used by the sign-in, password reset and verification pages.
export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xl font-semibold text-brand-800 dark:text-brand-200">
          Portsimex <span className="text-accent-600">Services</span>
        </p>
        <p className="text-xs font-medium text-zinc-400">Your World brought closer</p>
        <h1 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
