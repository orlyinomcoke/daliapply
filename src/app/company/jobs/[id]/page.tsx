import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { parseSearch } from "@/lib/ai";
import { CompanyNav } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { CompanyDeck, type SeekerCard } from "./CompanyDeck";

type Params = { id: string };
type Search = { q?: string; role?: string; skills?: string };

/** skills param format: "php:5,management:0" */
function decodeSkills(v?: string) {
  return (v ?? "").split(",").filter(Boolean).map((p) => {
    const [skill, y] = p.split(":");
    return { skill: decodeURIComponent(skill), min_years: Number(y) || 0 };
  });
}
function encodeSkills(skills: { skill: string; min_years: number }[]) {
  return skills.map((s) => `${encodeURIComponent(s.skill.toLowerCase())}:${s.min_years}`).join(",");
}
function href(id: string, s: { q?: string; role?: string | null; skills: { skill: string; min_years: number }[] }) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.role) p.set("role", s.role);
  if (s.skills.length) p.set("skills", encodeSkills(s.skills));
  return `/company/jobs/${id}?${p}`;
}

export default async function JobPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireRole("company");
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  async function search(formData: FormData) {
    "use server";
    await requireRole("company");
    const q = String(formData.get("q") ?? "").trim();
    if (!q) redirect(`/company/jobs/${id}`);
    const f = await parseSearch(q);
    redirect(href(id, { q, role: f.role, skills: f.skills }));
  }

  const skills = decodeSkills(sp.skills);
  const role = sp.role || null;
  let seekers: SeekerCard[] = [];
  if (job.status === "active") {
    const { data } = await supabase.rpc("company_candidates", { p_job: id, p_skills: skills, p_role: role, p_limit: 30 });
    seekers = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, id: r.seeker_id as string }) as SeekerCard);
  }

  return (
    <div className="space-y-6">
      <CompanyNav />
      <h1 className="text-2xl font-bold">{job.title}</h1>

      {job.status === "awaiting_payment" && (
        <div className="card space-y-2">
          <p className="font-semibold">Pay $40 to publish this job</p>
          <p className="text-sm text-muted">
            Online payment is coming soon. For now, our team confirms your payment and makes the job live. Contact
            us to pay by bank transfer, GCash or Maya.
          </p>
        </div>
      )}

      {job.status === "active" && (
        <>
          <form action={search} className="space-y-2">
            <input
              name="q"
              defaultValue={sp.q}
              className="w-full rounded-2xl border border-line bg-card px-5 py-4 text-lg outline-none focus:border-brand"
              placeholder="Who are you looking for? e.g. programmer with 5 years in management and PHP"
            />
            <div className="flex flex-wrap items-center gap-2">
              {role && <Link className="chip" href={href(id, { q: sp.q, role: null, skills })}>Role: {role} ×</Link>}
              {skills.map((s) => (
                <Link key={s.skill} className="chip capitalize" href={href(id, { q: sp.q, role, skills: skills.filter((k) => k.skill !== s.skill) })}>
                  {s.skill}{s.min_years ? ` ${s.min_years}+ yrs` : ""} ×
                </Link>
              ))}
              <SubmitButton className="btn-ghost !py-1" pending="Searching…">Search</SubmitButton>
            </div>
          </form>
          <CompanyDeck key={`${role}-${sp.skills}`} jobId={id} seekers={seekers} />
        </>
      )}
    </div>
  );
}
