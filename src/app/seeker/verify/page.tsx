import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { SubmitButton } from "@/components/SubmitButton";
import { SeekerNav } from "@/components/Nav";

const ID_TYPES = [
  ["philsys", "PhilSys National ID"],
  ["passport", "Passport"],
  ["drivers_license", "Driver's license"],
  ["umid", "UMID"],
  ["prc", "PRC ID"],
  ["postal", "Postal ID"],
] as const;

async function submitId(formData: FormData) {
  "use server";
  const { supabase, user } = await requireRole("seeker");
  const file = formData.get("id_photo") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a photo of your ID");
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) throw new Error("Use a JPG, PNG or PDF");
  if (file.size > 8 * 1024 * 1024) throw new Error("File must be under 8 MB");
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${user.id}/id-${Date.now()}.${ext}`;
  const up = await supabase.storage.from("ids").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from("seekers")
    .update({ id_document_path: path, id_document_type: String(formData.get("id_type")), verification_status: "pending" })
    .eq("id", user.id);
  if (error) throw error;
  redirect("/seeker/verify");
}

export default async function Verify() {
  const { supabase, user } = await requireRole("seeker");
  const { data: s } = await supabase.from("seekers").select("verification_status, verification_note").eq("id", user.id).single();
  const status = s?.verification_status ?? "unverified";

  return (
    <div className="space-y-6">
      <SeekerNav />
      <div className="card mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Verify your identity</h1>
        <ul className="space-y-1 text-sm">
          <li>✓ Email confirmed with a one-time code</li>
          <li>{status === "verified" ? "✓" : "○"} Valid government ID {status === "pending" && "(under review)"}</li>
        </ul>
        {status === "verified" && <p className="text-sm">You&apos;re verified. You earn PHP 20 each time a company swipes right on you.</p>}
        {status === "pending" && <p className="text-sm text-muted">We review IDs by hand, usually within a day.</p>}
        {status === "rejected" && <p className="text-sm text-brand">We couldn&apos;t verify that ID{s?.verification_note ? `: ${s.verification_note}` : "."} Please try again.</p>}
        {(status === "unverified" || status === "rejected") && (
          <form action={submitId} className="space-y-4">
            <label className="block">
              <span className="label">ID type</span>
              <select name="id_type" className="input">
                {ID_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Clear photo of the front of your ID</span>
              <input type="file" name="id_photo" accept="image/*,application/pdf" required className="text-sm" />
            </label>
            <p className="text-xs text-muted">Your ID is stored privately and only seen by our review team. It is never shown to companies.</p>
            <SubmitButton pending="Uploading…">Submit for review</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
