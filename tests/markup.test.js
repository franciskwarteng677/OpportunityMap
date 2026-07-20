import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

function attributeValues(name) {
  const pattern = new RegExp(`\\b${name}="([^"]+)"`, "g");
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

test("HTML ids are unique", () => {
  const ids = attributeValues("id");
  assert.equal(new Set(ids).size, ids.length);
});

test("local fragment, label, control, and description references resolve", () => {
  const ids = new Set(attributeValues("id"));
  const references = [
    ...attributeValues("href").filter((value) => value.startsWith("#")).map((value) => value.slice(1)),
    ...attributeValues("for"),
    ...attributeValues("aria-controls"),
    ...attributeValues("aria-labelledby").flatMap((value) => value.split(/\s+/)),
    ...attributeValues("aria-describedby").flatMap((value) => value.split(/\s+/)),
  ];

  const missing = references.filter((reference) => reference && !ids.has(reference));
  assert.deepEqual(missing, []);
});

test("the coach uses a module entry point and contains no fictional match score", () => {
  assert.match(html, /<script type="module" src="app\.js"><\/script>/);
  assert.match(html, /id="ai-coach"/);
  assert.match(html, /Create my student profile/);
  assert.doesNotMatch(html, /AI Matching · Coming Soon|Future match|>92%</);
});

test("profile form exposes every Phase 1 field using stable names", () => {
  for (const fieldName of [
    "citizenshipCountry",
    "residenceCountry",
    "age",
    "educationStage",
    "fieldsOfInterest",
    "preferredCategories",
    "goal",
    "fundingPreference",
    "mobilityPreference",
    "experienceLevel",
  ]) {
    assert.match(html, new RegExp(`name="${fieldName}"|id="${fieldName === "fieldsOfInterest" ? "fields-of-interest-options" : fieldName === "preferredCategories" ? "preferred-categories-options" : "__not_generated__"}"`));
  }
});

test("Phase 2 matching markup exposes accessible states, views, and disclosures", () => {
  for (const id of [
    "matching-workspace",
    "matching-profile-required",
    "matching-ready",
    "find-matches",
    "matching-results",
    "matching-status",
    "matching-result-count",
    "matching-grid",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.deepEqual(
    [...html.matchAll(/data-match-view="([^"]+)"/g)].map((match) => match[1]),
    ["best", "all", "actionable", "closed"],
  );
  assert.match(html, /<details class="card__score-disclosure">/);
  assert.match(html, /How this score was calculated/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /Check full current requirements at the official source before applying\./);
});

test("Phase 2 copy distinguishes profile relevance from eligibility and avoids guarantees", () => {
  assert.match(html, /profile-match percentage/i);
  assert.match(html, /not an\s+eligibility, admission, selection, or funding probability/i);
  assert.match(html, /ordinary opportunity directory remains available without a profile/i);
  assert.doesNotMatch(html, /% eligible|you will qualify|guaranteed match|guaranteed admission/i);
});
