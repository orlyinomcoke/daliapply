/** "PHP: 6\nManagement: 2" <-> [{skill, label, years}] for simple editable skill lists. */
export function parseSkillLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)[\s:,-]+(\d+(?:\.\d+)?)\s*(?:yrs?|years?)?$/i);
      const label = (m ? m[1] : line).trim();
      return { skill: label.toLowerCase(), label, years: m ? Number(m[2]) : 0 };
    });
}

export function skillLines(skills: { label?: string | null; skill: string; years: number }[]) {
  return skills.map((s) => `${s.label ?? s.skill}: ${Number(s.years)}`).join("\n");
}

export function csv(text: FormDataEntryValue | null) {
  return String(text ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function intOrNull(v: FormDataEntryValue | null) {
  const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
