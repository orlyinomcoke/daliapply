"use server";
import { requireRole } from "@/lib/session";

export async function seekerSwipe(jobId: string, direction: "left" | "right"): Promise<string | null> {
  const { supabase, user } = await requireRole("seeker");
  const { error } = await supabase.from("seeker_swipes").insert({ seeker_id: user.id, job_id: jobId, direction });
  if (!error) return null;
  if (error.message.includes("DAILY_RIGHT_SWIPE_CAP")) return "You've used today's right swipes. Come back tomorrow, or keep swiping left.";
  if (error.code === "23505") return null; // already swiped
  return "Something went wrong. Please try again.";
}

export async function hideCompany(companyId: string): Promise<string | null> {
  const { supabase, user } = await requireRole("seeker");
  const { data: days } = await supabase.from("app_settings").select("value").eq("key", "hide_company_days").single();
  const until = new Date(Date.now() + Number(days?.value ?? 30) * 86_400_000).toISOString();
  const { error } = await supabase
    .from("hidden_companies")
    .upsert({ seeker_id: user.id, company_id: companyId, hidden_until: until });
  return error ? "Could not hide this company." : null;
}
