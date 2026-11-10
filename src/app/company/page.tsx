import Link from "next/link";
import { requireRole } from "@/lib/session";
import { CompanyNav } from "@/components/Nav";

const STATUS: Record<string, string> = {
  draft: "Draft",
  awaiting_payment: "Awaiting payment (₱1,998)",
  active: "Live",
  closed: "Closed",
};

export default async function CompanyHome() {
  const { supabase, user } = await requireRole("company");
  const [{ data: company }, { data: jobs }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", user.id).single(),
    supabase.from("jobs").select("id,title,status,created_at").eq("company_id", user.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <CompanyNav />
      <h1 className="text-2xl font-bold">{company?.name}</h1>
      {!company?.domain_verified && (
        <div className="card !bg-brand-soft text-sm">
          We couldn&apos;t verify <b>{company?.domain}</b> as a company domain. Sign in with your work email (not Gmail,
          Yahoo or similar) to post jobs and search.
        </div>
      )}
      <div className="grid gap-4">
        {(jobs ?? []).map((j) => (
          <Link key={j.id} href={`/company/jobs/${j.id}`} className="card flex items-center justify-between hover:border-brand">
            <div>
              <p className="font-semibold">{j.title}</p>
              <p className="text-sm text-muted">{STATUS[j.status]}</p>
            </div>
            <span aria-hidden>→</span>
          </Link>
        ))}
        {!jobs?.length && company?.domain_verified && (
          <div className="card text-center">
            <p className="mb-3 text-muted">No jobs yet.</p>
            <Link href="/company/jobs/new" className="btn-primary">Post your first job</Link>
          </div>
        )}
      </div>
    </div>
  );
}
