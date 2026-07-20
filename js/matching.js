"use strict";

import {
  COUNTRY_CODES,
  EDUCATION_STAGE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  FIELD_OF_INTEREST_OPTIONS,
  FUNDING_PREFERENCE_OPTIONS,
  MOBILITY_PREFERENCE_OPTIONS,
  OPPORTUNITY_CATEGORY_OPTIONS,
  getOptionLabel,
} from "./config.js";

export const MATCHING_SCHEMA_VERSION = 1;

export const MATCHING_WEIGHTS = Object.freeze({
  educationStage: 20,
  fieldsOfInterest: 20,
  preferredCategory: 15,
  geography: 15,
  fundingPreference: 10,
  mobilityPreference: 5,
  experienceLevel: 5,
  goalKeywords: 10,
});

const ACTIONABLE_STATUSES = new Set(["Open", "Rolling"]);
const MATCH_VIEWS = new Set(["best", "all", "actionable", "closed"]);

const AFRICAN_COUNTRY_CODES = Object.freeze([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG",
  "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML",
  "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD",
  "TZ", "TG", "TN", "UG", "ZM", "ZW", "EH",
]);

const WEST_AFRICAN_COUNTRY_CODES = Object.freeze([
  "BJ", "BF", "CV", "CI", "GM", "GH", "GN", "GW", "LR", "ML", "MR", "NE", "NG", "SN", "SL", "TG",
]);

const NORTHERN_AFRICAN_COUNTRY_CODES = new Set(["DZ", "EG", "LY", "MA", "SD", "TN", "EH"]);

export const GEOGRAPHIC_GROUPS = Object.freeze({
  africa_wide: new Set(AFRICAN_COUNTRY_CODES),
  sub_saharan_africa: new Set(AFRICAN_COUNTRY_CODES.filter((code) => !NORTHERN_AFRICAN_COUNTRY_CODES.has(code))),
  west_africa: new Set(WEST_AFRICAN_COUNTRY_CODES),
});

const FACTOR_DEFINITIONS = Object.freeze([
  {
    key: "educationStage",
    label: "Education stage",
    profileField: "educationStage",
    opportunityField: "educationStages",
    unknownMessage: "The opportunity does not have a sufficiently precise education-stage signal for matching.",
  },
  {
    key: "fieldsOfInterest",
    label: "Fields of interest",
    profileField: "fieldsOfInterest",
    opportunityField: "fields",
    unknownMessage: "The opportunity's field is too broad or vacancy-specific for a reliable field comparison.",
  },
  {
    key: "preferredCategory",
    label: "Preferred category",
    profileField: "preferredCategories",
    opportunityField: "categories",
    unknownMessage: "The opportunity does not have a represented category for matching.",
  },
  {
    key: "geography",
    label: "Geographic reach",
    profileField: "citizenshipCountry",
    opportunityField: "geographicReach",
    unknownMessage: "Geographic relevance could not be compared without inferring applicant eligibility.",
  },
  {
    key: "fundingPreference",
    label: "Funding preference",
    profileField: "fundingPreference",
    opportunityField: "fundingPreferences",
    unknownMessage: "The opportunity does not have a represented funding signal for matching.",
  },
  {
    key: "mobilityPreference",
    label: "Travel or relocation preference",
    profileField: "mobilityPreference",
    opportunityField: "mobilityRequired",
    unknownMessage: "Travel or relocation requirements are not sufficiently represented for matching.",
  },
  {
    key: "experienceLevel",
    label: "Experience level",
    profileField: "experienceLevel",
    opportunityField: "experienceLevels",
    unknownMessage: "The opportunity does not have a sufficiently precise experience signal for matching.",
  },
  {
    key: "goalKeywords",
    label: "Career or study goal",
    profileField: "goal",
    opportunityField: "goalKeywords",
    unknownMessage: "The opportunity does not have represented goal themes for matching.",
  },
]);

function normaliseText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values)];
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim());
}

function hasArrayCriterion(metadata, field) {
  return Array.isArray(metadata[field]) && metadata[field].length > 0;
}

function hasOpportunityCriterion(metadata, factor) {
  if (factor.key === "geography") {
    return hasArrayCriterion(metadata, "eligibleNationalities")
      || hasArrayCriterion(metadata, "eligibleResidencies")
      || hasArrayCriterion(metadata, "geographicReach");
  }

  if (factor.key === "mobilityPreference") {
    return typeof metadata.mobilityRequired === "boolean";
  }

  return hasArrayCriterion(metadata, factor.opportunityField);
}

function hasProfileCriterion(profile, factor) {
  const value = profile?.[factor.profileField];

  if (factor.key === "geography") {
    return Boolean(profile?.citizenshipCountry || profile?.residenceCountry);
  }

  if (factor.key === "fundingPreference") {
    return Boolean(value && !["any", "unsure"].includes(value));
  }

  if (factor.key === "mobilityPreference") {
    return Boolean(value && value !== "unsure");
  }

  return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim());
}

function profileFieldLabel(field) {
  const labels = {
    citizenshipCountry: "country of citizenship or residence",
    educationStage: "education stage",
    experienceLevel: "experience level",
    fieldsOfInterest: "fields of interest",
    fundingPreference: "funding preference",
    goal: "career or study goal",
    mobilityPreference: "travel or relocation preference",
    preferredCategories: "preferred opportunity categories",
  };

  return labels[field] || field;
}

function matchGoalKeywords(goal, keywords) {
  const normalisedGoal = ` ${normaliseText(goal)} `;
  if (!normalisedGoal.trim()) return [];

  return keywords.filter((keyword) => {
    const normalisedKeyword = normaliseText(keyword);
    return normalisedKeyword && normalisedGoal.includes(` ${normalisedKeyword} `);
  });
}

function matchesGeography(profile, metadata) {
  const citizenship = profile.citizenshipCountry;
  const residence = profile.residenceCountry;
  const eligibleNationalities = Array.isArray(metadata.eligibleNationalities)
    ? metadata.eligibleNationalities
    : [];
  const eligibleResidencies = Array.isArray(metadata.eligibleResidencies)
    ? metadata.eligibleResidencies
    : [];
  const geographicReach = Array.isArray(metadata.geographicReach)
    ? metadata.geographicReach
    : [];

  if (eligibleNationalities.includes("*") || eligibleNationalities.includes(citizenship)) return true;
  if (eligibleResidencies.includes("*") || eligibleResidencies.includes(residence)) return true;

  return geographicReach.some((reach) => {
    if (reach === "global") return Boolean(citizenship || residence);
    const group = GEOGRAPHIC_GROUPS[reach];
    return Boolean(group?.has(citizenship) || group?.has(residence));
  });
}

function compareFactor(profile, metadata, factor) {
  switch (factor.key) {
    case "educationStage":
      return metadata.educationStages.includes(profile.educationStage);
    case "fieldsOfInterest":
      return profile.fieldsOfInterest.some((field) => metadata.fields.includes(field));
    case "preferredCategory":
      return profile.preferredCategories.some((category) => metadata.categories.includes(category));
    case "geography":
      return matchesGeography(profile, metadata);
    case "fundingPreference":
      return metadata.fundingPreferences.includes(profile.fundingPreference);
    case "mobilityPreference":
      return metadata.mobilityRequired === false || profile.mobilityPreference === "travel_and_relocate";
    case "experienceLevel":
      return metadata.experienceLevels.includes(profile.experienceLevel);
    case "goalKeywords":
      return matchGoalKeywords(profile.goal, metadata.goalKeywords).length > 0;
    default:
      return false;
  }
}

function matchedReason(profile, metadata, factor) {
  switch (factor.key) {
    case "educationStage":
      return "Your current stage aligns with the opportunity's represented student level.";
    case "fieldsOfInterest": {
      const field = profile.fieldsOfInterest.find((value) => metadata.fields.includes(value));
      return `Your interest in ${getOptionLabel(FIELD_OF_INTEREST_OPTIONS, field).toLowerCase()} aligns with its represented field.`;
    }
    case "preferredCategory": {
      const category = profile.preferredCategories.find((value) => metadata.categories.includes(value));
      return `Its category — ${getOptionLabel(OPPORTUNITY_CATEGORY_OPTIONS, category).toLowerCase()} — is one of your preferences.`;
    }
    case "geography":
      return "Its represented geographic reach aligns with your citizenship or residence profile.";
    case "fundingPreference":
      return "Its represented funding type aligns with your stated funding preference.";
    case "mobilityPreference":
      return "Your travel preference aligns with the represented mobility signal.";
    case "experienceLevel":
      return "Your experience level aligns with the opportunity's represented audience.";
    case "goalKeywords": {
      const keywords = matchGoalKeywords(profile.goal, metadata.goalKeywords).slice(0, 2);
      return `Your goal shares represented themes: ${keywords.join(" and ")}.`;
    }
    default:
      return "A represented profile factor aligns with this opportunity.";
  }
}

function mismatchReason(factor) {
  const messages = {
    educationStage: "Its represented student level does not align with your current stage.",
    fieldsOfInterest: "Its represented field does not overlap with your selected interests.",
    preferredCategory: "Its category is outside your selected opportunity preferences.",
    geography: "Its represented geographic reach does not align with your citizenship or residence profile.",
    fundingPreference: "Its represented funding type does not align with your stated funding preference.",
    mobilityPreference: "Its represented mobility signal does not align with your travel preference.",
    experienceLevel: "Its represented experience audience does not align with your experience level.",
    goalKeywords: "Its represented themes do not overlap with the wording of your current goal.",
  };

  return messages[factor.key];
}

export function matchOpportunity(opportunity, profile = {}) {
  const metadata = isPlainObject(opportunity?.matching) ? opportunity.matching : {};
  const matchedReasons = [];
  const mismatchedPreferences = [];
  const missingProfileFields = [];
  const unknownCriteria = [];
  const scoreBreakdown = [];
  let availableFactors = 0;
  let comparedFactors = 0;
  let comparedWeight = 0;
  let earnedWeight = 0;

  FACTOR_DEFINITIONS.forEach((factor) => {
    const weight = MATCHING_WEIGHTS[factor.key];

    if (!hasOpportunityCriterion(metadata, factor)) {
      unknownCriteria.push(factor.unknownMessage);
      scoreBreakdown.push({
        factor: factor.key,
        label: factor.label,
        weight,
        state: "unknown-opportunity",
        earnedWeight: 0,
        message: factor.unknownMessage,
      });
      return;
    }

    availableFactors += 1;

    if (!hasProfileCriterion(profile, factor)) {
      missingProfileFields.push(factor.profileField);
      const message = `Add or refine your ${profileFieldLabel(factor.profileField)} to compare this factor.`;
      scoreBreakdown.push({
        factor: factor.key,
        label: factor.label,
        weight,
        state: "missing-profile",
        earnedWeight: 0,
        message,
      });
      return;
    }

    comparedFactors += 1;
    comparedWeight += weight;
    const matches = compareFactor(profile, metadata, factor);
    const message = matches ? matchedReason(profile, metadata, factor) : mismatchReason(factor);

    if (matches) {
      earnedWeight += weight;
      matchedReasons.push(message);
    } else {
      mismatchedPreferences.push(message);
    }

    scoreBreakdown.push({
      factor: factor.key,
      label: factor.label,
      weight,
      state: matches ? "matched" : "mismatched",
      earnedWeight: matches ? weight : 0,
      message,
    });
  });

  return {
    opportunityId: String(opportunity?.id ?? ""),
    score: comparedWeight ? Math.round((earnedWeight / comparedWeight) * 100) : 0,
    confidence: { comparedFactors, availableFactors },
    matchedReasons: matchedReasons.slice(0, 3),
    mismatchedPreferences,
    missingProfileFields: unique(missingProfileFields),
    unknownCriteria,
    scoreBreakdown,
    earnedWeight,
    comparedWeight,
  };
}

export function buildMatchExplanations(match) {
  const minimum = 2;
  const maximum = 3;
  const explanations = [];
  const addUnique = (message) => {
    if (typeof message === "string" && message.trim() && !explanations.includes(message)) {
      explanations.push(message);
    }
  };

  (Array.isArray(match?.matchedReasons) ? match.matchedReasons : []).forEach(addUnique);

  const supplemental = [
    ...(Array.isArray(match?.mismatchedPreferences) ? match.mismatchedPreferences : [])
      .map((message) => `Preference difference: ${message}`),
    ...(Array.isArray(match?.scoreBreakdown) ? match.scoreBreakdown : [])
      .filter(({ state }) => state === "missing-profile")
      .map(({ message }) => `Profile detail not compared: ${message}`),
    ...(Array.isArray(match?.unknownCriteria) ? match.unknownCriteria : [])
      .map((message) => `Not compared: ${message}`),
  ];

  supplemental.forEach((message) => {
    if (explanations.length < maximum) addUnique(message);
  });

  if (!explanations.length) {
    addUnique("No represented preference produced a positive match; review the comparison details below.");
  }
  if (explanations.length < minimum) {
    addUnique("Limited represented information was available for this comparison.");
  }

  return explanations.slice(0, maximum);
}

function actionabilityTier(deadlineStatus) {
  if (ACTIONABLE_STATUSES.has(deadlineStatus)) return 0;
  if (deadlineStatus === "Closed") return 2;
  return 1;
}

function compareIds(a, b) {
  if (a.opportunityId === b.opportunityId) return 0;
  return a.opportunityId < b.opportunityId ? -1 : 1;
}

export function rankOpportunityMatches(opportunities, profile = {}, { view = "best" } = {}) {
  const safeView = MATCH_VIEWS.has(view) ? view : "best";
  const records = Array.isArray(opportunities) ? opportunities : [];
  const statuses = new Map(records.map((opportunity) => [opportunity.id, opportunity.deadlineStatus]));
  let results = records.map((opportunity) => matchOpportunity(opportunity, profile));

  if (safeView === "actionable") {
    results = results.filter((result) => ACTIONABLE_STATUSES.has(statuses.get(result.opportunityId)));
  } else if (safeView === "closed") {
    results = results.filter((result) => statuses.get(result.opportunityId) === "Closed");
  }

  return results.sort((a, b) => {
    const aStatus = statuses.get(a.opportunityId);
    const bStatus = statuses.get(b.opportunityId);

    if (safeView === "best") {
      const tierDifference = actionabilityTier(aStatus) - actionabilityTier(bStatus);
      if (tierDifference) return tierDifference;
    }

    const scoreDifference = b.score - a.score;
    if (scoreDifference) return scoreDifference;

    if (safeView === "all") {
      const tierDifference = actionabilityTier(aStatus) - actionabilityTier(bStatus);
      if (tierDifference) return tierDifference;
    }

    const confidenceDifference = b.confidence.comparedFactors - a.confidence.comparedFactors;
    return confidenceDifference || compareIds(a, b);
  });
}

export function validateMatchingMetadata(opportunity) {
  const errors = [];
  const metadata = opportunity?.matching;
  const sourcedCriteria = [
    "educationStages", "fields", "categories", "eligibleNationalities", "eligibleResidencies", "geographicReach",
    "fundingPreferences", "mobilityRequired", "experienceLevels", "minAge", "maxAge", "goalKeywords",
  ];
  const supportedSourceCriteria = new Set(sourcedCriteria);
  const allowedValues = {
    educationStages: new Set(EDUCATION_STAGE_OPTIONS.map(({ value }) => value)),
    fields: new Set(FIELD_OF_INTEREST_OPTIONS.map(({ value }) => value)),
    categories: new Set(OPPORTUNITY_CATEGORY_OPTIONS.map(({ value }) => value)),
    fundingPreferences: new Set(FUNDING_PREFERENCE_OPTIONS.map(({ value }) => value)),
    experienceLevels: new Set(EXPERIENCE_LEVEL_OPTIONS.map(({ value }) => value)),
    geographicReach: new Set(["global", ...Object.keys(GEOGRAPHIC_GROUPS)]),
  };

  if (!isPlainObject(metadata)) return ["matching must be an object"];
  if (metadata.schemaVersion !== MATCHING_SCHEMA_VERSION) errors.push(`matching.schemaVersion must be ${MATCHING_SCHEMA_VERSION}`);

  [
    "educationStages", "fields", "categories", "eligibleNationalities", "eligibleResidencies", "geographicReach",
    "fundingPreferences", "experienceLevels", "goalKeywords",
  ].forEach((field) => {
    if (!isNonEmptyStringArray(metadata[field])) errors.push(`matching.${field} must be a string array`);
  });

  Object.entries(allowedValues).forEach(([field, allowed]) => {
    if (Array.isArray(metadata[field]) && metadata[field].some((value) => !allowed.has(value))) {
      errors.push(`matching.${field} contains an unsupported canonical value`);
    }
  });

  ["eligibleNationalities", "eligibleResidencies"].forEach((field) => {
    if (Array.isArray(metadata[field]) && metadata[field].some((value) => value !== "*" && !COUNTRY_CODES.includes(value))) {
      errors.push(`matching.${field} contains an unsupported country code`);
    }
  });

  if (metadata.mobilityRequired !== null && typeof metadata.mobilityRequired !== "boolean") {
    errors.push("matching.mobilityRequired must be boolean or null");
  }

  ["minAge", "maxAge"].forEach((field) => {
    if (metadata[field] !== null && (!Number.isInteger(metadata[field]) || metadata[field] < 1)) {
      errors.push(`matching.${field} must be a positive integer or null`);
    }
  });

  if (Number.isInteger(metadata.minAge) && Number.isInteger(metadata.maxAge) && metadata.minAge > metadata.maxAge) {
    errors.push("matching.minAge cannot exceed matching.maxAge");
  }

  if (!isPlainObject(metadata.criteriaSources)) {
    errors.push("matching.criteriaSources must be an object");
  } else {
    Object.entries(metadata.criteriaSources).forEach(([criterion, sourceFields]) => {
      if (!supportedSourceCriteria.has(criterion)) {
        errors.push(`matching.criteriaSources.${criterion} is not a supported matching criterion`);
      }
      if (!Array.isArray(sourceFields) || !sourceFields.length
        || sourceFields.some((field) => !Object.hasOwn(opportunity, field))) {
        errors.push(`matching.criteriaSources.${criterion} must reference existing opportunity fields`);
      }
    });

    sourcedCriteria.forEach((criterion) => {
      const value = metadata[criterion];
      const isRepresented = Array.isArray(value)
        ? value.length > 0
        : value !== null && value !== undefined;
      if (isRepresented && !metadata.criteriaSources[criterion]?.length) {
        errors.push(`matching.criteriaSources.${criterion} is required for represented metadata`);
      }
    });
  }

  return errors;
}
