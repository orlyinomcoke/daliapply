import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { CompanyNav } from "@/components/Nav";
import { JobForm } from "../../JobForm";

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireRole("company");
  const { data: job } = await supabase.from("jobs").select("*, job_skills(label, skill, min_years)").eq("id", id).maybeSingle();
  if (!job) notFound();
  if (job.pay_status === "submitted" || job.status === "active") redirect(`/company/jobs/${id}`);
  const skills = (job.job_skills as { label: string | null; skill: string; min_years: number }[]).map((k) => `${k.label ?? k.skill}: ${Number(k.min_years)}`).join("\n");
  return (
    <div className="space-y-6">
      <CompanyNav />
      <JobForm jobId={id} initial={{
        title: job.title, description: job.description, skillsText: skills,
        salaryMin: String(job.salary_min ?? ""), salaryMax: String(job.salary_max ?? ""), country: job.country ?? "PH",
        languages: (job.languages ?? []).join(", "), remote: job.remote, relocation: job.relocation_offered,
      }} />
    </div>
  );
}
