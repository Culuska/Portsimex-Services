import Link from "next/link";
import { formatDate } from "@/lib/format";
import { allowedSubmissionMoves, isSubmissionOpen, SUBMISSION_STATUS_LABELS, type SubmissionStatus } from "@/lib/submission-rules";
import { Card } from "@/components/ui";
import ActionForm, { fieldClass } from "@/components/ActionForm";
import { recordFollowUpAction, recordSubmissionAction, updateSubmissionStatusAction } from "../case-actions";

type Submission = {
  id: string;
  reference: string | null;
  submittedAt: Date;
  status: SubmissionStatus;
  documentsSubmitted: string[];
  response: string | null;
  respondedAt: Date | null;
  nextAction: string | null;
  nextFollowUpAt: Date | null;
  notes: string | null;
  agency: { id: string; name: string; office: string | null; contactName: string | null; contactPhone: string | null };
  officer: { name: string } | null;
  followUps: { id: string; followedUpAt: Date; contact: string | null; outcome: string; nextAction: string | null; by: { name: string } | null }[];
};

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  SUBMITTED: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  INFO_REQUIRED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  WITHDRAWN: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const btnSmall = "rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800";

export default function SubmissionsCard({
  jobId,
  active,
  docsComplete,
  submissions,
  agencies,
  users,
  receivedDocs,
  defaultOfficerId,
}: {
  jobId: string;
  active: boolean;
  docsComplete: boolean;
  submissions: Submission[];
  agencies: { id: string; name: string; followUpDays: number }[];
  users: { id: string; name: string }[];
  receivedDocs: string[];
  defaultOfficerId: string | null;
}) {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Submissions &amp; follow-ups</h2>
        <Link href="/agencies" className="text-xs text-brand-600 hover:underline">Agency directory</Link>
      </div>

      {submissions.length === 0 && <p className="mb-3 text-sm text-zinc-500">Nothing submitted to a ministry or office yet.</p>}
      <ul className="flex flex-col gap-4">
        {submissions.map((s) => {
          const open = isSubmissionOpen(s.status);
          const followUpLate = open && s.nextFollowUpAt && s.nextFollowUpAt < today;
          const moves = allowedSubmissionMoves(s.status);
          return (
            <li key={s.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    <Link href={`/agencies/${s.agency.id}`} className="hover:underline">{s.agency.name}</Link>
                    {s.reference && <span className="ml-2 font-normal text-zinc-500">ref {s.reference}</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Submitted {formatDate(s.submittedAt)} · officer {s.officer?.name ?? "—"}
                    {s.agency.contactName ? ` · agency contact ${s.agency.contactName}${s.agency.contactPhone ? ` (${s.agency.contactPhone})` : ""}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{SUBMISSION_STATUS_LABELS[s.status]}</span>
              </div>
              {s.documentsSubmitted.length > 0 && <p className="mt-2 text-xs text-zinc-500">Documents submitted: {s.documentsSubmitted.join(", ")}</p>}
              {s.response && (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="text-xs text-zinc-500">Response{s.respondedAt ? ` (${formatDate(s.respondedAt)})` : ""}: </span>
                  {s.response}
                </p>
              )}
              {open && (
                <p className={`mt-2 text-xs ${followUpLate ? "font-semibold text-red-600" : "text-zinc-600 dark:text-zinc-400"}`}>
                  Next follow-up {formatDate(s.nextFollowUpAt)}
                  {followUpLate ? " -- overdue" : ""}
                  {s.nextAction ? ` · ${s.nextAction}` : ""}
                </p>
              )}

              {s.followUps.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
                  {s.followUps.map((f) => (
                    <li key={f.id} className="text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="text-zinc-400">{formatDate(f.followedUpAt)}</span> · {f.by?.name ?? "—"}
                      {f.contact ? ` spoke to ${f.contact}` : ""}: {f.outcome}
                      {f.nextAction ? ` → ${f.nextAction}` : ""}
                    </li>
                  ))}
                </ul>
              )}

              {active && (open || moves.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {open && (
                    <details>
                      <summary className={`${btnSmall} cursor-pointer list-none`}>Record follow-up…</summary>
                      <div className="mt-2 w-80">
                        <ActionForm action={recordFollowUpAction.bind(null, jobId, s.id)} submitLabel="Save follow-up">
                          <input name="contact" placeholder="Who you spoke to (optional)" className={fieldClass} />
                          <textarea name="outcome" required rows={2} placeholder="What they said / what happened" className={fieldClass} />
                          <input name="nextAction" placeholder="Next action (optional)" className={fieldClass} />
                          <label className="text-xs text-zinc-500">Next follow-up (leave empty for the agency default)<input type="date" name="nextFollowUpAt" className={`${fieldClass} mt-1 w-full`} /></label>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                  {moves.length > 0 && (
                    <details>
                      <summary className={`${btnSmall} cursor-pointer list-none`}>Update status…</summary>
                      <div className="mt-2 w-80">
                        <ActionForm action={updateSubmissionStatusAction.bind(null, jobId, s.id)} submitLabel="Update submission">
                          <select name="status" required defaultValue={moves[0]} className={fieldClass}>
                            {moves.map((m) => <option key={m} value={m}>{SUBMISSION_STATUS_LABELS[m]}</option>)}
                          </select>
                          <textarea name="response" rows={2} placeholder="Ministry / office response (required for rejection or information request)" className={fieldClass} />
                          <input name="nextAction" placeholder="Next action (optional)" className={fieldClass} />
                          <label className="text-xs text-zinc-500">Next follow-up (if still open)<input type="date" name="nextFollowUpAt" className={`${fieldClass} mt-1 w-full`} /></label>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {active && (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {!docsComplete ? (
            <p className="text-sm font-medium text-red-600">DOCUMENTATION INCOMPLETE -- receive the required documents before submitting.</p>
          ) : agencies.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Add the ministry or office to the <Link href="/agencies" className="text-brand-600 hover:underline">agency directory</Link> first.
            </p>
          ) : (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-brand-600">Record a new submission…</summary>
              <div className="mt-3">
                <ActionForm action={recordSubmissionAction.bind(null, jobId)} submitLabel="Record submission">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select name="agencyId" required defaultValue="" className={fieldClass}>
                      <option value="">Ministry / office…</option>
                      {agencies.map((a) => <option key={a.id} value={a.id}>{a.name} (follow up every {a.followUpDays}d)</option>)}
                    </select>
                    <input name="reference" placeholder="Submission reference / file no." className={fieldClass} />
                    <label className="text-xs text-zinc-500">Submitted on<input type="date" name="submittedAt" className={`${fieldClass} mt-1 w-full`} /></label>
                    <label className="text-xs text-zinc-500">
                      Officer responsible
                      <select name="officerId" defaultValue={defaultOfficerId ?? ""} className={`${fieldClass} mt-1 w-full`}>
                        <option value="">Me</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-zinc-500">First follow-up (leave empty for the agency default)<input type="date" name="nextFollowUpAt" className={`${fieldClass} mt-1 w-full`} /></label>
                  </div>
                  {receivedDocs.length > 0 && (
                    <fieldset className="flex flex-col gap-1">
                      <legend className="mb-1 text-xs text-zinc-500">Documents submitted</legend>
                      {receivedDocs.map((d) => (
                        <label key={d} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <input type="checkbox" name="documentsSubmitted" value={d} defaultChecked /> {d}
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <textarea name="notes" rows={2} placeholder="Notes (optional)" className={fieldClass} />
                </ActionForm>
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
