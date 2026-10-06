"use client";

export default function ReportToolbar({ exportHref }: { exportHref: string }) {
  return (
    <div className="flex gap-2 print:hidden">
      <a
        href={exportHref}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Export to Excel
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
