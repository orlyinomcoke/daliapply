import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { SubmitButton } from "@/components/SubmitButton";
import { SeekerNav } from "@/components/Nav";

async function cashOut(formData: FormData) {
  "use server";
  const { supabase } = await requireRole("seeker");
  const { error } = await supabase.rpc("request_payout", {
    p_amount: Number(formData.get("amount")),
    p_method: String(formData.get("method")),
    p_account: String(formData.get("account")).trim(),
  });
  if (error) {
    const msg = error.message.includes("BELOW_MINIMUM") ? "The minimum cash-out is PHP 200."
      : error.message.includes("INSUFFICIENT_BALANCE") ? "That's more than your balance."
      : error.message.includes("NOT_VERIFIED") ? "Verify your ID first." : "Could not request the cash-out.";
    throw new Error(msg);
  }
  revalidatePath("/seeker/rewards");
}

export default async function Rewards() {
  const { supabase, user } = await requireRole("seeker");
  const [{ data: bal }, { data: rewards }, { data: payouts }, { data: me }] = await Promise.all([
    supabase.from("seeker_balances").select("balance_php").eq("seeker_id", user.id).maybeSingle(),
    supabase.from("rewards").select("amount_php, created_at, jobs(title, companies(name))").order("created_at", { ascending: false }).limit(50),
    supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("seekers").select("verification_status").eq("id", user.id).single(),
  ]);
  const balance = bal?.balance_php ?? 0;

  return (
    <div className="space-y-6">
      <SeekerNav />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-4">
          <p className="text-sm text-muted">Balance</p>
          <p className="text-4xl font-extrabold">PHP {balance.toLocaleString()}</p>
          <p className="text-sm text-muted">You earn PHP 20 when a company swipes right on you, once per job. Cash out from PHP 200 to GCash or Maya.</p>
          {me?.verification_status === "verified" ? (
            <form action={cashOut} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select name="method" className="input"><option value="gcash">GCash</option><option value="maya">Maya</option></select>
                <input name="amount" type="number" min={200} max={balance} defaultValue={balance} className="input" />
              </div>
              <input name="account" required placeholder="Mobile number, e.g. 0917 123 4567" className="input" />
              <SubmitButton>Cash out</SubmitButton>
            </form>
          ) : (
            <p className="text-sm">Only verified seekers earn rewards. <a className="underline" href="/seeker/verify">Verify your ID</a>.</p>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">History</h2>
          <ul className="space-y-2 text-sm">
            {(payouts ?? []).map((p) => (
              <li key={p.id} className="flex justify-between"><span>Cash-out to {p.method === "gcash" ? "GCash" : "Maya"} ({p.status})</span><span>− PHP {p.amount_php}</span></li>
            ))}
            {(rewards ?? []).map((r, i) => {
              const job = r.jobs as unknown as { title: string; companies: { name: string } } | null;
              return <li key={i} className="flex justify-between"><span>{job?.companies?.name} liked you for {job?.title}</span><span>+ PHP {r.amount_php}</span></li>;
            })}
            {!rewards?.length && !payouts?.length && <li className="text-muted">Nothing yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
