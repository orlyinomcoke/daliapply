/**
 * Rule-based resume reading and search parsing. Free and runs locally, so the app
 * works without any AI API key. src/lib/ai.ts uses Claude instead when a key is set.
 */
import type { ExtractedProfile, SearchFilters } from "./ai";

// Canonical skill label -> extra spellings to recognise (lower-case).
const SKILLS: Record<string, string[]> = {
  PHP: [], Laravel: [], Symfony: [], CodeIgniter: [], WordPress: ["wp"],
  JavaScript: ["js", "ecmascript"], TypeScript: ["ts"], "Node.js": ["node", "nodejs"],
  React: ["react.js", "reactjs"], "Next.js": ["nextjs"], Vue: ["vue.js", "vuejs"], Angular: ["angularjs"],
  "React Native": [], Flutter: [], Dart: [], Swift: [], Kotlin: [], Java: [], "Spring Boot": ["spring"],
  Python: [], Django: [], Flask: [], FastAPI: [], Ruby: [], Rails: ["ruby on rails"], Go: ["golang"],
  Rust: [], "C#": ["c sharp"], ".NET": ["dotnet", "asp.net"], "C++": ["cpp"], C: [],
  HTML: ["html5"], CSS: ["css3"], Tailwind: ["tailwindcss"], Sass: ["scss"],
  SQL: [], MySQL: [], PostgreSQL: ["postgres"], MongoDB: ["mongo"], Redis: [], Firebase: [], Supabase: [],
  GraphQL: [], "REST API": ["rest", "restful", "rest apis"],
  AWS: ["amazon web services"], Azure: [], GCP: ["google cloud"], Docker: [], Kubernetes: ["k8s"],
  Linux: [], Git: ["github", "gitlab"], "CI/CD": ["ci cd", "jenkins", "github actions"], DevOps: [], Terraform: [],
  Selenium: [], Cypress: [], Playwright: [], Jest: [], QA: ["quality assurance", "software testing", "manual testing"],
  "UI/UX": ["ui", "ux", "ui design", "ux design", "user experience"], Figma: [], Photoshop: [], Illustrator: [],
  "Data Analysis": ["data analytics"], Excel: ["ms excel", "microsoft excel"], "Power BI": ["powerbi"], Tableau: [],
  "Machine Learning": ["ml"], SEO: [], "Digital Marketing": [], "Social Media": ["social media marketing"],
  "Customer Service": ["customer support", "call center", "bpo"], Sales: [], Accounting: ["bookkeeping"],
  "Virtual Assistant": ["va", "virtual assistance"], Copywriting: ["content writing"],
  "Project Management": ["pm"], Management: ["team lead", "team leader", "leadership", "people management", "managed a team"],
  Agile: ["scrum", "kanban"], Jira: [], Salesforce: [], Shopify: [],
};

const LANGUAGES = ["english", "filipino", "tagalog", "cebuano", "bisaya", "ilocano", "spanish", "japanese",
  "korean", "mandarin", "chinese", "cantonese", "french", "german", "arabic", "hindi", "indonesian", "malay",
  "vietnamese", "thai", "portuguese", "italian", "russian"];

const COUNTRIES: Record<string, string> = {
  philippines: "PH", manila: "PH", "metro manila": "PH", cebu: "PH", davao: "PH", "quezon city": "PH",
  makati: "PH", taguig: "PH", pasig: "PH", singapore: "SG", "united states": "US", usa: "US",
  "united kingdom": "GB", uk: "GB", australia: "AU", canada: "CA", japan: "JP", "hong kong": "HK",
  "united arab emirates": "AE", dubai: "AE", "saudi arabia": "SA", malaysia: "MY", indonesia: "ID",
  vietnam: "VN", thailand: "TH", india: "IN",
};

const ROLES = ["programmer", "developer", "engineer", "designer", "analyst", "tester", "qa", "manager",
  "lead", "architect", "administrator", "admin", "assistant", "accountant", "writer", "marketer",
  "specialist", "consultant", "agent", "representative", "scientist", "devops"];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every [label, regex] pair. Word boundaries that also work for C#, C++, .NET, Node.js. */
const SKILL_PATTERNS: [string, RegExp][] = Object.entries(SKILLS).map(([label, aliases]) => {
  const names = [label, ...aliases].map((n) => esc(n.toLowerCase())).sort((a, b) => b.length - a.length);
  return [label, new RegExp(`(?<![a-z0-9+#.])(?:${names.join("|")})(?![a-z0-9+#])`, "i")];
});

export function findSkills(text: string) {
  return SKILL_PATTERNS.filter(([, re]) => re.test(text)).map(([label]) => label);
}

function findLanguages(text: string) {
  const t = text.toLowerCase();
  const found = LANGUAGES.filter((l) => new RegExp(`\\b${l}\\b`).test(t)).map((l) => (l === "tagalog" ? "filipino" : l));
  return [...new Set(found)];
}

function findCountry(text: string) {
  const t = text.toLowerCase();
  let best: { code: string; at: number } | null = null;
  for (const [name, code] of Object.entries(COUNTRIES)) {
    const at = t.search(new RegExp(`\\b${esc(name)}\\b`));
    if (at >= 0 && (!best || at < best.at)) best = { code, at };
  }
  return best?.code ?? null;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?";
const POINT = `(?:${MONTH}\\s*)?((?:19|20)\\d{2})|(?:(\\d{1,2})/((?:19|20)\\d{2}))`;
const RANGE = new RegExp(`(?:${POINT})\\s*(?:-|–|—|to|until)\\s*(?:(present|current|now|to date)|(?:${POINT}))`, "gi");

/** Months as a fractional year, from a RANGE match. */
function rangeOf(m: RegExpExecArray, now: Date) {
  const start = m[2] ? Number(m[2]) + (m[1] ? MONTHS[m[1].slice(0, 3).toLowerCase()] : 0) / 12
    : Number(m[4]) + (Number(m[3]) - 1) / 12;
  let end: number;
  if (m[5]) end = now.getFullYear() + now.getMonth() / 12;
  else if (m[7]) end = Number(m[7]) + (m[6] ? MONTHS[m[6].slice(0, 3).toLowerCase()] : 11) / 12;
  else end = Number(m[9]) + (Number(m[8]) - 1) / 12;
  return end > start ? { start, end } : null;
}

type Block = { start: number; end: number; text: string; title: string };

/** Split the resume into job blocks, each starting at a date range. */
function experienceBlocks(text: string, now = new Date()): Block[] {
  const matches = [...text.matchAll(RANGE)];
  const blocks: Block[] = [];
  matches.forEach((m, i) => {
    const r = rangeOf(m as RegExpExecArray, now);
    if (!r) return;
    const from = m.index!;
    const to = i + 1 < matches.length ? matches[i + 1].index! : Math.min(text.length, from + 2500);
    // the job title is usually on the line just before or containing the dates
    const lineStart = text.lastIndexOf("\n", from - 1);
    const prevLineStart = text.lastIndexOf("\n", lineStart - 1);
    const sameLine = text.slice(lineStart + 1, from).replace(/[|,–—-]+\s*$/, "").trim();
    const prevLine = text.slice(prevLineStart + 1, lineStart).trim();
    const title = (sameLine.length > 2 ? sameLine : prevLine).slice(0, 80);
    blocks.push({ ...r, text: text.slice(Math.max(0, prevLineStart), to), title });
  });
  return blocks;
}

/** Total years covered by the blocks, counting overlapping jobs once. */
function mergedYears(blocks: { start: number; end: number }[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  let total = 0, curStart = -1, curEnd = -1;
  for (const b of sorted) {
    if (b.start > curEnd) { if (curEnd > curStart) total += curEnd - curStart; curStart = b.start; curEnd = b.end; }
    else curEnd = Math.max(curEnd, b.end);
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

const half = (n: number) => Math.round(n * 2) / 2;

function findSalary(text: string) {
  const t = text.toLowerCase().replace(/,/g, "");
  const m = t.match(/(?:expected|desired|asking)\s*(?:monthly\s*)?salary[^0-9]{0,20}(\d+(?:\.\d+)?)\s*(k)?(?:\s*(?:-|–|to)\s*(?:php|₱|p)?\s*(\d+(?:\.\d+)?)\s*(k)?)?/);
  if (!m) return { min: null, max: null };
  const v = (n?: string, k?: string) => (n ? Math.round(Number(n) * (k ? 1000 : 1)) : null);
  const min = v(m[1], m[2]);
  return { min, max: v(m[3], m[4]) ?? min };
}

function findName(lines: string[]) {
  for (const line of lines.slice(0, 8)) {
    const clean = line.replace(/[^A-Za-zÀ-ÿñÑ .'-]/g, "").trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5 && !/resume|curriculum|vitae|profile|contact/i.test(clean)
        && words.every((w) => /^[A-ZÀ-ÿÑ]/.test(w) || w.length <= 3)) {
      const parts = words.map((w) => w[0] + w.slice(1).toLowerCase());
      return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
    }
  }
  return { first: "", last: "" };
}

function findHeadline(lines: string[], blocks: Block[]) {
  const roleRe = new RegExp(`\\b(${ROLES.join("|")})\\b`, "i");
  const top = lines.slice(1, 6).find((l) => roleRe.test(l) && l.length < 60);
  return top ?? blocks.sort((a, b) => b.end - a.end)[0]?.title ?? "";
}

export function stripContacts(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email hidden]")
    .replace(/(?:\+?63|0)\s*9\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, "[phone hidden]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone hidden]");
}

export async function pdfToText(pdf: Buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}

/** Read a resume's text into a seeker profile using rules only. */
export function extractResumeText(raw: string, now = new Date()): ExtractedProfile {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks = experienceBlocks(text, now);
  const total = half(mergedYears(blocks));

  const skills = findSkills(text).map((label) => {
    const used = blocks.filter((b) => SKILL_PATTERNS.find(([l]) => l === label)![1].test(b.text));
    return { skill: label, years: half(mergedYears(used)) };
  });
  const { first, last } = findName(lines);
  const salary = findSalary(text);

  return {
    first_name: first,
    last_name: last,
    headline: findHeadline(lines, blocks),
    total_years: total,
    skills: skills.sort((a, b) => b.years - a.years),
    recent_roles: [...blocks]
      .sort((a, b) => b.end - a.end)
      .slice(0, 4)
      .map((b) => ({ title: b.title, employer: "", years: half(b.end - b.start) })),
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: "PHP",
    country: findCountry(text),
    languages: findLanguages(text),
    resume_text: stripContacts(text).trim(),
  };
}

/** Turn "programmer with 5 years in management and PHP" into filters using rules only. */
export function parseSearchText(query: string): SearchFilters {
  const q = query.toLowerCase();
  const skills = findSkills(q);
  // "PHP 5 yrs" / "5 years of PHP": pair a number with the nearest skill, otherwise apply it to all
  const yearsRe = /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/g;
  const nums = [...q.matchAll(yearsRe)].map((m) => ({ n: Number(m[1]), at: m.index! }));
  const pos = (label: string) => q.search(SKILL_PATTERNS.find(([l]) => l === label)![1]);
  const withYears = skills.map((label) => {
    if (!nums.length) return { skill: label.toLowerCase(), min_years: 0 };
    if (nums.length === 1) return { skill: label.toLowerCase(), min_years: nums[0].n };
    const p = pos(label);
    const nearest = nums.reduce((a, b) => (Math.abs(b.at - p) < Math.abs(a.at - p) ? b : a));
    return { skill: label.toLowerCase(), min_years: nearest.n };
  });
  const roleRe = new RegExp(`\\b(${ROLES.join("|")})s?\\b`, "i");
  const sal = q.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k)\s*\+?|(?:php|₱)\s*(\d{4,})/);
  return {
    role: q.match(roleRe)?.[1] ?? null,
    skills: withYears,
    country: findCountry(q),
    remote: /\bremote\b|work from home|\bwfh\b/.test(q) ? true : null,
    salary_min: sal ? Math.round(Number(sal[1] ?? sal[3]) * (sal[2] ? 1000 : 1)) : null,
    languages: findLanguages(q),
  };
}
