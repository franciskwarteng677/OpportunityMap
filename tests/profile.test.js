import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateProfileCompleteness,
  createEmptyProfile,
  createProfileSummary,
  hasProfile,
  normaliseProfile,
  validateProfile,
} from "../js/profile.js";

const completeProfile = {
  citizenshipCountry: "GH",
  residenceCountry: "KE",
  age: null,
  educationStage: "undergraduate",
  fieldsOfInterest: ["engineering", "computer_science_ai"],
  preferredCategories: ["scholarships", "research_programs"],
  goal: "Build research experience in clean-energy engineering.",
  fundingPreference: "fully_funded",
  mobilityPreference: "travel_and_relocate",
  experienceLevel: "one_to_two_years",
};

test("a complete canonical profile validates without an age", () => {
  const result = validateProfile(completeProfile);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.profile.age, null);
});

test("normalization trims text, canonicalizes country codes, deduplicates arrays, and drops extra fields", () => {
  const result = normaliseProfile({
    ...completeProfile,
    citizenshipCountry: " gh ",
    goal: "  A clear goal.  ",
    fieldsOfInterest: ["engineering", "engineering", "computer_science_ai"],
    privateExtraField: "do not persist",
  });

  assert.equal(result.citizenshipCountry, "GH");
  assert.equal(result.goal, "A clear goal.");
  assert.deepEqual(result.fieldsOfInterest, ["engineering", "computer_science_ai"]);
  assert.equal(Object.hasOwn(result, "privateExtraField"), false);
});

test("an empty submitted profile gets field-addressable errors for every required section", () => {
  const result = validateProfile(createEmptyProfile());
  assert.equal(result.valid, false);

  assert.deepEqual(Object.keys(result.errors).sort(), [
    "citizenshipCountry",
    "educationStage",
    "experienceLevel",
    "fieldsOfInterest",
    "fundingPreference",
    "goal",
    "mobilityPreference",
    "preferredCategories",
    "residenceCountry",
  ].sort());
  assert.equal(Object.hasOwn(result.errors, "age"), false);
});

test("invalid canonical enum and multi-select values are rejected", () => {
  const result = validateProfile({
    ...completeProfile,
    educationStage: "Bachelor student",
    fieldsOfInterest: ["made_up_field"],
    preferredCategories: ["Scholarship"],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.educationStage);
  assert.ok(result.errors.fieldsOfInterest);
  assert.ok(result.errors.preferredCategories);
});

test("age accepts a whole number in range and rejects invalid optional input", () => {
  assert.equal(validateProfile({ ...completeProfile, age: "18" }).valid, true);

  for (const age of [0, 121, 17.5, "not-a-number", true, [18], { value: 18 }, Infinity, Number.NaN]) {
    const result = validateProfile({ ...completeProfile, age });
    assert.equal(result.valid, false);
    assert.ok(result.errors.age);
  }
});

test("goal length is limited for data minimization", () => {
  const result = validateProfile({ ...completeProfile, goal: "a".repeat(501) });
  assert.equal(result.valid, false);
  assert.match(result.errors.goal, /500/);
});

test("completeness counts required sections only", () => {
  const complete = calculateProfileCompleteness(completeProfile);
  const empty = calculateProfileCompleteness(createEmptyProfile());
  const partial = calculateProfileCompleteness({
    ...createEmptyProfile(),
    citizenshipCountry: "GH",
    residenceCountry: "GH",
  });

  assert.deepEqual(complete, { complete: 9, total: 9, percentage: 100, missingFields: [] });
  assert.equal(empty.percentage, 0);
  assert.equal(partial.complete, 2);
  assert.equal(partial.percentage, 22);
});

test("empty storage profiles are distinct from profiles with user data", () => {
  assert.equal(hasProfile({}), false);
  assert.equal(hasProfile(createEmptyProfile()), false);
  assert.equal(hasProfile({ ...createEmptyProfile(), age: 18 }), true);
  assert.equal(hasProfile(completeProfile), true);
});

test("profile summary resolves canonical values into readable labels", () => {
  const summary = createProfileSummary(completeProfile);
  const summaryMap = new Map(summary.map((item) => [item.label, item.value]));

  assert.equal(summaryMap.get("Citizenship"), "Ghana");
  assert.equal(summaryMap.get("Current residence"), "Kenya");
  assert.equal(summaryMap.get("Age"), "Not provided (optional)");
  assert.match(summaryMap.get("Fields of interest"), /Engineering/);
});
