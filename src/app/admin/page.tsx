import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { supabaseService } from "@/lib/supabase/server";

async function reviewId(formData: FormData) {
  "use server";
  const { supabase, user } = await requireRole("admin");
  const approve = formData.get("decision") === "approve";
  const { error } = await supabase
    .from("seekers")
    .update({
      verification_status: approve ? "verified" : "rejected",
      verification_note: approve ? null : String(formData.get("note") ?? "") || null,
      verified_at: approve ? new Date().toISOString() : null,
      verified_by: user.id,
    })
    .eq("id", String(formData.get("seeker_id")));
  if (error) throw error;
  revalidatePath("/admin");
}

async function markJobPaid(formData: FormData) {
  "use server";
  const { supabase } = await requireRole("admin");
  const { error } = await supabase
    .from("jobs")
    .update({ status: "active", paid_at: new Date().toISOString() })
    .eq("id", String(formData.get("job_id")));
  if (error) throw error;
  revalidatePath("/admin");
}

async function settlePayout(formData: FormData) {
  "use server";
  const { supabase } = await requireRole("admin");
  const { error } = await supabase
    .from("payouts")
    .update({ status: formData.get("decision") === "paid" ? "paid" : "rejected", processed_at: new Date().toISOString() })
    .eq("id", String(formData.get("payout_id")));
  if (error) throw error;
  revalidatePath("/admin");
}

export default async function Admin() {
  const { supabase } = await requireRole("admin");
  const [{ data: pending }, { data: jobs }, { data: payouts }] = await Promise.all([
    supabase.from("seekers").select("id, first_name, last_name, id_document_type, id_document_path, updated_at").eq("verification_status", "pending").order("updated_at"),
    supabase.from("jobs").select("id, title, created_at, companies(name, domain)").eq("status", "awaiting_payment").order("created_at"),
    supabase.from("payouts").select("*").eq("status", "requested").order("created_at"),
  ]);
  const service = supabaseService();
  const ids = await Promise.all(
    (pending ?? []).map(async (s) => ({
      ...s,
      url: s.id_document_path ? (await service.storage.from("ids").createSignedUrl(s.id_document_path, 600)).data?.signedUrl : null,
    })),
  );

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-bold">ID review queue ({ids.length})</h1>
        <div className="grid gap-4 md:grid-cols-2">
          {ids.map((s) => (
            <div key={s.id} className="card space-y-3">
              <p className="font-semibold">{s.first_name} {s.last_name} <span className="text-sm text-muted">· {s.id_document_type}</span></p>
              {s.url && (s.id_document_path?.endsWith(".pdf")
                ? <a className="underline" href={s.url} target="_blank">Open ID (PDF)</a>
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={s.url} alt="Submitted ID" className="max-h-64 rounded-xl" />)}
              <p className="text-xs text-muted">Check the name matches the resume and the ID looks valid and unexpired.</p>
              <form action={reviewId} className="flex flex-wrap gap-2">
                <input type="hidden" name="seeker_id" value={s.id} />
                <button name="decision" value="approve" className="btn-primary">Approve</button>
                <input name="note" placeholder="Reason if rejecting" className="input !w-auto flex-1" />
                <button name="decision" value="reject" className="btn-ghost">Reject</button>
              </form>
            </div>
          ))}
          {!ids.length && <p className="text-muted">Nothing to review.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Jobs awaiting payment ($40)</h2>
        <div className="grid gap-3">
          {(jobs ?? []).map((j) => {
            const c = j.companies as unknown as { name: string; domain: string };
            return (
              <form key={j.id} action={markJobPaid} className="card flex items-center justify-between">
                <span>{j.title} · {c.name} ({c.domain})</span>
                <input type="hidden" name="job_id" value={j.id} />
                <button className="btn-primary">Mark paid and publish</button>
              </form>
            );
          })}
          {!jobs?.length && <p className="text-muted">None.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Cash-out requests</h2>
        <div className="grid gap-3">
          {(payouts ?? []).map((p) => (
            <form key={p.id} action={settlePayout} className="card flex flex-wrap items-center justify-between gap-2">
              <span>PHP {p.amount_php} to {p.method === "gcash" ? "GCash" : "Maya"} {p.account_number}</span>
              <input type="hidden" name="payout_id" value={p.id} />
              <span className="flex gap-2">
                <button name="decision" value="paid" className="btn-primary">Mark sent</button>
                <button name="decision" value="rejected" className="btn-ghost">Reject</button>
              </span>
            </form>
          ))}
          {!payouts?.length && <p className="text-muted">None.</p>}
        </div>
      </section>
    </div>
  );
}
