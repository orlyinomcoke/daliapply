"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseService } from "@/lib/supabase/server";

export type ReportInput = {
  kind: "job" | "company" | "seeker";
  reason: string;
  note: string;
  label: string;
  jobId?: string;
  companyId?: string;
  seekerId?: string;
  matchId?: string;
};
const REASONS: Record<ReportInput["kind"], string[]> = {
  job: ["Fake or scam job", "Asks seekers to pay", "Misleading salary or details", "Discriminatory requirements", "Something else"],
  company: ["Scam or asked me for money", "Harassment or rude messages", "Fake company", "Something else"],
  seeker: ["Fake profile or resume", "Harassment or rude messages", "Spam", "Something else"],
};

export async function sendReport(r: ReportInput): Promise<string | null> {
  const { supabase, user } = await getSession();
  if (!user) return "Sign in to report.";
  if (!REASONS[r.kind]?.includes(r.reason)) return "Pick a reason.";
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id, reason: r.reason, note: r.note.slice(0, 2000) || null, target_label: r.label.slice(0, 200),
    job_id: r.jobId ?? null, company_id: r.companyId ?? null, seeker_id: r.seekerId ?? null, match_id: r.matchId ?? null,
  });
  return error ? "Couldn't send your report. Please try again." : null;
}

/**
 * Delete the signed-in account. Files go first (resume, ID, receipts), then the auth
 * user, which cascades to the profile, swipes, matches and messages. Payment records
 * stay, without the company link or receipt, for tax.
 */
export async function deleteAccount() {
  const { user } = await getSession();
  if (!user) redirect("/");
  const admin = supabaseService();
  for (const bucket of ["resumes", "ids", "receipts"]) {
    const { data } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
  }
  await admin.from("payments").update({ proof_path: null }).eq("company_id", user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  const { supabase } = await getSession();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
