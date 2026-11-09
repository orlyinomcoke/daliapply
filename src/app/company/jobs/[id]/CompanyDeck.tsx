"use client";
import { useState } from "react";
import { SwipeDeck } from "@/components/SwipeDeck";
import { companySwipe } from "../../actions/swipe";

export type SeekerCard = {
  id: string; masked_name: string; headline: string | null; total_years: number;
  skills: { skill: string; years: number }[]; recent_roles: { title: string; years: number }[];
  country: string | null; languages: string[]; availability: string | null;
  salary_badge: string; why: string | null; verified: boolean;
};

export function CompanyDeck({ jobId, seekers, paidUsed, paidCap }: { jobId: string; seekers: SeekerCard[]; paidUsed: number; paidCap: number }) {
  const [used, setUsed] = useState(paidUsed);
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted">
        {used >= paidCap ? "Reward pool used: right swipes still work but no longer pay the seeker." : `${paidCap - used} of ${paidCap} paid right swipes left on this post`}
      </p>
      <SwipeDeck
        items={seekers}
        rightLabel="Interested"
        leftLabel="Not for this job"
        empty={<>No more candidates for this job right now. Try a different search.</>}
        onSwipe={async (s, dir) => {
          const err = await companySwipe(jobId, s.id, dir);
          if (!err && dir === "right" && s.verified) setUsed((u) => u + 1);
          return err;
        }}
        render={(s) => (
          <div className="flex h-full flex-col gap-3">
            <div>
              <p className="text-2xl font-extrabold tracking-wide">{s.masked_name}</p>
              <p className="text-muted">{s.headline} · {Number(s.total_years)} yrs total</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.skills.slice(0, 8).map((k) => <span key={k.skill} className="chip capitalize">{k.skill} {Number(k.years)} yrs</span>)}
            </div>
            {s.recent_roles.length > 0 && (
              <ul className="text-sm">
                {s.recent_roles.slice(0, 3).map((r, i) => <li key={i}>{r.title} · {r.years} yrs</li>)}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              {s.country && <span className="chip">{s.country}</span>}
              {s.languages.map((l) => <span key={l} className="chip capitalize">{l}</span>)}
              {s.availability && <span className="chip">{s.availability}</span>}
              <span className="chip !bg-green-100 !text-green-800">{s.salary_badge}</span>
              {s.verified && <span className="chip">✓ Verified</span>}
            </div>
            {s.why && <p className="mt-auto rounded-xl bg-background p-3 text-sm"><b>Why it matched:</b> {s.why}</p>}
          </div>
        )}
      />
    </div>
  );
}
