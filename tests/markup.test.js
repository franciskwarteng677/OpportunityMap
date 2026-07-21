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

test("Phase 3 exposes accessible shared save controls and the application dashboard", () => {
  for (const id of [
    "my-applications",
    "applications-title",
    "applications-status",
    "applications-empty",
    "applications-content",
    "applications-overall-progress",
    "applications-list",
    "application-confirm-dialog",
    "custom-task-dialog",
    "application-card-template",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /data-save-opportunity aria-pressed="false"/);
  assert.match(html, /class="card__save-feedback" role="status" aria-live="polite"/);
  assert.match(html, /<progress id="applications-overall-progress"/);
  assert.match(html, /General preparation guidance—not official instructions/);
  assert.match(html, /Saving does not mean that you are eligible/);
});

test("Phase 3 dashboard filters use every canonical application status", () => {
  assert.deepEqual(
    [...html.matchAll(/data-application-filter="([^"]+)"/g)].map((match) => match[1]),
    [
      "all",
      "saved",
      "researching",
      "preparing",
      "ready-to-apply",
      "submitted",
      "outcome-received",
      "archived",
    ],
  );

  assert.match(html, /class="application-card__status-select"/);
  assert.match(html, /data-custom-task-form/);
  assert.match(html, /maxlength="160"\s+data-custom-task-input/);
  assert.match(html, /class="application-notes"[\s\S]*maxlength="2000"/);
  assert.match(html, /data-reset-checklist/);
  assert.match(html, /data-unsave-opportunity/);
});
