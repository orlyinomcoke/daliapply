"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { applyFix, JOB_COUNTRIES, parseSkillLines, skillsToText, type Check, type JobDraft } from "@/lib/jobcheck";
import { checkJob, saveJob } from "../actions/job";

const countryName = (() => {
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
  return (c: string) => dn?.of(c) ?? c;
})();
const php = (n: number) => `PHP ${n.toLocaleString("en-PH")}`;

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap gap-1.5 text-xs font-bold">
      {["Job details", "Check", "Payment"].map((l, i) => (
        <li key={l} aria-current={step === i + 1 ? "step" : undefined}
          className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-brand text-card" : "bg-brand-soft text-muted"}`}>{i + 1}. {l}</li>
      ))}
    </ol>
  );
}

export function JobRecap({ job }: { job: { title: string; country: string | null; remote: boolean; relocation_offered: boolean; salary_min: number | null; salary_max: number | null; languages: string[]; description: string; skills: { label: string; min: number }[] } }) {
  return (
    <table className="recap w-full text-[15px]">
      <tbody>
        <tr><th scope="row">Job title</th><td>{job.title}</td></tr>
        <tr><th scope="row">Location</th><td>{job.country ? countryName(job.country) : "—"}{job.remote ? " · Remote" : ""}{job.relocation_offered ? " · Relocation offered" : ""}</td></tr>
        <tr><th scope="row">Monthly salary</th><td>{php(job.salary_min ?? 0)} to {php(job.salary_max ?? 0)}</td></tr>
        <tr><th scope="row">Required skills</th><td className="flex flex-wrap gap-1">{job.skills.map((k) => <span key={k.label} className="chip">{k.label} {k.min}+ yrs</span>)}</td></tr>
        <tr><th scope="row">Languages</th><td>{job.languages.join(", ") || "Any"}</td></tr>
        <tr><th scope="row">Description</th><td className="whitespace-pre-wrap">{job.description}</td></tr>
      </tbody>
    </table>
  );
}

const EMPTY: JobDraft = { title: "", description: "", skillsText: "", salaryMin: "", salaryMax: "", country: "PH", languages: "", remote: false, relocation: false };

/** Steps 1 and 2 of posting a job: details, then a check for likely mistakes. */
export function JobForm({ initial, jobId }: { initial?: JobDraft; jobId?: string }) {
  const [d, setD] = useState<JobDraft>(initial ?? EMPTY);
  const [step, setStep] = useState<"form" | "review">("form");
  const [errors, setErrors] = useState<[keyof JobDraft, string][]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const set = <K extends keyof JobDraft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const bad = (k: keyof JobDraft) => errors.some(([f]) => f === k) || undefined;

  const review = (draft: JobDraft) => start(async () => {
    const r = await checkJob(draft);
    setErrors(r.errors); setChecks(r.checks);
    if (!r.errors.length) { setStep("review"); window.scrollTo(0, 0); }
  });

  if (step === "review") {
    const skills = parseSkillLines(d.skillsText).skills;
    return (
      <div className="card mx-auto max-w-3xl space-y-4">
        <Stepper step={2} />
        <h1 className="text-2xl font-bold">Check your job post</h1>
        <p className="text-sm text-muted">This is what seekers will match against. Fix anything that&apos;s wrong before you pay.</p>
        {checks.length ? checks.map((c) => (
          <div key={c.text} className="notice">
            <span>{c.text}</span>
            {c.fix && <button className="btn-primary !px-3 !py-1.5" disabled={busy} onClick={() => {
              const next = { ...d, skillsText: skillsToText(applyFix(skills, c.fix!)) }; setD(next); review(next);
            }}>{c.fixText}</button>}
          </div>
        )) : <div className="rounded-2xl bg-yes-soft px-4 py-3 text-sm text-yes">Everything looks consistent. Your description and required skills agree.</div>}
        <JobRecap job={{ title: d.title, country: d.country, remote: d.remote, relocation_offered: d.relocation, salary_min: Number(d.salaryMin), salary_max: Number(d.salaryMax),
          languages: d.languages.split(",").map((x) => x.trim()).filter(Boolean), description: d.description, skills }} />
        {saveError && <p className="text-sm font-semibold text-no">{saveError}</p>}
        <div className="flex flex-wrap justify-between gap-3">
          <button className="btn-ghost" onClick={() => setStep("form")}>← Back to edit</button>
          <button className="btn-primary" disabled={busy} onClick={() => start(async () => setSaveError(await saveJob(d, jobId)))}>
            {busy ? "Saving…" : jobId ? "Save changes" : "Looks good, continue to payment"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); review(d); }} className="card mx-auto max-w-2xl space-y-4">
      <Stepper step={1} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{jobId ? "Edit job post" : "Post a job"}</h1>
        <Link className="btn-ghost !py-1.5" href={jobId ? `/company/jobs/${jobId}` : "/company"}>Cancel</Link>
      </div>
      <p className="text-sm text-muted">₱1,998 per post, paid by GCash or InstaPay. Fields marked * are required.</p>
      <label className="block"><span className="label">Job title *</span>
        <input className="input" value={d.title} onChange={set("title")} aria-invalid={bad("title")} placeholder="Senior PHP Developer" /></label>
      <label className="block"><span className="label">Description and key requirements *</span>
        <textarea className="input" rows={5} value={d.description} onChange={set("description")} aria-invalid={bad("description")}
          placeholder="What the person will do, and what they need. For example: Lead a team of 4. 5+ years of PHP and 2 years managing people." /></label>
      <label className="block"><span className="label">Required skills and minimum years, one per line *</span>
        <textarea className="input font-mono text-sm" rows={4} value={d.skillsText} onChange={set("skillsText")} aria-invalid={bad("skillsText")} placeholder={"PHP: 5\nManagement: 2"} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Monthly salary from (PHP) *</span>
          <input className="input" type="number" min={1} value={d.salaryMin} onChange={set("salaryMin")} aria-invalid={bad("salaryMin")} /></label>
        <label className="block"><span className="label">to (PHP) *</span>
          <input className="input" type="number" min={1} value={d.salaryMax} onChange={set("salaryMax")} aria-invalid={bad("salaryMax")} /></label>
        <label className="block"><span className="label">Country *</span>
          <select className="input" value={d.country} onChange={set("country")} aria-invalid={bad("country")}>
            {JOB_COUNTRIES.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
          </select></label>
        <label className="block"><span className="label">Required languages (optional, comma separated)</span>
          <input className="input" value={d.languages} onChange={set("languages")} placeholder="english" /></label>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.remote} onChange={set("remote")} /> Remote</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.relocation} onChange={set("relocation")} /> Relocation offered</label>
      </div>
      {errors.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm font-semibold text-no">{errors.map(([, m]) => <li key={m}>{m}</li>)}</ul>}
      <button className="btn-primary" disabled={busy}>{busy ? "Checking…" : "Next: check your post"}</button>
    </form>
  );
}
