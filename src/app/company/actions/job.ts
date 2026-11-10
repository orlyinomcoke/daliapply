"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { jobChecks, jobErrors, parseSkillLines, type JobDraft } from "@/lib/jobcheck";
import { notifySales, SALES_EMAIL } from "@/lib/email";

const toJob = (d: JobDraft) => ({
  title: d.title.trim(),
  description: d.description.trim(),
  country: d.country,
  remote: d.remote,
  relocation_offered: d.relocation,
  salary_min: Math.round(Number(d.salaryMin)),
  salary_max: Math.round(Number(d.salaryMax)),
  languages: d.languages.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
});

/** Step 2: field errors (block) and likely mistakes (warn, with fixes). */
export async function checkJob(d: JobDraft) {
  await requireRole("company");
  const errors = jobErrors(d);
  if (errors.length) return { errors, checks: [] };
  const job = toJob(d);
  return { errors, checks: jobChecks({ description: job.description, skills: parseSkillLines(d.skillsText).skills, salaryMin: job.salary_min, salaryMax: job.salary_max }) };
}

/** Save a new post (then pay) or changes to one not yet under payment review. */
export async function saveJob(d: JobDraft, jobId?: string): Promise<string> {
  const { supabase, user } = await requireRole("company");
  if (jobErrors(d).length) return "Some fields still need fixing. Go back and check them.";
  const skills = new Map(parseSkillLines(d.skillsText).skills.map((k) => [k.label.toLowerCase(), k]));
  let id = jobId;
  if (id) {
    const { error } = await supabase.from("jobs").update(toJob(d)).eq("id", id).eq("company_id", user.id);
    if (error) return error.message.includes("JOB_LOCKED") ? "This post is locked while we check your payment." : "Couldn't save your changes. Please try again.";
    await supabase.from("job_skills").delete().eq("job_id", id);
  } else {
    const { data, error } = await supabase.from("jobs").insert({ ...toJob(d), company_id: user.id, status: "awaiting_payment" }).select("id").single();
    if (error) return "Couldn't save your job. Please try again.";
    id = data.id as string;
  }
  const { error } = await supabase.from("job_skills").insert([...skills.values()].map((k) => ({ job_id: id, skill: k.label.toLowerCase(), label: k.label, min_years: k.min })));
  if (error) return "Couldn't save the skills. Please try again.";
  revalidatePath("/company");
  redirect(`/company/jobs/${id}`);
}

/** Step 3: the company has paid by GCash; record it and tell sales. */
export async function submitPayment(input: { jobId: string; reference: string; body: string; proofPath: string }): Promise<string | null> {
  const { supabase, user } = await requireRole("company");
  const reference = input.reference.trim();
  if (reference.length < 3) return "Add the GCash or InstaPay reference number.";
  if (!input.proofPath.startsWith(`${user.id}/`)) return "Attach a screenshot of your receipt.";
  const [{ data: job }, { data: company }] = await Promise.all([
    supabase.from("jobs").select("title, pay_status").eq("id", input.jobId).eq("company_id", user.id).single(),
    supabase.from("companies").select("name").eq("id", user.id).single(),
  ]);
  if (!job || !company) return "We couldn't find this job.";
  if (job.pay_status === "submitted") return "You've already sent a payment for this job. We're checking it.";
  const { data, error } = await supabase.from("payments").insert({
    job_id: input.jobId, company_id: user.id, company_name: company.name, job_title: job.title,
    amount_php: 0, reference, subject: `Job post payment: ${job.title} (${company.name})`,
    body: input.body.slice(0, 8000), proof_path: input.proofPath,
  }).select("id").single();
  if (error) return "Couldn't send your payment details. Please try again, or email " + SALES_EMAIL() + ".";
  await notifySales(data.id);
  revalidatePath(`/company/jobs/${input.jobId}`);
  return null;
}

export async function markFilled(jobId: string, filled: boolean) {
  const { supabase, user } = await requireRole("company");
  await supabase.from("jobs").update({ filled_at: filled ? new Date().toISOString() : null }).eq("id", jobId).eq("company_id", user.id);
  revalidatePath(`/company/jobs/${jobId}`);
  revalidatePath("/company");
}
