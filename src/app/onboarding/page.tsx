import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

async function createAccount(formData: FormData) {
  "use server";
  const { supabase, user, role } = await getSession();
  if (!user) redirect("/signin");
  if (role) redirect(role === "company" ? "/company" : role === "admin" ? "/admin" : "/seeker");
  const as = formData.get("as") === "company" ? "company" : "seeker";
  const { error } = await supabase.from("profiles").insert({ id: user.id, role: as });
  if (error) throw error;
  if (as === "company") {
    const name = String(formData.get("company_name") ?? "").trim();
    // domain and domain_verified are set by the database from the work email
    const { error: e2 } = await supabase.from("companies").insert({ id: user.id, name, domain: "" });
    if (e2) throw e2;
    redirect("/company");
  }
  const { error: e3 } = await supabase.from("seekers").insert({ id: user.id });
  if (e3) throw e3;
  redirect("/seeker/profile");
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { user, role } = await getSession();
  const as = (await searchParams).as === "company" ? "company" : "seeker";
  if (!user) redirect(`/signin?as=${as}`);
  if (role) redirect(role === "company" ? "/company" : role === "admin" ? "/admin" : "/seeker");

  return (
    <form action={createAccount} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">{as === "company" ? "Set up your company" : "Create your seeker account"}</h1>
      <input type="hidden" name="as" value={as} />
      {as === "company" ? (
        <label className="block">
          <span className="label">Company name</span>
          <input name="company_name" className="input" required />
        </label>
      ) : (
        <p className="text-sm text-muted">
          Next you&apos;ll upload your resume once. We read it for you, so you never fill in an application form.
          By continuing you agree that we extract your skills, experience and salary range from your resume.
        </p>
      )}
      <button className="btn-primary w-full">Continue</button>
    </form>
  );
}
