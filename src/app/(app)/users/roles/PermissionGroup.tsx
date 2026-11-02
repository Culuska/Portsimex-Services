"use client";

import { useRef, useState } from "react";
import { PERMISSION_LABELS, type PermissionArea } from "@/lib/permission-catalog";

// One collapsible section of the role editor: a row per area with small
// tick-chips. Shows "x of y" and has All / None shortcuts.
export default function PermissionGroup({
  group,
  hint,
  areas,
  granted,
}: {
  group: string;
  hint: string;
  areas: PermissionArea[];
  granted: string[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const total = areas.reduce((s, a) => s + a.items.length, 0);
  const [on, setOn] = useState(() => areas.reduce((s, a) => s + a.items.filter(([p]) => granted.includes(p)).length, 0));
  const recount = () => setOn(box.current?.querySelectorAll("input:checked").length ?? 0);
  const setAll = (checked: boolean) => {
    box.current?.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((i) => (i.checked = checked));
    recount();
  };
  const btn = "rounded px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30";

  return (
    <details open className="group rounded-md border border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
        <span className="text-zinc-400 transition-transform group-open:rotate-90">›</span>
        <span className="text-sm font-semibold">{group}</span>
        <span className="hidden text-xs text-zinc-500 sm:inline">{hint}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            on === 0 ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" : on === total ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300"
          }`}
        >
          {on} of {total}
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <div className="mb-1 flex justify-end gap-1">
          <button type="button" className={btn} onClick={() => setAll(true)}>
            All
          </button>
          <button type="button" className={btn} onClick={() => setAll(false)}>
            None
          </button>
        </div>
        <div ref={box} onChange={recount} className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {areas.map((a) => (
            <div key={a.area} className="flex flex-col gap-1.5 py-1.5 sm:flex-row sm:items-center">
              <span className="w-40 shrink-0 text-sm text-zinc-700 dark:text-zinc-300">{a.area}</span>
              <div className="flex flex-wrap gap-1.5">
                {a.items.map(([p, label]) => (
                  <label
                    key={p}
                    title={PERMISSION_LABELS[p]}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600 hover:border-zinc-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:font-medium has-[:checked]:text-brand-800 dark:border-zinc-700 dark:text-zinc-400 dark:has-[:checked]:bg-brand-900/40 dark:has-[:checked]:text-brand-200"
                  >
                    <input type="checkbox" name="permissions" value={p} defaultChecked={granted.includes(p)} className="h-3.5 w-3.5" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
