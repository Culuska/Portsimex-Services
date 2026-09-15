"use client";

import { useState } from "react";
import { saveChainAction } from "../actions";

export default function ChainEditor({
  shipmentType,
  allMinistries,
  initialChain,
}: {
  shipmentType: string;
  allMinistries: { id: string; name: string; active: boolean }[];
  initialChain: { id: string; name: string }[];
}) {
  const [chain, setChain] = useState(initialChain);
  const [addId, setAddId] = useState("");

  const available = allMinistries.filter(
    (m) => m.active && !chain.some((c) => c.id === m.id),
  );

  function addMinistry() {
    const ministry = allMinistries.find((m) => m.id === addId);
    if (!ministry) return;
    setChain((prev) => [...prev, { id: ministry.id, name: ministry.name }]);
    setAddId("");
  }

  function remove(id: string) {
    setChain((prev) => prev.filter((c) => c.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    setChain((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form action={saveChainAction} className="flex flex-col gap-3">
      <input type="hidden" name="shipmentType" value={shipmentType} />
      {chain.map((c) => (
        <input key={c.id} type="hidden" name="ministryIds[]" value={c.id} />
      ))}

      {chain.length === 0 ? (
        <p className="text-sm text-zinc-500">No ministries in this chain yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {chain.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm"
            >
              <span>
                <span className="mr-2 text-zinc-400">{i + 1}.</span>
                {c.name}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === chain.length - 1}
                  className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="ml-2 text-zinc-400 hover:text-red-600"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Add a ministry…</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addMinistry}
          disabled={!addId}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      <button
        type="submit"
        className="mt-1 w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Save chain
      </button>
    </form>
  );
}
