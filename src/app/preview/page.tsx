import Link from "next/link";
import { parseSearch, type SearchFilters } from "@/lib/ai";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Preview({ searchParams }: { searchParams: Promise<{ as?: string; q?: string }> }) {
  const sp = await searchParams;
  const side = sp.as === "company" ? "company" : "seeker";
  const q = (sp.q ?? "").slice(0, 300);
  const supabase = await supabaseServer();

  let filters: SearchFilters | null = null;
  try { filters = q ? await parseSearch(q) : null; } catch { filters = null; }
  const skills = (filters?.skills ?? []).map((s) => s.skill.toLowerCase());

  let cards: { title: string; sub: string; chips: string[] }[] = [];
  if (side === "company") {
    const { data } = await supabase.rpc("preview_candidates", { p_skills: skills, p_role: filters?.role ?? null });
    cards = (data ?? []).map((c: { headline: string; total_years: number; skills: { skill: string; years: number }[] }) => ({
      title: "A**** B****",
      sub: `${c.headline ?? "Candidate"} · ${Number(c.total_years)} yrs`,
      chips: c.skills.map((k) => `${k.skill} ${Number(k.years)} yrs`),
    }));
  } else {
    let query = supabase.from("jobs").select("title, remote, country, companies(name), job_skills!inner(skill)").eq("status", "active").limit(3);
    if (skills.length) query = query.in("job_skills.skill", skills);
    else if (filters?.role) query = query.ilike("title", `%${filters.role}%`);
    const { data } = await query;
    cards = (data ?? []).map((j) => ({
      title: j.title,
      sub: `${(j.companies as unknown as { name: string }).name} · ${j.remote ? "Remote" : j.country ?? ""}`,
      chips: [],
    }));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-muted">Results for “{q}”</p>
      {filters && (
        <div className="flex flex-wrap gap-2">
          {filters.role && <span className="chip">Role: {filters.role}</span>}
          {filters.skills.map((s) => <span key={s.skill} className="chip capitalize">{s.skill}{s.min_years ? ` ${s.min_years}+ yrs` : ""}</span>)}
        </div>
      )}
      <div className="grid gap-3">
        {cards.map((c, i) => (
          <div key={i} className="card">
            <p className="font-bold">{c.title}</p>
            <p className="text-sm text-muted">{c.sub}</p>
            {c.chips.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{c.chips.map((x) => <span key={x} className="chip">{x}</span>)}</div>}
          </div>
        ))}
        {!cards.length && <p className="card text-center text-muted">Nothing yet for that search, but new {side === "company" ? "seekers" : "jobs"} join every day.</p>}
      </div>
      <div className="card text-center">
        <p className="mb-3">{side === "company" ? "Sign up with your work email to swipe on candidates." : "Upload your resume once to start swiping."}</p>
        <Link className="btn-primary" href={`/signin?as=${side}`}>Sign up free</Link>
      </div>
    </div>
  );
}
