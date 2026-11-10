"use server";
import { requireRole } from "@/lib/session";
import { notifyMatch } from "@/lib/email";

export async function companySwipe(jobId: string, seekerId: string, direction: "left" | "right"): Promise<string | null> {
  const { supabase } = await requireRole("company");
  const { error } = await supabase.from("company_swipes").insert({ job_id: jobId, seeker_id: seekerId, direction });
  if (!error && direction === "right") await notifyMatch(jobId, seekerId);
  if (!error || error.code === "23505") return null;
  if (error.message.includes("JOB_NOT_LIVE")) return "This job is no longer live. Renew it to keep swiping.";
  return "Something went wrong. Please try again.";
}
