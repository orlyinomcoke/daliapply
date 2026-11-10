import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { supabaseService } from "@/lib/supabase/server";
import { notifyPaymentReviewed, notifyTakedown } from "@/lib/email";

const when = (d: string) => new Date(d).toLocaleString("en-PH", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Approve or reject an ID, then delete the photo: we keep only the result. */
async function reviewId(formData: FormData) {
  "use server";
  const { supabase, user } = await requireRole("admin");
  const approve = formData.get("decision") === "approve";
  const seekerId = String(formData.get("seeker_id"));
  const { data: s } = await supabase.from("seekers").select("id_document_path").eq("id", seekerId).single();
  const { error } = await supabase
    .from("seekers")
    .update({
      verification_status: approve ? "verified" : "rejected",
      verification_note: approve ? null : String(formData.get("note") ?? "") || null,
      verified_at: approve ? new Date().toISOString() : null,
      verified_by: user.id,
      id_document_path: null,
    })
    .eq("id", seekerId);
  if (error) throw error;
  if (s?.id_document_path) await supabaseService().storage.from("ids").remove([s.id_document_path]);
  revalidatePath("/admin");
}

async function reviewPayment(formData: FormData) {
  "use server";
  const { supabase } = await requireRole("admin");
  const id = String(formData.get("payment_id"));
  const { error } = await supabase.rpc("review_payment", {
    p_payment: id, p_approve: formData.get("decision") === "approve", p_note: String(formData.get("note") ?? "") || null,
  });
  if (error) throw error;
  await notifyPaymentReviewed(id);
  revalidatePath("/admin");
}

async function reviewReport(formData: FormData) {
  "use server";
  const { supabase } = await requireRole("admin");
  const id = String(formData.get("report_id"));
  if (formData.get("decision") === "takedown") {
    const note = String(formData.get("note") ?? "");
    const { data: r } = await supabase.from("reports").select("job_id").eq("id", id).single();
    const { error } = await supabase.rpc("take_down_job", { p_report: id, p_note: note });
    if (error) throw error;
    if (r?.job_id) await notifyTakedown(r.job_id, note || null);
  } else {
    await supabase.from("reports").update({ status: "dismissed", reviewed_at: new Date().toISOString() }).eq("id", id);
  }
  revalidatePath("/admin");
}

async function closeSupport(formData: FormData) {
  "use server";
  const { supabase } = await requireRole("admin");
  await supabase.from("support_messages").update({ status: "closed" }).eq("id", String(formData.get("id")));
  revalidatePath("/admin");
}

export default async function Admin() {
  const { supabase } = await requireRole("admin");
  const [{ data: pending }, { data: payments }, { data: reports }, { data: support }] = await Promise.all([
    supabase.from("seekers").select("id, first_name, last_name, id_document_type, id_document_path, updated_at").eq("verification_status", "pending").order("updated_at"),
    supabase.from("payments").select("*").eq("status", "submitted").order("created_at"),
    supabase.from("reports").select("*").eq("status", "open").order("created_at"),
    supabase.from("support_messages").select("*").eq("status", "open").order("created_at"),
  ]);
  const service = supabaseService();
  const signed = async (bucket: string, path: string | null) => (path ? (await service.storage.from(bucket).createSignedUrl(path, 600)).data?.signedUrl ?? null : null);
  const ids = await Promise.all((pending ?? []).map(async (s) => ({ ...s, url: await signed("ids", s.id_document_path) })));
  const pays = await Promise.all((payments ?? []).map(async (p) => ({ ...p, url: await signed("receipts", p.proof_path) })));

  return (
    <div className="space-y-12">
      <h1 className="text-3xl font-extrabold">Admin</h1>

      <section>
        <h2 className="mb-4 text-xl font-bold">Sales inbox: payments to check ({pays.length})</h2>
        <div className="grid gap-4">
          {pays.map((p) => (
            <div key={p.id} className="card space-y-3">
              <div>
                <b>{p.subject}</b>
                <p className="text-sm text-muted">{when(p.created_at)} · Ref {p.reference} · ₱{Number(p.amount_php).toLocaleString("en-PH")}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-xs">{p.body}</pre>
                {p.url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <a href={p.url} target="_blank"><img src={p.url} alt="Payment receipt" className="max-h-80 rounded-xl" /></a>
                  : <p className="text-sm text-muted">No receipt attached.</p>}
              </div>
              <p className="text-xs text-muted">Check the reference number and amount in your GCash history before publishing.</p>
              <form action={reviewPayment} className="flex flex-wrap gap-2">
                <input type="hidden" name="payment_id" value={p.id} />
                <button name="decision" value="approve" className="btn-primary">Payment received, publish job</button>
                <input name="note" placeholder="Reason if rejecting" className="input !w-auto flex-1" />
                <button name="decision" value="reject" className="btn-ghost">Reject</button>
              </form>
            </div>
          ))}
          {!pays.length && <p className="text-muted">No payments to check.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Reports ({reports?.length ?? 0})</h2>
        <div className="grid gap-4">
          {(reports ?? []).map((r) => (
            <div key={r.id} className="card space-y-2">
              <p><b>{r.reason}</b> <span className="text-sm text-muted">· {r.target_label ?? "unknown"} · {when(r.created_at)}</span></p>
              {r.note && <p className="text-sm">{r.note}</p>}
              <form action={reviewReport} className="flex flex-wrap gap-2">
                <input type="hidden" name="report_id" value={r.id} />
                {r.job_id && <button name="decision" value="takedown" className="btn-primary">Take the job down</button>}
                <input name="note" placeholder="Note to the company (if taking down)" className="input !w-auto flex-1" />
                <button name="decision" value="dismiss" className="btn-ghost">Dismiss</button>
              </form>
            </div>
          ))}
          {!reports?.length && <p className="text-muted">No open reports.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Support messages ({support?.length ?? 0})</h2>
        <div className="grid gap-4">
          {(support ?? []).map((t) => (
            <div key={t.id} className="card space-y-2">
              <p><b>{t.topic}</b> <span className="text-sm text-muted">· {t.email} · {when(t.created_at)}</span></p>
              <p className="whitespace-pre-wrap text-sm">{t.body}</p>
              <form action={closeSupport} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={t.id} />
                <a className="btn-primary" href={`mailto:${t.email}?subject=${encodeURIComponent(`Re: ${t.topic}`)}`}>Reply by email</a>
                <button className="btn-ghost">Mark done</button>
              </form>
            </div>
          ))}
          {!support?.length && <p className="text-muted">No open messages.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">ID review queue ({ids.length})</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {ids.map((s) => (
            <div key={s.id} className="card space-y-3">
              <p className="font-semibold">{s.first_name} {s.last_name} <span className="text-sm text-muted">· {s.id_document_type}</span></p>
              {s.url && (s.id_document_path?.endsWith(".pdf")
                ? <a className="underline" href={s.url} target="_blank">Open ID (PDF)</a>
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={s.url} alt="Submitted ID" className="max-h-64 rounded-xl" />)}
              <p className="text-xs text-muted">Check the name matches the resume and the ID looks valid and unexpired. The photo is deleted as soon as you decide.</p>
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
    </div>
  );
}
