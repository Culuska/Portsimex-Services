import Link from "next/link";
import type { Journey, NextAction } from "@/lib/journey";

// The Request -> Approval -> Operations -> Billing -> Payment -> Closed bar,
// shown the same way on the dashboard, requests, jobs and invoices.
export function JourneyBar({ journey, compact = false }: { journey: Journey; compact?: boolean }) {
  return (
    <ol className={`flex w-full items-start overflow-x-auto ${compact ? "gap-0" : "gap-0 pb-1"}`} aria-label="Progress">
      {journey.steps.map((s, i) => {
        const last = i === journey.steps.length - 1;
        const dot =
          s.state === "done"
            ? "bg-emerald-600 text-white border-emerald-600"
            : s.state === "current"
              ? "bg-brand-600 text-white border-brand-600 ring-4 ring-brand-100 dark:ring-brand-900/60"
              : s.state === "skipped"
                ? "border-dashed border-zinc-300 text-zinc-400 bg-white dark:bg-zinc-950 dark:border-zinc-700"
                : "border-zinc-300 text-zinc-500 bg-white dark:bg-zinc-950 dark:border-zinc-700";
        const line = s.state === "done" ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-800";
        return (
          <li key={s.key} className="flex min-w-[6.5rem] flex-1 flex-col" aria-current={s.state === "current" ? "step" : undefined}>
            <div className="flex items-center">
              <span className={`flex ${compact ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-xs"} shrink-0 items-center justify-center rounded-full border-2 font-semibold ${dot}`}>
                {s.state === "done" ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              {!last && <span className={`mx-1 h-0.5 flex-1 rounded ${line}`} />}
            </div>
            <p
              className={`mt-1.5 pr-2 text-xs font-semibold ${
                s.state === "current" ? "text-brand-700 dark:text-brand-300" : s.state === "done" ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400"
              }`}
            >
              {s.label}
            </p>
            {!compact && s.detail && <p className="pr-2 text-[11px] leading-tight text-zinc-500">{s.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}

const WHO_STYLE: Record<NextAction["who"], string> = {
  Operations: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  Manager: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Client: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function WhoBadge({ who }: { who: NextAction["who"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${WHO_STYLE[who]}`}>{who}</span>;
}

/** The journey bar plus "what happens next" -- the top of every request and job. */
export function JourneyPanel({ journey, children }: { journey: Journey; children?: React.ReactNode }) {
  const next = journey.next;
  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <JourneyBar journey={journey} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {journey.cancelled ? (
          <p className="text-sm text-zinc-500">Cancelled -- nothing more to do.</p>
        ) : next ? (
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Next</span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {next.href ? (
                  <Link href={next.href} className="hover:underline">
                    {next.label} →
                  </Link>
                ) : (
                  next.label
                )}
                <WhoBadge who={next.who} />
              </p>
              {next.hint && <p className="text-xs text-zinc-500">{next.hint}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">All done -- completed, billed, paid and closed.</p>
        )}
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </section>
  );
}

/** Client › Request › Job › Invoice -- where this record sits in the chain. */
export function RecordChain({ items }: { items: { label: string; href?: string; sub?: string }[] }) {
  return (
    <nav aria-label="Related records" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300 dark:text-zinc-600">›</span>}
          {it.href ? (
            <Link href={it.href} className="font-medium text-brand-600 hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{it.label}</span>
          )}
          {it.sub && <span className="text-zinc-400">{it.sub}</span>}
        </span>
      ))}
    </nav>
  );
}
