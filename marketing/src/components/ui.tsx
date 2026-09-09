import Link from "next/link";

export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-6xl px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-light">
      {children}
    </p>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-strong"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-sm border border-ink-line px-6 py-3 text-sm font-semibold text-paper transition-colors hover:border-paper-dim"
    >
      {children}
    </Link>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-sm text-paper-dim">{label}</p>
    </div>
  );
}

export function RoutePattern({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <path
        d="M -20 320 C 150 320, 180 120, 340 120 S 520 300, 700 200 S 780 60, 900 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
      <path
        d="M -40 80 C 100 40, 260 220, 420 220 S 640 40, 820 140"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 10"
        strokeLinecap="round"
        opacity="0.6"
      />
      {[
        [40, 320],
        [340, 120],
        [700, 200],
        [420, 220],
        [820, 140],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.5} fill="currentColor" />
      ))}
    </svg>
  );
}
