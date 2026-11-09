import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CompanyNav, SeekerNav } from "@/components/Nav";

export default async function Matches() {
  const { supabase, user, role } = await getSession();
  if (!user || !role) redirect("/signin");
  const { data: matches } = await supabase
    .from("matches")
    .select("id, created_at, job_id, jobs(title, companies(name))")
    .order("created_at", { ascending: false });

  // Company side: names unlock only through matched_profile (match parties only).
  const rows = await Promise.all(
    (matches ?? []).map(async (m) => {
      const job = m.jobs as unknown as { title: string; companies: { name: string } };
      if (role !== "company") return { id: m.id, title: job.companies.name, sub: job.title };
      const { data } = await supabase.rpc("matched_profile", { p_match: m.id }).single<{ first_name: string; last_name: string; headline: string }>();
      return { id: m.id, title: `${data?.first_name} ${data?.last_name}`, sub: `${data?.headline ?? ""} · for ${job.title}` };
    }),
  );

  return (
    <div className="space-y-6">
      {role === "company" ? <CompanyNav /> : <SeekerNav />}
      <h1 className="text-2xl font-bold">Matches</h1>
      <div className="grid gap-3">
        {rows.map((r) => (
          <Link key={r.id} href={`/matches/${r.id}`} className="card flex items-center justify-between hover:border-brand">
            <div><p className="font-semibold">{r.title}</p><p className="text-sm text-muted">{r.sub}</p></div>
            <span aria-hidden>→</span>
          </Link>
        ))}
        {!rows.length && <p className="card text-center text-muted">No matches yet. A match happens when you both swipe right.</p>}
      </div>
    </div>
  );
}
