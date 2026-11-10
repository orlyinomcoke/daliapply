import Link from "next/link";
import { FAQ } from "@/lib/copy";

export const metadata = { title: "FAQ · Daliapply" };

export default function Faq() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-4xl font-extrabold">Questions and answers</h1>
      {Object.entries(FAQ).map(([section, qs]) => (
        <section key={section} className="space-y-3">
          <h2 className="mt-6 text-2xl font-bold">{section}</h2>
          {qs.map(([q, a]) => (
            <details key={q} className="card">
              <summary className="cursor-pointer text-[17px] font-bold [font-family:var(--font-display)]">{q}</summary>
              <p className="mt-2 text-muted">{a}</p>
            </details>
          ))}
        </section>
      ))}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <span>Didn&apos;t find your answer?</span>
        <Link className="btn-primary" href="/support">Contact support</Link>
      </div>
    </div>
  );
}
