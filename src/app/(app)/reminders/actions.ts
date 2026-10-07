"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { generateReminders } from "@/lib/reminders";

// Reminders also go out automatically once a day; this sends any that are
// due right now. Dedupe keys mean nobody is notified twice for the same thing.
export async function sendRemindersNowAction(): Promise<{ error: string | null }> {
  await requirePermission("jobs.supervise");
  await generateReminders();
  revalidatePath("/notifications");
  revalidatePath("/reminders");
  return { error: null };
}
