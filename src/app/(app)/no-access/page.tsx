import Link from "next/link";
import { Card } from "@/components/ui";
import { isPermission, PERMISSION_LABELS } from "@/lib/permission-catalog";

export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ need?: string; limit?: string }> }) {
  const { need = "" } = await searchParams;
  const needs = need.split(",").filter(isPermission);
  const what =
    need === "approval-limit"
      ? "This amount is above the approval limit for your role -- it needs someone with a higher limit."
      : need === "job"
      ? "This job belongs to a service line or team you don't work on."
      : need === "admin" || need === "users.manage"
        ? "This is for administrators."
        : needs.length
          ? `It needs the "${needs.map((p) => PERMISSION_LABELS[p]).join('" or "')}" permission.`
          : "Your role doesn't include this.";
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <h1 className="text-lg font-semibold">You don&apos;t have access to that</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{what}</p>
      <p className="mt-2 text-sm text-zinc-500">If you need it for your work, ask an administrator to update your role.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
        Back to the dashboard
      </Link>
    </Card>
  );
}
