"use client";
import { useState } from "react";
import Link from "next/link";
import { LandingSearch } from "./LandingSearch";
import { HOOKS, PRICE, STEPS, type Side } from "@/lib/copy";

export function Home() {
  const [side, setSide] = useState<Side>("seeker");
  const seeker = side === "seeker";
  return (
    <>
      <section className="hero2 -mt-8 grid items-center gap-8 pb-28 pt-14 md:grid-cols-[1.1fr_.9fr] md:pt-16">
        <svg className="blob" viewBox="0 0 1440 640" preserveAspectRatio="none" aria-hidden>
          <path d="M0,0 H1440 V150 C1390,215 1300,205 1190,212 C1040,222 960,300 880,420 C790,560 640,640 430,636 C230,632 80,580 0,500 Z" />
        </svg>
        <svg className="blob blob-m" viewBox="0 0 400 1000" preserveAspectRatio="none" aria-hidden>
          <path d="M0,0 H400 V900 C330,985 210,1000 120,975 C60,958 20,930 0,905 Z" />
        </svg>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[#a9b6ff]">{seeker ? "For job seekers" : "For companies"}</p>
          <h1 className="max-w-[12ch] text-[clamp(38px,5.6vw,64px)] font-extrabold leading-[1.02]">
            Swipe right on your{" "}
            <em className="bg-[linear-gradient(transparent_66%,var(--accent)_66%_90%,transparent_90%)] not-italic">{seeker ? "next job." : "next hire."}</em>
          </h1>
          <p className="mb-6 mt-4 max-w-[46ch] text-lg text-white/80">
            {seeker
              ? "Upload your resume once. No forms, no cover letters, no ghosting. Your name stays hidden until both sides say yes."
              : `See only candidates who fit your salary, skills and languages. Every match already wants the job. ${PRICE} per post.`}
          </p>
          <LandingSearch side={side} setSide={setSide} />
        </div>
        <HeroArt side={side} />
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[["Apply once", "A right swipe sends the profile we read from your resume. Never fill a form again."],
          ["Fair first look", "No photo, age, gender or full name until it's a match. Companies judge skills first."],
          ["Real people only", "Seekers confirm their email and a government ID. Companies sign up with a verified work domain."]].map(([t, d]) => (
          <div key={t} className="border-t-[3px] border-foreground p-4"><b className="block text-lg">{t}</b><span className="text-muted">{d}</span></div>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="text-center text-3xl font-extrabold">{seeker ? "Why job seekers use Daliapply" : "Why companies hire on Daliapply"}</h2>
        <p className="mb-7 mt-1 text-center text-muted">{seeker ? "Sound familiar?" : "Hiring shouldn't feel like this."}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HOOKS[side].map(([q, a]) => (
            <div key={q} className="card"><b className="mb-1.5 block font-[family-name:var(--font-display)] text-lg leading-snug">{q}</b><span className="text-muted">{a}</span></div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-center text-3xl font-extrabold">How it works</h2>
        <p className="mb-7 mt-1 text-center text-muted">Three steps, no cover letters.</p>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS[side].map(([t, d], i) => (
            <li key={t} className="border-t-[3px] border-foreground pt-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted">Step {i + 1}</span>
              <b className="block text-lg">{t}</b><span className="text-muted">{d}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-center"><Link className="btn-primary" href={`/signin?as=${side}`}>{seeker ? "Find jobs" : "Post a job"}</Link></p>
      </section>
    </>
  );
}

function HeroArt({ side }: { side: Side }) {
  const seeker = side === "seeker";
  const ghost = <><div className="mb-3 h-11 w-11 rounded-xl bg-accent" /><div className="h-5" /><div className="h-4" /></>;
  return (
    <div className="hero-art" aria-hidden>
      <div className="hc b1">{ghost}</div>
      <div className="hc b2">{ghost}</div>
      <div className="hc top">
        <span className="absolute right-4 top-4 rotate-12 rounded-lg border-[3px] border-yes px-2 font-extrabold text-yes">YES</span>
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent text-xl font-extrabold text-accent-ink">{seeker ? "K" : "O"}</div>
        <b className="block text-xl">{seeker ? "PHP Lead" : "O*** B*****"}</b>
        <div className="mb-3 text-sm text-muted">{seeker ? "Kalye Labs · Remote · PH" : "PHP programmer · 8 yrs"}</div>
        <span className="rounded-full bg-yes-soft px-2.5 py-0.5 text-xs font-bold text-yes">{seeker ? "Within your range" : "Verified"}</span>
        <div className="mt-3 border-t border-dashed border-line pt-2.5 text-sm">{seeker ? "PHP 6 yrs ✓ · Management 2 yrs ✓" : "PHP 6 yrs ✓ · Laravel 4 yrs ✓"}</div>
      </div>
      <Pill className="right-0 top-3.5" dot="♥">It&apos;s a match</Pill>
      <Pill className="bottom-5 left-0" dot="✓">{seeker ? "Salary shown before you swipe" : "Ranked by years per skill"}</Pill>
    </div>
  );
}
function Pill({ className, dot, children }: { className: string; dot: string; children: React.ReactNode }) {
  return (
    <div className={`absolute flex items-center gap-2 whitespace-nowrap rounded-full bg-card px-3.5 py-2.5 text-sm font-bold text-foreground shadow-[0_16px_30px_-18px_rgba(0,0,0,.6)] ${className}`}>
      <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-accent text-xs text-accent-ink">{dot}</span>{children}
    </div>
  );
}
