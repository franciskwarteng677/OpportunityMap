import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEligibility } from "../js/eligibility.js";
import { matchOpportunity } from "../js/matching.js";

function createOpportunity({
  representedRequirements = [],
  unrepresentedRequirements = [],
  matching = {},
} = {}) {
  return {
    id: "eligibility-test",
    eligibleFor: "Fixture eligibility description",
    studentLevel: "Fixture student level",
    matching: {
      schemaVersion: 1,
      educationStages: [],
      fields: [],
      categories: [],
      eligibleNationalities: [],
      eligibleResidencies: [],
      geographicReach: [],
      fundingPreferences: [],
      mobilityRequired: null,
      experienceLevels: [],
      minAge: null,
      maxAge: null,
      goalKeywords: [],
      criteriaSources: {},
      ...matching,
    },
    eligibilityGuidance: {
      schemaVersion: 1,
      representedRequirements,
      unrepresentedRequirements,
    },
  };
}

const ageRequirement = Object.freeze({
  id: "age",
  type: "age_range",
  verified: true,
  minAge: 14,
  maxAge: 18,
  description: "Applicants must be aged 14–18.",
  sourceField: "eligibleFor",
});

const educationRequirement = Object.freeze({
  id: "stage",
  type: "education_stage",
  verified: true,
  allowedValues: ["secondary_school"],
  description: "Applicants must attend secondary school.",
  sourceField: "studentLevel",
});

test("all represented verified hard requirements matching produces confirmed-fit", () => {
  const opportunity = createOpportunity({
    representedRequirements: [ageRequirement, educationRequirement],
  });

  const result = evaluateEligibility(opportunity, { age: 16, educationStage: "secondary_school" });

  assert.equal(result.status, "confirmed-fit");
  assert.equal(result.confirmedChecks.length, 2);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.informationNeeded, []);
  assert.deepEqual(result.sourceVerificationNeeded, []);
});

test("an explicit verified hard conflict produces known-conflict", () => {
  const opportunity = createOpportunity({ representedRequirements: [ageRequirement, educationRequirement] });
  const result = evaluateEligibility(opportunity, { age: 19, educationStage: "undergraduate" });

  assert.equal(result.status, "known-conflict");
  assert.equal(result.conflicts.length, 2);
  assert.match(result.conflicts[0], /age range/i);
});

test("missing profile information required for a represented check produces information-needed", () => {
  const opportunity = createOpportunity({ representedRequirements: [ageRequirement, educationRequirement] });
  const result = evaluateEligibility(opportunity, { educationStage: "secondary_school" });

  assert.equal(result.status, "information-needed");
  assert.equal(result.confirmedChecks.length, 1);
  assert.equal(result.informationNeeded.length, 1);
  assert.match(result.informationNeeded[0], /add your age/i);
});

test("age conflicts are reported only when an explicit verified age requirement exists", () => {
  const matchingAgeOnly = createOpportunity({
    matching: { minAge: 18, maxAge: 25 },
    unrepresentedRequirements: [{
      description: "Current requirements need source verification.",
      sourceField: "eligibleFor",
    }],
  });
  const verifiedAge = createOpportunity({ representedRequirements: [ageRequirement] });

  const withoutHardAge = evaluateEligibility(matchingAgeOnly, { age: 12 });
  const withHardAge = evaluateEligibility(verifiedAge, { age: 12 });

  assert.equal(withoutHardAge.status, "verify-at-source");
  assert.deepEqual(withoutHardAge.conflicts, []);
  assert.equal(withHardAge.status, "known-conflict");
  assert.equal(withHardAge.conflicts.length, 1);
});

test("unknown or unrepresented requirements produce verify-at-source rather than passing", () => {
  const empty = evaluateEligibility(createOpportunity(), {});
  const unrepresented = evaluateEligibility(createOpportunity({
    unrepresentedRequirements: [{
      description: "A degree requirement is not represented.",
      sourceField: "eligibleFor",
    }],
  }), {});

  assert.equal(empty.status, "verify-at-source");
  assert.equal(empty.sourceVerificationNeeded.length, 1);
  assert.equal(unrepresented.status, "verify-at-source");
  assert.equal(unrepresented.sourceVerificationNeeded.length, 1);
  assert.deepEqual(unrepresented.confirmedChecks, []);
});

test("known conflicts take precedence over missing and unknown checks", () => {
  const opportunity = createOpportunity({
    representedRequirements: [ageRequirement, educationRequirement],
    unrepresentedRequirements: [{
      description: "Another requirement must be verified.",
      sourceField: "eligibleFor",
    }],
  });

  const result = evaluateEligibility(opportunity, { age: 25 });

  assert.equal(result.status, "known-conflict");
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.informationNeeded.length, 1);
  assert.equal(result.sourceVerificationNeeded.length, 1);
});

test("minimum experience distinguishes conflicts, overlap, missing data, and confirmed checks", () => {
  const experienceRequirement = {
    id: "experience",
    type: "minimum_experience",
    verified: true,
    minimumYears: 2,
    description: "At least two years of relevant experience are required.",
    sourceField: "eligibleFor",
  };
  const opportunity = createOpportunity({ representedRequirements: [experienceRequirement] });

  assert.equal(evaluateEligibility(opportunity, { experienceLevel: "under_one_year" }).status, "known-conflict");
  assert.equal(evaluateEligibility(opportunity, { experienceLevel: "one_to_two_years" }).status, "information-needed");
  assert.equal(evaluateEligibility(opportunity, { experienceLevel: "three_to_five_years" }).status, "confirmed-fit");
  assert.equal(evaluateEligibility(opportunity, {}).status, "information-needed");
});

test("profile-match relevance remains separate from eligibility status", () => {
  const opportunity = createOpportunity({
    representedRequirements: [ageRequirement],
    matching: { educationStages: ["undergraduate"] },
  });
  const profile = { age: 25, educationStage: "undergraduate" };

  const relevance = matchOpportunity(opportunity, profile);
  const eligibility = evaluateEligibility(opportunity, profile);

  assert.equal(relevance.score, 100);
  assert.equal(eligibility.status, "known-conflict");
  assert.equal(Object.hasOwn(relevance, "status"), false);
  assert.equal(Object.hasOwn(eligibility, "score"), false);
});

test("empty or unsupported eligibility guidance fails safely with source verification", () => {
  for (const opportunity of [{}, { eligibilityGuidance: null }, { eligibilityGuidance: [] }]) {
    const result = evaluateEligibility(opportunity, {});
    assert.equal(result.status, "verify-at-source");
    assert.equal(result.sourceVerificationNeeded.length, 1);
    assert.deepEqual(result.conflicts, []);
  }
});
