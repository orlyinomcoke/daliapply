import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { parseSearch } from "@/lib/ai";
import { CompanyNav } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { CompanyDeck, type SeekerCard } from "./CompanyDeck";
import { FilledButton, PaymentForm } from "./PaymentForm";
import { JobRecap, Stepper } from "../JobForm";
import { SALES_EMAIL } from "@/lib/email";

const DAY = 86_400_000;
const fmt = (d: string | Date) => new Date(d).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

type Params = { id: string };
type Search = { q?: string; role?: string; skills?: string; renew?: string };

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
  const { supabase, user } = await requireRole("company");
  const { data: job } = await supabase.from("jobs").select("*, job_skills(label, skill, min_years), companies(name)").eq("id", id).maybeSingle();
  if (!job) notFound();
  const skillList = (job.job_skills as { label: string | null; skill: string; min_years: number }[]).map((k) => ({ label: k.label ?? k.skill, min: Number(k.min_years) }));
  const companyName = (job.companies as unknown as { name: string }).name;
  const expired = job.status === "active" && job.live_until && new Date(job.live_until).getTime() < Date.now();
  const live = job.status === "active" && !expired && !job.filled_at && !job.taken_down_at;
  const paying = !job.taken_down_at && (job.status !== "active" || (expired && sp.renew === "1") || job.pay_status === "submitted");

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
  if (live) {
    const { data } = await supabase.rpc("company_candidates", { p_job: id, p_skills: skills, p_role: role, p_limit: 30 });
    seekers = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, id: r.seeker_id as string }) as SeekerCard);
  }

  const { data: lastPayment } = await supabase.from("payments").select("status, review_note, created_at, body")
    .eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const salary = (n: number | null) => `PHP ${(n ?? 0).toLocaleString("en-PH")}`;
  const template = `Hi Daliapply Sales,

We've paid for a job post${expired ? " renewal" : ""}. Please check the payment and publish the job.

Company: ${companyName}
Contact: ${user.email ?? ""}
Amount: ₱1,998
GCash / InstaPay reference no.: {REF}

Job title: ${job.title}
Location: ${job.remote ? "Remote, " : ""}${job.country ?? ""}${job.relocation_offered ? " (relocation offered)" : ""}
Salary: ${salary(job.salary_min)} to ${salary(job.salary_max)} a month
Languages: ${(job.languages ?? []).join(", ") || "Any"}
Skills: ${skillList.map((k) => `${k.label} ${k.min}+ yrs`).join(", ")}

Job description:
${job.description}

Thank you,
${companyName}`;

  return (
    <div className="space-y-6">
      <CompanyNav />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        {live && <div className="flex items-center gap-3 text-sm text-muted">
          <span>Live{job.live_until ? ` · ${Math.max(1, Math.ceil((new Date(job.live_until).getTime() - Date.now()) / DAY))} days left` : ""}</span>
          <FilledButton jobId={id} filled={false} />
        </div>}
      </div>

      {job.taken_down_at && (
        <div className="card max-w-2xl space-y-2">
          <h2 className="text-lg font-bold">Taken down</h2>
          <p className="text-muted">We took this job down after a report{job.takedown_note ? `: ${job.takedown_note}` : "."} Contact support if you think this is a mistake.</p>
          <Link className="btn-ghost" href="/support">Contact support</Link>
        </div>
      )}

      {!job.taken_down_at && job.status === "active" && !paying && (job.filled_at || expired) && (
        <div className="card max-w-2xl space-y-3">
          <h2 className="text-lg font-bold">{job.filled_at && !expired ? "Position filled" : "Expired"}</h2>
          <p className="text-muted">{job.filled_at && !expired ? "You marked this position as filled, so seekers no longer see it." : `This post expired on ${fmt(job.live_until)}. Seekers no longer see it.`}</p>
          <div className="flex flex-wrap gap-2">
            {expired ? <Link className="btn-primary" href={`/company/jobs/${id}?renew=1`}>Renew for 30 days · ₱1,998</Link> : <FilledButton jobId={id} filled />}
          </div>
          <p className="text-sm text-muted">Your matches and chats stay in Matches.</p>
        </div>
      )}

      {paying && (
        <>
          {job.pay_status !== "submitted" && <Stepper step={3} />}
          <details className="card" open={job.pay_status !== "submitted"}>
            <summary className="cursor-pointer"><b>Your job post</b> <span className="text-sm text-muted">({expired ? "renewing for another 30 days" : "what you'll pay for"})</span></summary>
            <div className="mt-3"><JobRecap job={{ ...job, skills: skillList }} /></div>
            {job.pay_status !== "submitted" && job.status !== "active" && <Link className="btn-ghost mt-3 !py-1.5" href={`/company/jobs/${id}/edit`}>← Edit job details</Link>}
          </details>
          {job.pay_status === "submitted" ? (
            <div className="card max-w-2xl space-y-2">
              <h2 className="text-lg font-bold">Payment sent. We&apos;re checking it.</h2>
              <p className="text-muted">Your message and receipt went to {SALES_EMAIL()}{lastPayment ? ` on ${fmt(lastPayment.created_at)}` : ""}. We&apos;ll email you once the job is live, usually within one business day. The post is locked until then.</p>
            </div>
          ) : (
            <div className="grid items-start gap-4 md:grid-cols-[1fr_1.3fr]">
              <div className="card space-y-3">
                <h2 className="text-lg font-bold">1. Pay ₱1,998 by GCash or InstaPay</h2>
                {job.pay_status === "rejected" && <div className="notice !bg-no-soft">We couldn&apos;t confirm your last payment{lastPayment?.review_note ? `: ${lastPayment.review_note}` : "."} Please check and send again.</div>}
                <p className="text-sm text-muted">Scan this code with GCash or any banking app that supports InstaPay. The amount is already filled in.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/gcash-qr.jpg" alt="GCash QR code for Daliapply, ₱1,998" className="mx-auto w-full max-w-72 rounded-2xl" />
                <p className="text-sm text-muted">On your phone? Take a screenshot and open it from your GCash app with &quot;Upload QR&quot;.</p>
              </div>
              <PaymentForm jobId={id} userId={user.id} salesEmail={SALES_EMAIL()} subject={`Job post payment: ${job.title} (${companyName})`} template={template} />
            </div>
          )}
        </>
      )}

      {live && (
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
