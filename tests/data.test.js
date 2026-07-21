import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ELIGIBILITY_STATUSES,
  evaluateEligibility,
  validateEligibilityGuidance,
} from "../js/eligibility.js";
import {
  buildMatchExplanations,
  matchOpportunity,
  rankOpportunityMatches,
  validateMatchingMetadata,
} from "../js/matching.js";

const dataUrl = new URL("../data/opportunities.json", import.meta.url);
const opportunities = JSON.parse(await readFile(dataUrl, "utf8"));

const completeProfile = {
  citizenshipCountry: "GH",
  residenceCountry: "GH",
  age: 20,
  educationStage: "undergraduate",
  fieldsOfInterest: ["computer_science_ai", "engineering"],
  preferredCategories: ["scholarships", "research_programs"],
  goal: "Pursue artificial intelligence and engineering research.",
  fundingPreference: "fully_funded",
  mobilityPreference: "travel_and_relocate",
  experienceLevel: "one_to_two_years",
};

const categoryMap = Object.freeze({
  Scholarships: "scholarships",
  Competitions: "competitions",
  Fellowships: "fellowships",
  "Research Programs": "research_programs",
  "Summer Programs": "summer_programs",
  Internships: "internships",
});

test("the verified inventory remains the same nine unique opportunities", () => {
  assert.equal(opportunities.length, 9);
  assert.deepEqual(
    opportunities.map(({ id }) => id).sort(),
    ["opp-001", "opp-002", "opp-003", "opp-004", "opp-005", "opp-006", "opp-007", "opp-008", "opp-009"],
  );
  assert.equal(new Set(opportunities.map(({ id }) => id)).size, 9);
  assert.ok(opportunities.every(({ verified }) => verified === true));
});

test("all nine records have valid versioned matching and eligibility metadata", () => {
  opportunities.forEach((opportunity) => {
    assert.equal(opportunity.schemaVersion, 2, `${opportunity.id} should use opportunity schema 2`);
    assert.deepEqual(
      validateMatchingMetadata(opportunity),
      [],
      `${opportunity.id} matching metadata should validate`,
    );
    assert.deepEqual(
      validateEligibilityGuidance(opportunity),
      [],
      `${opportunity.id} eligibility guidance should validate`,
    );
  });
});

test("canonical matching categories map exactly from existing display categories", () => {
  opportunities.forEach((opportunity) => {
    assert.ok(Object.hasOwn(categoryMap, opportunity.category), `${opportunity.id} has a known display category`);
    assert.deepEqual(
      opportunity.matching.categories,
      [categoryMap[opportunity.category]],
      `${opportunity.id} should keep display and canonical category values separate but aligned`,
    );
  });
});

test("structured criteria document existing source fields and preserve display records", () => {
  const originalDisplayFields = [
    "title", "category", "country", "region", "eligibleFor", "studentLevel", "field", "fundingType",
    "applicationType", "deadline", "deadlineStatus", "description", "sourceName", "officialUrl", "lastVerified",
  ];

  opportunities.forEach((opportunity) => {
    originalDisplayFields.forEach((field) => {
      assert.equal(typeof opportunity[field], "string", `${opportunity.id}.${field} should remain a display string`);
      assert.ok(opportunity[field].trim(), `${opportunity.id}.${field} should not be empty`);
    });

    Object.values(opportunity.matching.criteriaSources).flat().forEach((sourceField) => {
      assert.ok(Object.hasOwn(opportunity, sourceField), `${opportunity.id} should document a real source field`);
      assert.notEqual(sourceField, "matching", "matching metadata cannot cite itself as evidence");
      assert.notEqual(sourceField, "eligibilityGuidance", "guidance cannot cite itself as evidence");
    });
  });
});

test("all nine opportunities produce well-formed deterministic match results", () => {
  const results = rankOpportunityMatches(opportunities, completeProfile, { view: "all" });
  const repeated = rankOpportunityMatches(opportunities, completeProfile, { view: "all" });

  assert.equal(results.length, 9);
  assert.deepEqual(repeated, results);
  assert.deepEqual(new Set(results.map(({ opportunityId }) => opportunityId)), new Set(opportunities.map(({ id }) => id)));

  results.forEach((result) => {
    assert.ok(Number.isInteger(result.score) && result.score >= 0 && result.score <= 100);
    assert.ok(Number.isInteger(result.confidence.comparedFactors));
    assert.ok(Number.isInteger(result.confidence.availableFactors));
    assert.ok(result.confidence.comparedFactors <= result.confidence.availableFactors);
    assert.ok(result.confidence.availableFactors <= 8);
    assert.equal(result.scoreBreakdown.length, 8);
    assert.ok(result.matchedReasons.length <= 3);
    assert.ok(buildMatchExplanations(result).length >= 2);
    assert.ok(buildMatchExplanations(result).length <= 3);
    for (const field of ["matchedReasons", "mismatchedPreferences", "missingProfileFields", "unknownCriteria"]) {
      assert.ok(Array.isArray(result[field]));
    }

    assert.deepEqual(
      result,
      matchOpportunity(opportunities.find(({ id }) => id === result.opportunityId), completeProfile),
    );
  });
});

test("all nine opportunities produce separate, valid eligibility guidance results", () => {
  opportunities.forEach((opportunity) => {
    const result = evaluateEligibility(opportunity, completeProfile);

    assert.ok(ELIGIBILITY_STATUSES.includes(result.status), `${opportunity.id} should return a supported status`);
    assert.deepEqual(Object.keys(result), [
      "status",
      "confirmedChecks",
      "conflicts",
      "informationNeeded",
      "sourceVerificationNeeded",
    ]);
    for (const field of ["confirmedChecks", "conflicts", "informationNeeded", "sourceVerificationNeeded"]) {
      assert.ok(Array.isArray(result[field]));
      assert.ok(result[field].every((message) => typeof message === "string" && message.trim()));
    }
    assert.equal(Object.hasOwn(result, "score"), false);
  });
});

test("closed records remain represented while the best view ranks actionable records first", () => {
  const best = rankOpportunityMatches(opportunities, completeProfile, { view: "best" });
  const firstClosedIndex = best.findIndex(({ opportunityId }) => (
    opportunities.find(({ id }) => id === opportunityId)?.deadlineStatus === "Closed"
  ));
  const lastActionableIndex = best.findLastIndex(({ opportunityId }) => (
    ["Open", "Upcoming", "Rolling"].includes(
      opportunities.find(({ id }) => id === opportunityId)?.deadlineStatus,
    )
  ));

  assert.equal(best.length, 9);
  assert.equal(firstClosedIndex, 6);
  assert.equal(lastActionableIndex, 5);
  assert.equal(best.filter(({ opportunityId }) => (
    opportunities.find(({ id }) => id === opportunityId)?.deadlineStatus === "Closed"
  )).length, 3);
});
