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

export default async function Admin() {
  const { supabase } = await requireRole("admin");
  const [{ data: pending }, { data: jobs }] = await Promise.all([
    supabase.from("seekers").select("id, first_name, last_name, id_document_type, id_document_path, updated_at").eq("verification_status", "pending").order("updated_at"),
    supabase.from("jobs").select("id, title, created_at, companies(name, domain)").eq("status", "awaiting_payment").order("created_at"),
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
        <h2 className="mb-4 text-xl font-bold">Jobs awaiting payment (₱1,998)</h2>
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

    </div>
  );
}
