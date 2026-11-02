import Link from "next/link";
import { WhoBadge } from "@/components/Journey";
import type { NextAction } from "@/lib/journey";

export type PipelineItem = { href: string; title: string; meta: string; flag?: "red" | "amber" };
export type PipelineColumn = {
  step: number;
  label: string;
  who: NextAction["who"];
  count: number;
  value?: string;
  items: PipelineItem[];
  viewAll: string;
  empty: string;
  /** This step is the signed-in user's job -- highlighted as "Your step". */
  mine?: boolean;
};

// The dashboard's "work pipeline": every piece of work moving left to right
// from the client's request to the money received, one column per step.
export default function Pipeline({ columns }: { columns: PipelineColumn[] }) {
  return (
    <section aria-label="Work pipeline" className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Work pipeline -- request to payment</h2>
      </div>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {columns.map((c, i) => (
          <li
            key={c.label}
            className={`relative flex flex-col rounded-lg border bg-white dark:bg-zinc-950 ${c.mine ? "border-brand-500 ring-2 ring-brand-100 dark:ring-brand-900/60" : "border-zinc-200 dark:border-zinc-800"}`}
          >
            {c.mine && (
              <span className="absolute -top-2.5 left-3 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Your step</span>
            )}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white">{c.step}</span>
                {c.label}
              </p>
              <WhoBadge who={c.who} />
            </div>
            <Link href={c.viewAll} className="block px-3 pt-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{c.count}</p>
              <p className="min-h-[1rem] text-xs text-zinc-500">{c.value ?? " "}</p>
            </Link>
            <ul className="flex flex-1 flex-col gap-1 px-3 py-2">
              {c.items.length === 0 ? (
                <li className="py-2 text-xs text-zinc-400">{c.empty}</li>
              ) : (
                c.items.map((it) => (
                  <li key={it.href} className="min-w-0">
                    <Link href={it.href} className="block rounded px-1.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <p className={`truncate text-xs font-medium ${it.flag === "red" ? "text-red-700 dark:text-red-400" : it.flag === "amber" ? "text-amber-700 dark:text-amber-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                        {it.title}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">{it.meta}</p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
            <Link href={c.viewAll} className="border-t border-zinc-100 px-3 py-2 text-xs font-medium text-brand-600 hover:underline dark:border-zinc-800">
              View all →
            </Link>
            {i < columns.length - 1 && (
              <span aria-hidden className="absolute -right-2.5 top-3 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-400 2xl:flex dark:bg-zinc-800">
                ›
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
