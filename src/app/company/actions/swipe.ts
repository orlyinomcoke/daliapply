"use server";
import { requireRole } from "@/lib/session";

export async function companySwipe(jobId: string, seekerId: string, direction: "left" | "right"): Promise<string | null> {
  const { supabase } = await requireRole("company");
  const { error } = await supabase.from("company_swipes").insert({ job_id: jobId, seeker_id: seekerId, direction });
  if (!error || error.code === "23505") return null;
  return "Something went wrong. Please try again.";
}
