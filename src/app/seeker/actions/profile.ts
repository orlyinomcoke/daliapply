"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { extractResume } from "@/lib/ai";
import { csv, intOrNull, parseSkillLines } from "@/lib/skills";

export async function uploadResume(formData: FormData) {
  const { supabase, user } = await requireRole("seeker");
  const file = formData.get("resume") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a PDF resume");
  if (file.type !== "application/pdf") throw new Error("Resume must be a PDF");
  if (file.size > 10 * 1024 * 1024) throw new Error("Resume must be under 10 MB");

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/resume.pdf`;
  const up = await supabase.storage.from("resumes").upload(path, bytes, { upsert: true, contentType: "application/pdf" });
  if (up.error) throw up.error;

  const p = await extractResume(bytes);
  const { error } = await supabase
    .from("seekers")
    .update({
      first_name: p.first_name,
      last_name: p.last_name,
      headline: p.headline,
      total_years: p.total_years,
      salary_min: p.salary_min,
      salary_max: p.salary_max,
      salary_currency: p.salary_currency || "PHP",
      country: p.country,
      languages: p.languages.map((l) => l.toLowerCase()),
      recent_roles: p.recent_roles,
      resume_path: path,
      resume_text: p.resume_text,
      profile_confirmed: false,
    })
    .eq("id", user.id);
  if (error) throw error;

  await supabase.from("seeker_skills").delete().eq("seeker_id", user.id);
  if (p.skills.length) {
    const rows = new Map(p.skills.map((s) => [s.skill.toLowerCase(), { seeker_id: user.id, skill: s.skill.toLowerCase(), label: s.skill, years: s.years }]));
    const { error: e2 } = await supabase.from("seeker_skills").insert([...rows.values()]);
    if (e2) throw e2;
  }
  revalidatePath("/seeker/profile");
}

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireRole("seeker");
  const { error } = await supabase
    .from("seekers")
    .update({
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      headline: String(formData.get("headline") ?? "").trim(),
      total_years: Number(formData.get("total_years") ?? 0),
      salary_min: intOrNull(formData.get("salary_min")),
      salary_max: intOrNull(formData.get("salary_max")),
      country: String(formData.get("country") ?? "").trim().toUpperCase() || null,
      languages: csv(formData.get("languages")),
      open_to_remote: formData.get("open_to_remote") === "on",
      open_to_relocate: formData.get("open_to_relocate") === "on",
      availability: String(formData.get("availability") ?? "").trim() || null,
      profile_confirmed: true,
    })
    .eq("id", user.id);
  if (error) throw error;

  const skills = new Map(parseSkillLines(String(formData.get("skills") ?? "")).map((s) => [s.skill, s]));
  await supabase.from("seeker_skills").delete().eq("seeker_id", user.id);
  if (skills.size) {
    const { error: e2 } = await supabase
      .from("seeker_skills")
      .insert([...skills.values()].map((s) => ({ ...s, seeker_id: user.id })));
    if (e2) throw e2;
  }
  redirect("/seeker");
}
