"use client";

export default function PrintButton() {
  return (
    <div className="mb-4 flex justify-end print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
