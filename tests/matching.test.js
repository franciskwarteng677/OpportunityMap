import assert from "node:assert/strict";
import test from "node:test";

import {
  MATCHING_WEIGHTS,
  buildMatchExplanations,
  matchOpportunity,
  rankOpportunityMatches,
} from "../js/matching.js";

const completeProfile = Object.freeze({
  citizenshipCountry: "GH",
  residenceCountry: "GH",
  age: 18,
  educationStage: "undergraduate",
  fieldsOfInterest: ["computer_science_ai", "engineering"],
  preferredCategories: ["research_programs", "scholarships"],
  goal: "Build an AI research career in engineering.",
  fundingPreference: "fully_funded",
  mobilityPreference: "travel_and_relocate",
  experienceLevel: "one_to_two_years",
});

function createOpportunity({
  id = "test-opportunity",
  deadlineStatus = "Open",
  matching = {},
} = {}) {
  return {
    id,
    deadlineStatus,
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
  };
}

test("an exact comparison produces a 100% profile match across all eight factors", () => {
  const opportunity = createOpportunity({
    matching: {
      educationStages: ["undergraduate"],
      fields: ["computer_science_ai"],
      categories: ["research_programs"],
      geographicReach: ["west_africa"],
      fundingPreferences: ["fully_funded"],
      mobilityRequired: true,
      experienceLevels: ["one_to_two_years"],
      goalKeywords: ["ai", "research"],
    },
  });

  const result = matchOpportunity(opportunity, completeProfile);

  assert.equal(result.score, 100);
  assert.deepEqual(result.confidence, { comparedFactors: 8, availableFactors: 8 });
  assert.equal(result.comparedWeight, 100);
  assert.equal(result.earnedWeight, 100);
  assert.equal(result.mismatchedPreferences.length, 0);
  assert.equal(result.missingProfileFields.length, 0);
  assert.equal(result.unknownCriteria.length, 0);
  assert.equal(result.matchedReasons.length, 3, "card reasons are intentionally limited to three");
});

test("partial matches use the documented weights for represented comparable factors", () => {
  const opportunity = createOpportunity({
    matching: {
      educationStages: ["undergraduate"],
      fields: ["law_policy"],
      categories: ["research_programs"],
      fundingPreferences: ["some_funding"],
    },
  });

  const result = matchOpportunity(opportunity, completeProfile);

  // Education (20) and category (15) match. Field (20) and funding (10)
  // do not: 35 / 65 = 53.84, rounded to 54.
  assert.equal(result.score, 54);
  assert.equal(result.earnedWeight, MATCHING_WEIGHTS.educationStage + MATCHING_WEIGHTS.preferredCategory);
  assert.equal(
    result.comparedWeight,
    MATCHING_WEIGHTS.educationStage
      + MATCHING_WEIGHTS.fieldsOfInterest
      + MATCHING_WEIGHTS.preferredCategory
      + MATCHING_WEIGHTS.fundingPreference,
  );
  assert.deepEqual(result.confidence, { comparedFactors: 4, availableFactors: 4 });
  assert.equal(result.mismatchedPreferences.length, 2);
  assert.equal(result.unknownCriteria.length, 4);
});

test("unknown opportunity criteria are excluded from the score denominator", () => {
  const opportunity = createOpportunity({
    matching: {
      educationStages: ["undergraduate"],
      fields: ["law_policy"],
    },
  });

  const result = matchOpportunity(opportunity, completeProfile);

  assert.equal(result.earnedWeight, 20);
  assert.equal(result.comparedWeight, 40);
  assert.equal(result.score, 50);
  assert.deepEqual(result.confidence, { comparedFactors: 2, availableFactors: 2 });
  assert.equal(result.unknownCriteria.length, 6);
  assert.equal(
    result.scoreBreakdown.filter(({ state }) => state === "unknown-opportunity").length,
    6,
  );
});

test("missing profile information is reported and excluded from the denominator", () => {
  const opportunity = createOpportunity({
    matching: {
      educationStages: ["undergraduate"],
      fields: ["engineering"],
      categories: ["scholarships"],
      geographicReach: ["global"],
      fundingPreferences: ["fully_funded"],
      mobilityRequired: false,
      experienceLevels: ["none"],
      goalKeywords: ["research"],
    },
  });

  const result = matchOpportunity(opportunity, {});

  assert.equal(result.score, 0);
  assert.equal(result.comparedWeight, 0);
  assert.deepEqual(result.confidence, { comparedFactors: 0, availableFactors: 8 });
  assert.deepEqual(new Set(result.missingProfileFields), new Set([
    "citizenshipCountry",
    "educationStage",
    "experienceLevel",
    "fieldsOfInterest",
    "fundingPreference",
    "goal",
    "mobilityPreference",
    "preferredCategories",
  ]));
  assert.equal(result.unknownCriteria.length, 0);
});

test("neutral preference values are treated as missing comparisons, not failures", () => {
  const opportunity = createOpportunity({
    matching: {
      fundingPreferences: ["fully_funded"],
      mobilityRequired: true,
    },
  });
  const profile = {
    ...completeProfile,
    fundingPreference: "any",
    mobilityPreference: "unsure",
  };

  const result = matchOpportunity(opportunity, profile);

  assert.equal(result.score, 0);
  assert.equal(result.comparedWeight, 0);
  assert.deepEqual(result.confidence, { comparedFactors: 0, availableFactors: 2 });
  assert.deepEqual(result.missingProfileFields.sort(), ["fundingPreference", "mobilityPreference"]);
});

test("travel-only preferences do not assume an unknown relocation requirement is suitable", () => {
  const opportunity = createOpportunity({ matching: { mobilityRequired: true } });
  const travelOnly = matchOpportunity(opportunity, { mobilityPreference: "travel_only" });
  const travelAndRelocate = matchOpportunity(opportunity, { mobilityPreference: "travel_and_relocate" });

  assert.equal(travelOnly.score, 0);
  assert.equal(travelAndRelocate.score, 100);
});

test("ranking explanations lead with matches and add clearly labelled caveats when evidence is limited", () => {
  const opportunity = createOpportunity({
    matching: {
      educationStages: ["undergraduate"],
      fields: ["law_policy"],
    },
  });
  const result = matchOpportunity(opportunity, completeProfile);
  const explanations = buildMatchExplanations(result);

  assert.equal(explanations.length, 3);
  assert.equal(explanations[0], result.matchedReasons[0]);
  assert.match(explanations[1], /^Preference difference:/);
  assert.match(explanations[2], /^Not compared:/);
});

test("goal keywords use normalized whole words rather than substring matches", () => {
  const opportunity = createOpportunity({ matching: { goalKeywords: ["ai"] } });

  const substringOnly = matchOpportunity(opportunity, { goal: "I want to train as a researcher." });
  const exactWord = matchOpportunity(opportunity, { goal: "I want to research AI." });

  assert.equal(substringOnly.score, 0, "the letters in 'train' must not count as AI");
  assert.equal(exactWord.score, 100);
});

test("canonical country codes map deterministically to represented geographic groups", () => {
  const westAfrica = createOpportunity({ matching: { geographicReach: ["west_africa"] } });

  assert.equal(matchOpportunity(westAfrica, { citizenshipCountry: "GH" }).score, 100);
  assert.equal(matchOpportunity(westAfrica, { residenceCountry: "SN" }).score, 100);
  assert.equal(matchOpportunity(westAfrica, { citizenshipCountry: "KE" }).score, 0);
});

test("best-match ordering keeps actionable opportunities above closed opportunities", () => {
  const closedPerfect = createOpportunity({
    id: "closed-perfect",
    deadlineStatus: "Closed",
    matching: { educationStages: ["undergraduate"] },
  });
  const openMismatch = createOpportunity({
    id: "open-mismatch",
    deadlineStatus: "Open",
    matching: { educationStages: ["doctoral"] },
  });

  const best = rankOpportunityMatches([closedPerfect, openMismatch], completeProfile, { view: "best" });
  const all = rankOpportunityMatches([closedPerfect, openMismatch], completeProfile, { view: "all" });

  assert.deepEqual(best.map(({ opportunityId }) => opportunityId), ["open-mismatch", "closed-perfect"]);
  assert.deepEqual(all.map(({ opportunityId }) => opportunityId), ["closed-perfect", "open-mismatch"]);
});

test("view filters expose actionable and closed records without silently dropping them from all", () => {
  const records = [
    createOpportunity({ id: "open", deadlineStatus: "Open" }),
    createOpportunity({ id: "upcoming", deadlineStatus: "Upcoming" }),
    createOpportunity({ id: "rolling", deadlineStatus: "Rolling" }),
    createOpportunity({ id: "closed", deadlineStatus: "Closed" }),
  ];

  assert.deepEqual(
    rankOpportunityMatches(records, completeProfile, { view: "actionable" }).map(({ opportunityId }) => opportunityId),
    ["open", "rolling"],
  );
  assert.deepEqual(
    rankOpportunityMatches(records, completeProfile, { view: "closed" }).map(({ opportunityId }) => opportunityId),
    ["closed"],
  );
  assert.equal(rankOpportunityMatches(records, completeProfile, { view: "all" }).length, 4);
});

test("equal matches use opportunity id as a stable deterministic tie-breaker", () => {
  const firstInput = [
    createOpportunity({ id: "opp-z" }),
    createOpportunity({ id: "opp-a" }),
    createOpportunity({ id: "opp-m" }),
  ];
  const secondInput = [...firstInput].reverse();

  const first = rankOpportunityMatches(firstInput, completeProfile, { view: "all" });
  const second = rankOpportunityMatches(secondInput, completeProfile, { view: "all" });

  assert.deepEqual(first.map(({ opportunityId }) => opportunityId), ["opp-a", "opp-m", "opp-z"]);
  assert.deepEqual(second, first);
  assert.deepEqual(firstInput.map(({ id }) => id), ["opp-z", "opp-a", "opp-m"], "input is not reordered");
});

test("invalid or empty opportunity input returns a safe deterministic result", () => {
  assert.deepEqual(rankOpportunityMatches(undefined, completeProfile), []);

  const result = matchOpportunity({}, completeProfile);
  assert.equal(result.opportunityId, "");
  assert.equal(result.score, 0);
  assert.deepEqual(result.confidence, { comparedFactors: 0, availableFactors: 0 });
  assert.equal(result.unknownCriteria.length, 8);
});
