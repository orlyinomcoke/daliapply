import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { notifySupport, SALES_EMAIL, SUPPORT_EMAIL } from "@/lib/email";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Support · Daliapply" };
const TOPICS = ["My account or login", "Payments and job posts", "Matching and jobs", "Privacy and my data", "Something else"];

async function send(formData: FormData) {
  "use server";
  const { supabase, user } = await getSession();
  const email = String(formData.get("email") ?? "").trim();
  const topic = TOPICS.includes(String(formData.get("topic"))) ? String(formData.get("topic")) : "Something else";
  const body = String(formData.get("body") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || body.length < 10) redirect("/support?error=1");
  const { error } = await supabase.from("support_messages").insert({ email, topic, body, user_id: user?.id ?? null });
  if (error) redirect("/support?error=2");
  await notifySupport({ email, topic, body });
  redirect("/support?sent=1");
}

export default async function Support({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const { user } = await getSession();
  if (sp.sent) {
    return (
      <div className="card mx-auto max-w-lg space-y-3 text-center">
        <h1 className="text-2xl font-bold">Message sent</h1>
        <p className="text-muted">Thanks. We&apos;ll reply by email within one business day.</p>
        <Link className="btn-ghost" href="/">Back to home</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-4xl items-start gap-10 md:grid-cols-[1fr_420px]">
      <aside>
        <h1 className="mb-2 text-3xl font-extrabold">We&apos;re here to help.</h1>
        <p className="mb-6 text-muted">Send us a message and we&apos;ll reply by email within one business day.</p>
        <ul className="grid gap-4">
          {[["?", "Quick answers", <>Most questions are answered in the <Link className="underline" href="/faq">FAQ</Link>.</>],
            ["₱", "Payments and job posts", <>Email {SALES_EMAIL()}.</>],
            ["!", "Report a scam or abuse", <>Use &quot;Report&quot; on the job card or in the chat, so we see exactly which one.</>]].map(([n, t, d]) => (
            <li key={String(t)} className="grid grid-cols-[34px_1fr] gap-3">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-xl bg-accent font-extrabold text-accent-ink">{n}</span>
              <div><b className="block text-[17px]">{t}</b><span className="text-muted">{d}</span></div>
            </li>
          ))}
        </ul>
      </aside>
      <form action={send} className="card space-y-4">
        <h2 className="text-2xl font-bold">Contact support</h2>
        <label className="block"><span className="label">Your email *</span><input name="email" type="email" required className="input" defaultValue={user?.email ?? ""} /></label>
        <label className="block"><span className="label">Topic *</span>
          <select name="topic" className="input">{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="block"><span className="label">Message *</span><textarea name="body" rows={6} minLength={10} required className="input" /></label>
        {sp.error && <p className="text-sm font-semibold text-no">Add your email and a message of at least 10 characters.</p>}
        <SubmitButton>Send message</SubmitButton>
        <p className="text-sm text-muted">Or email us at <b>{SUPPORT_EMAIL()}</b>.</p>
      </form>
    </div>
  );
}
