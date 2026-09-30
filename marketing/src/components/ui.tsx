import Image from "next/image";
import Link from "next/link";
import type { ServiceIcon as ServiceIconName } from "@/lib/content";

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

/** Small uppercase label above headings. `tone` follows the section background. */
export function Eyebrow({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <p
      className={`font-mono text-xs uppercase tracking-[0.25em] ${
        tone === "dark" ? "text-gold-light" : "text-accent"
      }`}
    >
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
  tone = "dark",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-sm border px-6 py-3 text-sm font-semibold transition-colors ${
        tone === "dark"
          ? "border-gold/60 text-paper hover:border-gold-light hover:text-gold-light"
          : "border-navy/30 text-navy hover:border-navy"
      }`}
    >
      {children}
    </Link>
  );
}

/** Horizontal logo lockup: ring mark + wordmark, as on the printed logo. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <Image
        src="/logo-mark.svg"
        alt=""
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className="h-auto"
        preload
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-wordmark font-bold tracking-wide text-logo-maroon ${
            compact ? "text-base" : "text-lg sm:text-xl"
          }`}
        >
          PORTSIMEX SERVICES
        </span>
        <span className="mt-1 border-t border-[#8c8c8c]/60 pt-1 text-[11px] tracking-[0.08em] text-[#6e6e6e]">
          Your World brought closer
        </span>
      </span>
    </span>
  );
}

/** Full logo on an ivory badge with a gold edge, for dark sections. */
export function LogoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-md bg-paper p-3 ring-1 ring-gold ring-offset-4 ring-offset-ink ${className}`}
    >
      <Image
        src="/logo.svg"
        alt="Portsimex Services — Your World brought closer"
        width={150}
        height={123}
      />
    </span>
  );
}

const iconPaths: Record<ServiceIconName, React.ReactNode> = {
  plane: <path d="M2 16l20-8-6 13-3-6-6-2zM13 15l3-3" />,
  customs: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h11v10H2zM13 10h4l4 4v2h-8z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  warehouse: (
    <>
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M7 21v-8h10v8M7 17h10" />
    </>
  ),
  aid: (
    <>
      <path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11z" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  travel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18" />
    </>
  ),
  permit: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14 10h4M14 13h4" />
    </>
  ),
  car: (
    <>
      <path d="M3 16v-4l2-5h14l2 5v4z" />
      <path d="M3 12h18" />
      <circle cx="7.5" cy="16.5" r="1.8" />
      <circle cx="16.5" cy="16.5" r="1.8" />
      <path d="M12 7v-3" />
    </>
  ),
};

export function ServiceIcon({
  name,
  className = "h-6 w-6",
}: {
  name: ServiceIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {iconPaths[name]}
    </svg>
  );
}

/** The dotted-map network visual used on the business cards. */
export function NetworkMap({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/network-map.svg"
      alt="Map of Portsimex Services offices in Mogadishu, Berbera, Garowe, Kismayo and Nairobi, with freight routes to the Gulf, India and beyond"
      width={640}
      height={520}
      className={className}
      preload
    />
  );
}
