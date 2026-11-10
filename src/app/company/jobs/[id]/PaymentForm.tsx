"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { submitPayment, markFilled } from "../../actions/job";

/** Shrink a receipt photo before upload; screenshots are often several MB. */
async function shrink(file: File, max = 1400): Promise<Blob> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("image"))), "image/jpeg", 0.8));
}

/** The message template holds {REF}, filled in as the reference number is typed. */
export function PaymentForm({ jobId, userId, salesEmail, subject, template }: { jobId: string; userId: string; salesEmail: string; subject: string; template: string }) {
  const [ref, setRef] = useState("");
  const [body, setBody] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const text = body ?? template.replace("{REF}", ref || "(see attached receipt)");

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (ref.trim().length < 3) return setError("Add the GCash or InstaPay reference number.");
        if (!file) return setError("Attach a screenshot of your receipt.");
        start(async () => {
          try {
            const blob = await shrink(file);
            const path = `${userId}/${jobId}-${Date.now()}.jpg`;
            const { error: up } = await supabaseBrowser().storage.from("receipts").upload(path, blob, { contentType: "image/jpeg" });
            if (up) return setError("Couldn't upload your receipt. Please try again.");
            const err = await submitPayment({ jobId, reference: ref, body: text, proofPath: path });
            if (err) return setError(err);
            router.refresh();
          } catch {
            setError("That file isn't an image. Upload a screenshot or photo of the receipt.");
          }
        });
      }}
    >
      <h2 className="text-lg font-bold">2. Send your receipt to our sales team</h2>
      <label className="block"><span className="label">GCash or InstaPay reference number *</span>
        <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 1234 567 890123" /></label>
      <label className="block"><span className="label">{file ? "Receipt attached ✓ (choose another to replace it)" : "Screenshot of your receipt *"}</span>
        <input type="file" accept="image/*" onChange={(e) => {
          const f = e.target.files?.[0] ?? null; setFile(f); setPreview(f ? URL.createObjectURL(f) : null);
        }} /></label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="Receipt preview" className="max-w-40 rounded-xl" />}
      <div className="space-y-2 rounded-2xl border border-line bg-background p-3 text-sm">
        <div className="flex gap-3 border-b border-line pb-1.5"><span className="w-16 text-muted">To</span><b>{salesEmail}</b></div>
        <div className="flex gap-3 border-b border-line pb-1.5"><span className="w-16 shrink-0 text-muted">Subject</span><b>{subject}</b></div>
        <textarea className="input text-sm" rows={14} aria-label="Message" value={text} onChange={(e) => setBody(e.target.value)} />
        <p className="text-muted">We filled this in from your job post. Add anything else you&apos;d like us to know.</p>
      </div>
      {error && <p className="text-sm font-semibold text-no">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send to sales"}</button>
    </form>
  );
}

/** Two taps to close a job, so a slip doesn't hide it. */
export function FilledButton({ jobId, filled }: { jobId: string; filled: boolean }) {
  const [sure, setSure] = useState(false);
  const [busy, start] = useTransition();
  return (
    <button className="btn-ghost !py-1.5" disabled={busy}
      onClick={() => (filled || sure ? start(() => markFilled(jobId, !filled)) : setSure(true))}>
      {filled ? "Reopen this job" : sure ? "Tap again to close this job" : "Position filled"}
    </button>
  );
}
