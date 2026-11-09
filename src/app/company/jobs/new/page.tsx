import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { csv, intOrNull, parseSkillLines } from "@/lib/skills";
import { SubmitButton } from "@/components/SubmitButton";
import { CompanyNav } from "@/components/Nav";

async function createJob(formData: FormData) {
  "use server";
  const { supabase, user } = await requireRole("company");
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      company_id: user.id,
      title: String(formData.get("title")).trim(),
      description: String(formData.get("description") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim().toUpperCase() || null,
      remote: formData.get("remote") === "on",
      relocation_offered: formData.get("relocation") === "on",
      salary_min: intOrNull(formData.get("salary_min")),
      salary_max: intOrNull(formData.get("salary_max")),
      languages: csv(formData.get("languages")),
      status: "awaiting_payment",
    })
    .select("id")
    .single();
  if (error) throw error;
  const skills = new Map(parseSkillLines(String(formData.get("skills") ?? "")).map((s) => [s.skill, s]));
  if (skills.size) {
    const { error: e2 } = await supabase
      .from("job_skills")
      .insert([...skills.values()].map((s) => ({ job_id: job.id, skill: s.skill, label: s.label, min_years: s.years })));
    if (e2) throw e2;
  }
  redirect(`/company/jobs/${job.id}`);
}

export default async function NewJob() {
  await requireRole("company");
  return (
    <div className="space-y-6">
      <CompanyNav />
      <form action={createJob} className="card mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Post a job</h1>
        <p className="text-sm text-muted">$40 per post. Includes 30 paid right swipes: each verified seeker you swipe right on earns PHP 20, which is why seekers keep their profiles up to date.</p>
        <label className="block"><span className="label">Job title</span><input name="title" required className="input" placeholder="Senior PHP Developer" /></label>
        <label className="block"><span className="label">Description and key requirements</span><textarea name="description" rows={5} className="input" /></label>
        <label className="block">
          <span className="label">Required skills and minimum years, one per line</span>
          <textarea name="skills" rows={4} className="input font-mono text-sm" placeholder={"PHP: 5\nManagement: 2"} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Monthly salary from (PHP)</span><input name="salary_min" className="input" /></label>
          <label className="block"><span className="label">to (PHP)</span><input name="salary_max" className="input" /></label>
          <label className="block"><span className="label">Country (2 letters)</span><input name="country" className="input" defaultValue="PH" /></label>
          <label className="block"><span className="label">Required languages (comma separated)</span><input name="languages" className="input" placeholder="english" /></label>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="remote" /> Remote</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="relocation" /> Relocation offered</label>
        </div>
        <SubmitButton>Continue to payment</SubmitButton>
      </form>
    </div>
  );
}
