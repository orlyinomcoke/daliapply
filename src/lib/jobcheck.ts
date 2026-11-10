/**
 * Checks a job post before payment: required fields, and likely mistakes such as the
 * description asking for "5+ years of PHP" while the required skills say 3.
 * Pure functions, shared by the server action and the tests.
 */
import { SKILL_LABELS, parseSearchText } from "./parse.ts";

export type JobDraft = {
  title: string;
  description: string;
  skillsText: string;
  salaryMin: string;
  salaryMax: string;
  country: string;
  languages: string;
  remote: boolean;
  relocation: boolean;
};
export type JobSkill = { label: string; min: number };
export type Check = { text: string; fix?: { label: string; min: number; action: "years" | "add" | "rename"; to?: string }; fixText?: string };

export const JOB_COUNTRIES = ["PH", "SG", "HK", "JP", "KR", "TW", "MY", "ID", "TH", "VN", "IN", "AE", "SA", "QA", "KW", "BH", "OM", "AU", "NZ", "US", "CA", "GB", "IE", "DE", "NL", "FR", "ES", "IT"];
const LABEL = new Map(SKILL_LABELS.map((l) => [l.toLowerCase(), l]));
const php = (n: number) => `PHP ${n.toLocaleString("en-PH")}`;

export function parseSkillLines(text: string) {
  const skills: JobSkill[] = [], bad: string[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^(.+?)[\s:,-]+(\d+(?:\.\d+)?)\s*\+?\s*(?:yrs?|years?)?$/i);
    if (m && m[1].trim()) skills.push({ label: m[1].trim(), min: Number(m[2]) });
    else bad.push(line);
  }
  return { skills, bad };
}

/** Field errors that block saving, keyed by field name. */
export function jobErrors(d: JobDraft) {
  const errors: [keyof JobDraft, string][] = [];
  const { skills, bad } = parseSkillLines(d.skillsText);
  const min = Number(d.salaryMin), max = Number(d.salaryMax);
  if (!d.title.trim()) errors.push(["title", "Add a job title."]);
  if (d.description.trim().length < 40) errors.push(["description", "Write at least a couple of sentences in the description (40 characters or more)."]);
  if (!skills.length && !bad.length) errors.push(["skillsText", 'Add at least one required skill with its years, like "PHP: 5".']);
  if (bad.length) errors.push(["skillsText", `Add the years to each skill line, like "PHP: 5". Check: ${bad.map((x) => `"${x}"`).join(", ")}.`]);
  if (!(min > 0)) errors.push(["salaryMin", "Add the lowest monthly salary."]);
  if (!(max > 0)) errors.push(["salaryMax", "Add the highest monthly salary."]);
  if (min > 0 && max > 0 && min > max) errors.push(["salaryMin", "The lowest salary is higher than the highest. Swap them?"]);
  if (!JOB_COUNTRIES.includes(d.country)) errors.push(["country", "Pick a country."]);
  return errors;
}

/** Skills and years the description mentions, clause by clause ("5+ years of PHP"). */
export function descriptionSkills(desc: string): JobSkill[] {
  const found = new Map<string, number>();
  for (const part of desc.split(/[\n.;•,]+|\band\b/i)) {
    if (!part.trim()) continue;
    for (const k of parseSearchText(part).skills) {
      const label = LABEL.get(k.skill) ?? k.skill;
      if (!found.has(label) || k.min_years > found.get(label)!) found.set(label, k.min_years);
    }
  }
  return [...found].map(([label, min]) => ({ label, min }));
}

function editDistance(a: string, b: string) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
export function closestSkill(label: string) {
  const l = label.toLowerCase();
  let best: { k: string; d: number } | null = null;
  for (const k of SKILL_LABELS) {
    const d = editDistance(l, k.toLowerCase());
    if (d <= Math.max(1, Math.floor(k.length / 4)) && (!best || d < best.d)) best = { k, d };
  }
  return best?.k ?? null;
}

/** Likely mistakes to show on the Check step. None of these block saving. */
export function jobChecks(job: { description: string; skills: JobSkill[]; salaryMin: number; salaryMax: number }): Check[] {
  const out: Check[] = [];
  const req = new Map(job.skills.map((k) => [k.label.toLowerCase(), k]));
  for (const k of descriptionSkills(job.description)) {
    const r = req.get(k.label.toLowerCase());
    if (r && k.min && r.min !== k.min)
      out.push({ text: `Your description says ${k.label} ${k.min} years, but required skills say ${r.min}. Which is right?`, fix: { label: r.label, min: k.min, action: "years" }, fixText: `Use ${k.min} years` });
    else if (!r)
      out.push({ text: `Your description mentions ${k.label}, but it isn't in your required skills, so we won't match on it.`, fix: { label: k.label, min: k.min || 1, action: "add" }, fixText: `Add ${k.label}${k.min ? ` (${k.min} yrs)` : ""}` });
  }
  for (const k of job.skills) {
    if (!LABEL.has(k.label.toLowerCase())) {
      const near = closestSkill(k.label);
      out.push(near
        ? { text: `We don't recognise "${k.label}". Did you mean ${near}?`, fix: { label: k.label, min: k.min, action: "rename", to: near }, fixText: `Change to ${near}` }
        : { text: `We don't recognise "${k.label}". Check the spelling, or seekers' resumes may not match it.` });
    }
    if (k.min > 20) out.push({ text: `${k.label} ${k.min} years is a lot. Very few people will match. Is that a typo?` });
  }
  if (job.salaryMin < 10000) out.push({ text: `${php(job.salaryMin)} a month is unusually low. Is it a typo (for example, a missing zero)?` });
  if (job.salaryMax > 1000000) out.push({ text: `${php(job.salaryMax)} a month is unusually high. Is it a typo?` });
  if (job.salaryMax > job.salaryMin * 3) out.push({ text: "The top of your salary range is more than 3 times the bottom. Seekers trust a tighter range more." });
  return out;
}

/** Apply a Check's one-tap fix to a skill list. */
export function applyFix(skills: JobSkill[], fix: NonNullable<Check["fix"]>): JobSkill[] {
  if (fix.action === "add") return [...skills, { label: fix.label, min: fix.min }];
  if (fix.action === "rename") return skills.map((k) => (k.label === fix.label ? { ...k, label: fix.to! } : k));
  return skills.map((k) => (k.label === fix.label ? { ...k, min: fix.min } : k));
}
export const skillsToText = (skills: JobSkill[]) => skills.map((k) => `${k.label}: ${k.min}`).join("\n");
