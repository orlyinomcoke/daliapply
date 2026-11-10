"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = {
  seeker: [
    "remote PHP developer job, 80k+",
    "React frontend role in Manila",
    "part-time QA tester, English and Filipino",
    "team lead, Laravel, hybrid in Cebu",
  ],
  company: [
    "PHP programmer, 5 yrs, team lead experience",
    "React developer with 3 years TypeScript",
    "QA engineer, Selenium 2+ yrs, Filipino speaker",
    "DevOps, AWS 4 yrs, remote",
  ],
};
const PREFIX = { seeker: "What are you looking for? e.g. ", company: "Who are you looking for? e.g. " };

import type { Side } from "@/lib/copy";

/** Types each example out letter by letter, then cycles to the next. */
function useTypedPlaceholder(side: Side) {
  const [text, setText] = useState("");
  useEffect(() => {
    let i = 0, n = 0, deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const target = EXAMPLES[side][i];
      n += deleting ? -1 : 1;
      setText(target.slice(0, n));
      let delay = deleting ? 25 : 55;
      if (!deleting && n === target.length) { deleting = true; delay = 1800; }
      else if (deleting && n === 0) { deleting = false; i = (i + 1) % EXAMPLES[side].length; delay = 300; }
      timer = setTimeout(tick, delay);
    };
    setText("");
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [side]);
  return PREFIX[side] + text;
}

/** The seeker/company toggle and the big search box. The parent owns the side. */
export function LandingSearch({ side, setSide }: { side: Side; setSide: (s: Side) => void }) {
  const [q, setQ] = useState("");
  const placeholder = useTypedPlaceholder(side);
  const router = useRouter();

  return (
    <div className="w-full max-w-2xl">
      <div className="relative mb-4 grid w-full grid-cols-2 rounded-full bg-card p-1 text-sm font-semibold sm:w-fit">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-brand transition-transform duration-300"
          style={{ transform: side === "company" ? "translateX(100%)" : "none" }}
        />
        {(["seeker", "company"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => setSide(s)}
            className={`relative z-10 rounded-full px-5 py-2 transition-colors ${side === s ? "text-card" : "text-foreground"}`}
          >
            {s === "seeker" ? "I'm a job seeker" : "I'm a company"}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/preview?as=${side}&q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="w-full rounded-2xl border-2 border-transparent bg-card px-6 py-5 text-lg text-foreground shadow-[0_18px_40px_-20px_rgba(0,0,0,.55)] outline-none focus:border-accent"
        />
      </form>
    </div>
  );
}
