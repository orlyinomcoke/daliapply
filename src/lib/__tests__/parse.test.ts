// Run: node --experimental-strip-types --test src/lib/__tests__/parse.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractResumeText, parseSearchText } from "../parse.ts";

const RESUME = `ORLY BONDOC
Senior PHP Developer
Makati, Metro Manila, Philippines | orly@example.com | +63 917 123 4567

EXPERIENCE
Team Lead, Acme Corp
Jan 2022 - Present
Led a team of 5 developers building Laravel and PHP services on AWS. Leadership and hiring.

PHP Developer, Beta Inc
Mar 2018 – Dec 2021
Built PHP and MySQL apps, REST APIs and some React front ends.

SKILLS
PHP, Laravel, MySQL, React, AWS, Git
Languages: English, Filipino
Expected salary: PHP 80,000 - 100,000`;

const NOW = new Date(2026, 10, 9);

test("reads a resume", () => {
  const p = extractResumeText(RESUME, NOW);
  assert.equal(p.first_name, "Orly");
  assert.equal(p.last_name, "Bondoc");
  assert.equal(p.headline, "Senior PHP Developer");
  assert.equal(p.country, "PH");
  assert.deepEqual(p.languages.sort(), ["english", "filipino"]);
  assert.equal(p.salary_min, 80000);
  assert.equal(p.salary_max, 100000);
  assert.ok(p.total_years >= 8.5 && p.total_years <= 9, `total ${p.total_years}`);
  const php = p.skills.find((s) => s.skill === "PHP");
  assert.ok(php && php.years >= 8.5, `php ${php?.years}`);
  const mgmt = p.skills.find((s) => s.skill === "Management");
  assert.ok(mgmt && mgmt.years >= 4.5 && mgmt.years <= 5, `mgmt ${mgmt?.years}`);
  assert.ok(!p.resume_text.includes("orly@example.com"));
  assert.ok(!p.resume_text.includes("917 123 4567"));
  assert.equal(p.recent_roles[0].title, "Team Lead, Acme Corp");
});

test("parses the plan's example search", () => {
  const f = parseSearchText("programmer with 5 years experience in management and PHP");
  assert.equal(f.role, "programmer");
  assert.deepEqual(f.skills.sort((a, b) => a.skill.localeCompare(b.skill)), [
    { skill: "management", min_years: 5 },
    { skill: "php", min_years: 5 },
  ]);
});

test("pairs years with the nearest skill and reads extras", () => {
  const f = parseSearchText("React developer, 3 yrs React and 1 year AWS, remote, 80k+");
  assert.equal(f.skills.find((s) => s.skill === "react")?.min_years, 3);
  assert.equal(f.skills.find((s) => s.skill === "aws")?.min_years, 1);
  assert.equal(f.remote, true);
  assert.equal(f.salary_min, 80000);
});

test("does not see Java inside JavaScript or C inside words", () => {
  const f = parseSearchText("JavaScript developer");
  assert.deepEqual(f.skills.map((s) => s.skill), ["javascript"]);
});
