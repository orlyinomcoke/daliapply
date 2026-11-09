"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, className = "btn-primary" }: { children: React.ReactNode; pending?: string; className?: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button className={className} disabled={isPending}>
      {isPending ? pending ?? "Saving…" : children}
    </button>
  );
}
