import { requireRole } from "@/lib/session";
import { skillLines } from "@/lib/skills";
import { saveProfile, uploadResume } from "../actions/profile";
import { SubmitButton } from "@/components/SubmitButton";

export default async function SeekerProfile() {
  const { supabase, user } = await requireRole("seeker");
  const { data: s } = await supabase.from("seekers").select("*").eq("id", user.id).single();
  const { data: skills } = await supabase.from("seeker_skills").select("skill,label,years").eq("seeker_id", user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="card">
        <h1 className="text-2xl font-bold">Your resume</h1>
        <p className="mt-1 text-sm text-muted">
          Upload once. We read your skills, years per skill, salary range, country and languages. Your name, phone and
          email are never shown to companies before a match.
        </p>
        <form action={uploadResume} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="file" name="resume" accept="application/pdf" required className="text-sm" />
          <SubmitButton pending="Reading your resume…">{s?.resume_path ? "Replace resume" : "Upload resume"}</SubmitButton>
        </form>
      </section>

      {s?.resume_path && (
        <form action={saveProfile} className="card space-y-4">
          <div>
            <h2 className="text-xl font-bold">Check what we found</h2>
            <p className="text-sm text-muted">Fix anything we got wrong, then confirm. You only do this once.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="first_name" label="First name" value={s.first_name} />
            <Field name="last_name" label="Last name" value={s.last_name} />
            <Field name="headline" label="Main role" value={s.headline} />
            <Field name="total_years" label="Total years of experience" value={s.total_years} type="number" />
            <Field name="salary_min" label="Expected monthly salary, from (PHP)" value={s.salary_min} />
            <Field name="salary_max" label="to (PHP)" value={s.salary_max} />
            <Field name="country" label="Country (2 letters, e.g. PH)" value={s.country} />
            <Field name="languages" label="Languages (comma separated)" value={(s.languages ?? []).join(", ")} />
            <Field name="availability" label="Availability (e.g. 2 weeks notice)" value={s.availability} />
          </div>
          <label className="block">
            <span className="label">Skills and years, one per line</span>
            <textarea name="skills" rows={6} className="input font-mono text-sm" defaultValue={skillLines(skills ?? [])} />
          </label>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="open_to_remote" defaultChecked={s.open_to_remote} /> Open to remote</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="open_to_relocate" defaultChecked={s.open_to_relocate} /> Open to relocating</label>
          </div>
          <SubmitButton>Confirm and start swiping</SubmitButton>
        </form>
      )}
    </div>
  );
}

function Field({ name, label, value, type = "text" }: { name: string; label: string; value: unknown; type?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} type={type} step="0.5" className="input" defaultValue={value == null ? "" : String(value)} />
    </label>
  );
}
