"use client";
import { useState } from "react";
import { SwipeDeck, useDeck } from "@/components/SwipeDeck";
import { hideCompany, seekerSwipe } from "./actions/swipe";

export type JobCard = {
  id: string; company_id: string; company_name: string; company_logo: string | null;
  title: string; description: string; country: string | null; remote: boolean; languages: string[];
  salary_badge: string; why: string | null;
};

export function SeekerDeck({ jobs }: { jobs: JobCard[] }) {
  return (
    <SwipeDeck
      items={jobs}
      onSwipe={(job, dir) => seekerSwipe(job.id, dir)}
      rightLabel="Send profile"
      leftLabel="Never show"
      empty={<>No more jobs match you right now. Check back soon.</>}
      render={(job) => <Job job={job} />}
    />
  );
}

function Job({ job }: { job: JobCard }) {
  const [menu, setMenu] = useState(false);
  const deck = useDeck<JobCard>();
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {job.company_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.company_logo} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-lg font-bold">{job.company_name[0]}</div>
          )}
          <div>
            <p className="text-sm text-muted">{job.company_name}</p>
            <h2 className="text-xl font-bold leading-tight">{job.title}</h2>
          </div>
        </div>
        <div className="relative">
          <button aria-label="More" className="px-2 text-xl" onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenu(!menu)}>⋯</button>
          {menu && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-line bg-card p-1 text-sm shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
              <button
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-brand-soft"
                onClick={async () => {
                  const err = await hideCompany(job.company_id);
                  if (!err) deck.drop((j) => j.company_id === job.company_id);
                  setMenu(false);
                }}
              >
                Hide this company for 30 days
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="chip">{job.remote ? "Remote" : "Onsite"}{job.country ? ` · ${job.country}` : ""}</span>
        {job.languages.map((l) => <span key={l} className="chip capitalize">{l}</span>)}
        <span className={`chip ${job.salary_badge.startsWith("Within") ? "!bg-green-100 !text-green-800" : ""}`}>{job.salary_badge}</span>
      </div>
      <p className="whitespace-pre-line text-sm">{job.description}</p>
      {job.why && (
        <p className="mt-auto rounded-xl bg-background p-3 text-sm"><b>Why it matched:</b> {job.why}</p>
      )}
    </div>
  );
}
