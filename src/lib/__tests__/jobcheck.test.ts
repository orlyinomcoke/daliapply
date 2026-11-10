import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFix, descriptionSkills, jobChecks, jobErrors, parseSkillLines } from "../jobcheck.ts";

const draft = {
  title: "PHP Lead", description: "Lead our team of four developers. You need 5+ years of PHP and 2 years with Laravel.",
  skillsText: "PHP: 3\nManagment: 2", salaryMin: "70000", salaryMax: "100000", country: "PH", languages: "", remote: false, relocation: false,
};

test("required fields", () => {
  assert.deepEqual(jobErrors(draft), []);
  const errs = jobErrors({ ...draft, title: "", description: "short", skillsText: "PHP", salaryMin: "", country: "XX" }).map(([k]) => k);
  assert.deepEqual(errs, ["title", "description", "skillsText", "salaryMin", "country"]);
  assert.equal(jobErrors({ ...draft, salaryMin: "90000", salaryMax: "50000" })[0][1].includes("higher"), true);
  assert.deepEqual(jobErrors({ ...draft, languages: "" }), [], "languages are optional");
});

test("description years per skill", () => {
  assert.deepEqual(descriptionSkills(draft.description), [{ label: "PHP", min: 5 }, { label: "Laravel", min: 2 }]);
});

test("checks and fixes", () => {
  const skills = parseSkillLines(draft.skillsText).skills;
  const checks = jobChecks({ description: draft.description, skills, salaryMin: 70000, salaryMax: 100000 });
  assert.deepEqual(checks.map((c) => c.fixText), ["Use 5 years", "Add Laravel (2 yrs)", "Change to Management"]);
  let fixed = skills;
  for (const c of checks) fixed = applyFix(fixed, c.fix!);
  assert.deepEqual(fixed, [{ label: "PHP", min: 5 }, { label: "Management", min: 2 }, { label: "Laravel", min: 2 }]);
  assert.equal(jobChecks({ description: draft.description, skills: fixed, salaryMin: 70000, salaryMax: 100000 }).length, 0);
  assert.equal(jobChecks({ description: "", skills: [], salaryMin: 7000, salaryMax: 70000 }).length, 2, "low salary and wide range");
});
