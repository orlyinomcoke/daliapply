import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { SeekerDeck, type JobCard } from "./SeekerDeck";
import { SeekerNav } from "@/components/Nav";

export default async function SeekerHome() {
  const { supabase, user } = await requireRole("seeker");
  const { data: me } = await supabase.from("seekers").select("profile_confirmed, verification_status").eq("id", user.id).single();
  if (!me?.profile_confirmed) redirect("/seeker/profile");

  const { data: feed } = await supabase.rpc("seeker_job_feed", { p_limit: 30 });
  const jobs: JobCard[] = (feed ?? []).map((j: Record<string, unknown>) => ({ ...j, id: j.job_id as string }) as JobCard);

  return (
    <div className="space-y-6">
      <SeekerNav />
      {me.verification_status !== "verified" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !bg-brand-soft">
          <p className="text-sm">
            {me.verification_status === "pending"
              ? "Your ID is being reviewed. Once approved, companies see a Verified badge on your card."
              : "Verify your ID to get a Verified badge. Companies see it on your card."}
          </p>
          {me.verification_status !== "pending" && <Link href="/seeker/verify" className="btn-primary">Verify now</Link>}
        </div>
      )}
      <SeekerDeck jobs={jobs} />
    </div>
  );
}
