"use client";
import { useState, useTransition } from "react";
import { deleteAccount, sendReport, type ReportInput } from "@/app/actions/account";

const REASONS: Record<ReportInput["kind"], string[]> = {
  job: ["Fake or scam job", "Asks seekers to pay", "Misleading salary or details", "Discriminatory requirements", "Something else"],
  company: ["Scam or asked me for money", "Harassment or rude messages", "Fake company", "Something else"],
  seeker: ["Fake profile or resume", "Harassment or rude messages", "Spam", "Something else"],
};

/** A private report, reviewed by the Daliapply team. Opens over the page. */
export function ReportDialog({ target, onClose }: { target: Omit<ReportInput, "reason" | "note">; onClose: (sent: boolean) => void }) {
  const [reason, setReason] = useState(REASONS[target.kind][0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(false); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="rd-h" className="card max-h-full w-full max-w-md space-y-3 overflow-auto"
        onSubmit={(e) => { e.preventDefault(); start(async () => { const err = await sendReport({ ...target, reason, note }); if (err) setError(err); else onClose(true); }); }}>
        <h2 id="rd-h" className="text-lg font-bold">Report {target.label}</h2>
        <p className="text-sm text-muted">Reports are private. The Daliapply team reviews every one, usually within a day.</p>
        <fieldset className="space-y-1.5 text-sm">
          {REASONS[target.kind].map((r) => (
            <label key={r} className="flex items-center gap-2"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {r}</label>
          ))}
        </fieldset>
        <label className="block"><span className="label">What happened? (optional)</span><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {error && <p className="text-sm font-semibold text-no">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
        </div>
      </form>
    </div>
  );
}

export function ReportButton({ target, className = "btn-ghost !py-1.5" }: { target: Omit<ReportInput, "reason" | "note">; className?: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <button className={className} disabled={sent} onClick={() => setOpen(true)}>{sent ? "Reported. Thanks." : `Report ${target.kind === "seeker" ? "this person" : "this company"}`}</button>
      {open && <ReportDialog target={target} onClose={(s) => { setOpen(false); if (s) setSent(true); }} />}
    </>
  );
}

export function DeleteAccount({ side }: { side: "seeker" | "company" }) {
  const [sure, setSure] = useState(false);
  const [busy, start] = useTransition();
  return (
    <section className="card space-y-2">
      <h2 className="text-lg font-bold">Your account</h2>
      <p className="text-sm text-muted">
        {side === "seeker"
          ? "Deleting your account removes your profile, resume, ID, swipes, matches and messages. This can't be undone."
          : "Deleting your account removes your company, job posts, swipes, matches and messages. Payment records are kept for tax purposes. This can't be undone."}
      </p>
      <div className="flex items-center gap-3">
        <button className="btn-ghost !border-no-soft !text-no" disabled={busy} onClick={() => (sure ? start(() => deleteAccount()) : setSure(true))}>
          {busy ? "Deleting…" : sure ? "Yes, delete everything" : "Delete my account"}
        </button>
        {sure && !busy && <span className="text-sm text-muted">Tap again to confirm.</span>}
      </div>
    </section>
  );
}
