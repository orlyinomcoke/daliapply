import Link from "next/link";
import { requireRole } from "@/lib/session";
import { CompanyNav } from "@/components/Nav";
import { DeleteAccount } from "@/components/AccountActions";

type JobRow = { status: string; pay_status: string; live_until: string | null; filled_at: string | null; taken_down_at: string | null };
function statusOf(j: JobRow) {
  if (j.taken_down_at) return "Taken down after a report";
  if (j.pay_status === "submitted") return "Payment sent, under review";
  if (j.status !== "active") return j.pay_status === "rejected" ? "Payment not confirmed, please send again" : "Waiting for payment (₱1,998)";
  if (j.live_until && new Date(j.live_until).getTime() < Date.now()) return "Expired. Renew to show it again.";
  if (j.filled_at) return "Position filled";
  const left = j.live_until ? Math.max(1, Math.ceil((new Date(j.live_until).getTime() - Date.now()) / 86_400_000)) : null;
  return left ? `Live · ${left} day${left === 1 ? "" : "s"} left` : "Live";
}

export default async function CompanyHome() {
  const { supabase, user } = await requireRole("company");
  const [{ data: company }, { data: jobs }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", user.id).single(),
    supabase.from("jobs").select("id,title,status,pay_status,live_until,filled_at,taken_down_at,created_at").eq("company_id", user.id).order("created_at", { ascending: false }),
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
              <p className="text-sm text-muted">{statusOf(j)}</p>
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
      <DeleteAccount side="company" />
    </div>
  );
}
