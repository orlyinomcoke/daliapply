"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PERKS } from "@/lib/copy";

function SignIn() {
  const params = useSearchParams();
  const as = params.get("as") === "company" ? "company" : "seeker";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace(`/onboarding?as=${as}`);
    router.refresh();
  }

  const perks = PERKS[as];
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-10 md:grid-cols-[1fr_420px]">
    <aside className="order-2 md:order-1">
      <h2 className="mb-2 text-3xl font-extrabold">{perks.title}</h2>
      <p className="mb-6 text-muted">{perks.lede}</p>
      <ol className="grid gap-4">
        {perks.items.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[34px_1fr] gap-3">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-xl bg-accent font-extrabold text-accent-ink">{i + 1}</span>
            <div><b className="block text-[17px] [font-family:var(--font-display)]">{t}</b><span className="text-muted">{d}</span></div>
          </li>
        ))}
      </ol>
    </aside>
    <div className="card order-1 md:order-2">
      <h1 className="mb-1 text-2xl font-bold">{as === "company" ? "Company sign in" : "Job seeker sign in"}</h1>
      <p className="mb-6 text-sm text-muted">
        {as === "company"
          ? "Use your work email. We check your company's domain before you can post or search."
          : "We'll email you a one-time code. No password needed."}
      </p>
      {!sent ? (
        <form onSubmit={sendCode} className="space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn-primary w-full" disabled={busy}>Send code</button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm">We sent a code to <b>{email}</b>.</p>
          <label className="block">
            <span className="label">Code</span>
            <input className="input tracking-widest" inputMode="numeric" required value={code}
              onChange={(e) => setCode(e.target.value.trim())} />
          </label>
          <button className="btn-primary w-full" disabled={busy}>Verify and continue</button>
          <button type="button" className="text-sm text-muted underline" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="mt-4 text-sm text-no">{error}</p>}
      <p className="mt-6 text-sm text-muted">
        {as === "company" ? <>Looking for work? <a className="underline" href="/signin?as=seeker">Job seeker login</a></> : <>Hiring? <a className="underline" href="/signin?as=company">Company login</a></>}
      </p>
    </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><SignIn /></Suspense>;
}
