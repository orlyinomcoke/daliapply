import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { supabaseService } from "@/lib/supabase/server";
import { CompanyNav, SeekerNav } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { notifyMessage } from "@/lib/email";
import { ReportButton } from "@/components/AccountActions";

type Profile = {
  first_name: string; last_name: string; headline: string; salary_min: number | null; salary_max: number | null;
  salary_currency: string; resume_text: string | null; resume_path: string | null; email: string;
};

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, role } = await getSession();
  if (!user || !role) redirect("/signin");

  const { data: match } = await supabase.from("matches").select("id, job_id, seeker_id, jobs(title, company_id, salary_min, salary_max, salary_currency, companies(name))").eq("id", id).maybeSingle();
  if (!match) notFound();
  const job = match.jobs as unknown as { title: string; company_id: string; salary_min: number | null; salary_max: number | null; salary_currency: string; companies: { name: string } };
  const { data: profile } = await supabase.rpc("matched_profile", { p_match: id }).single<Profile>();
  const { data: messages } = await supabase.from("messages").select("id, sender_id, body, created_at").eq("match_id", id).order("created_at");

  // matched_profile already proved this user is a party to the match
  let resumeUrl: string | null = null;
  if (role === "company" && profile?.resume_path) {
    const { data } = await supabaseService().storage.from("resumes").createSignedUrl(profile.resume_path, 600);
    resumeUrl = data?.signedUrl ?? null;
  }

  async function send(formData: FormData) {
    "use server";
    const { supabase, user } = await getSession();
    const body = String(formData.get("body") ?? "").trim();
    if (!user || !body) return;
    const { error } = await supabase.from("messages").insert({ match_id: id, sender_id: user.id, body });
    if (error) throw error;
    await notifyMessage(id, user.id, body);
    revalidatePath(`/matches/${id}`);
  }

  const range = (min: number | null, max: number | null, cur: string) =>
    min || max ? `${cur} ${min?.toLocaleString() ?? "?"} – ${max?.toLocaleString() ?? "?"}` : "Not stated";

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={5} />
      {role === "company" ? <CompanyNav /> : <SeekerNav />}
      <div className="flex justify-end">
        <ReportButton target={role === "company"
          ? { kind: "seeker", seekerId: match.seeker_id, matchId: id, label: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "this person" }
          : { kind: "company", jobId: match.job_id, companyId: job.company_id, matchId: id, label: `${job.companies.name} (${job.title})` }} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <aside className="card space-y-3 text-sm">
          {role === "company" ? (
            <>
              <h1 className="text-xl font-bold">{profile?.first_name} {profile?.last_name}</h1>
              <p>{profile?.headline}</p>
              <p><b>Expected salary:</b> {range(profile?.salary_min ?? null, profile?.salary_max ?? null, profile?.salary_currency ?? "PHP")}</p>
              <p><b>Email:</b> {profile?.email}</p>
              {resumeUrl && <a className="btn-ghost" href={resumeUrl} target="_blank">Download full resume</a>}
              {profile?.resume_text && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-xs">{profile.resume_text}</pre>}
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">{job.companies.name}</h1>
              <p>{job.title}</p>
              <p><b>Salary:</b> {range(job.salary_min, job.salary_max, job.salary_currency)}</p>
            </>
          )}
        </aside>
        <section className="card flex min-h-[28rem] flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto">
            {(messages ?? []).map((m) => (
              <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.sender_id === user.id ? "ml-auto bg-brand text-card" : "bg-background"}`}>
                {m.body}
              </div>
            ))}
            {!messages?.length && <p className="text-center text-sm text-muted">It&apos;s a match! Say hello.</p>}
          </div>
          <form action={send} className="mt-4 flex gap-2">
            <input name="body" required maxLength={4000} className="input" placeholder="Write a message" autoComplete="off" />
            <SubmitButton pending="…">Send</SubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}
