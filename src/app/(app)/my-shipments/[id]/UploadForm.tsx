"use client";

import { useActionState, useRef } from "react";
import { uploadClearanceDocumentAction } from "../../clearance/actions";

export default function UploadForm({
  shipmentId,
  documentTypeOptions,
}: {
  shipmentId: string;
  documentTypeOptions: string[];
}) {
  const [state, formAction, pending] = useActionState(uploadClearanceDocumentAction, {
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="documentType" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Document type
        </label>
        <input
          id="documentType"
          name="documentType"
          list="doc-type-options"
          required
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <datalist id="doc-type-options">
          {documentTypeOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="file" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          File
        </label>
        <input
          id="file"
          name="file"
          type="file"
          required
          className="text-sm text-zinc-700 dark:text-zinc-300"
        />
        <p className="text-xs text-zinc-500">
          Uploading a document type that already exists adds a new version instead of
          replacing it.
        </p>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}
