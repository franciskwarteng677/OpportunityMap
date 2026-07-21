"use strict";

import { EDUCATION_STAGE_OPTIONS, EXPERIENCE_LEVEL_OPTIONS, getOptionLabel } from "./config.js";

export const ELIGIBILITY_SCHEMA_VERSION = 1;

export const ELIGIBILITY_STATUSES = Object.freeze([
  "confirmed-fit",
  "known-conflict",
  "information-needed",
  "verify-at-source",
]);

const EXPERIENCE_RANGES = Object.freeze({
  none: { minimum: 0, maximum: 0 },
  under_one_year: { minimum: 0, maximum: 0.99 },
  one_to_two_years: { minimum: 1, maximum: 2 },
  three_to_five_years: { minimum: 3, maximum: 5 },
  over_five_years: { minimum: 6, maximum: Number.POSITIVE_INFINITY },
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function evaluateAgeRequirement(requirement, profile, result) {
  const age = profile?.age;

  if (!Number.isInteger(age)) {
    result.informationNeeded.push(`Add your age to check: ${requirement.description}`);
    return;
  }

  const belowMinimum = Number.isInteger(requirement.minAge) && age < requirement.minAge;
  const aboveMaximum = Number.isInteger(requirement.maxAge) && age > requirement.maxAge;

  if (belowMinimum || aboveMaximum) {
    result.conflicts.push(`Your profile age does not meet the represented age range: ${requirement.description}`);
  } else {
    result.confirmedChecks.push(`Your profile age matches the represented age range: ${requirement.description}`);
  }
}

function evaluateEducationRequirement(requirement, profile, result) {
  const stage = profile?.educationStage;
  const allowedValues = Array.isArray(requirement.allowedValues) ? requirement.allowedValues : [];

  if (!stage) {
    result.informationNeeded.push(`Add your education stage to check: ${requirement.description}`);
  } else if (allowedValues.includes(stage)) {
    result.confirmedChecks.push(
      `${getOptionLabel(EDUCATION_STAGE_OPTIONS, stage)} matches the represented education-stage requirement.`,
    );
  } else {
    result.conflicts.push(`Your education stage conflicts with the represented requirement: ${requirement.description}`);
  }
}

function evaluateExperienceRequirement(requirement, profile, result) {
  const level = profile?.experienceLevel;
  const range = EXPERIENCE_RANGES[level];

  if (!range) {
    result.informationNeeded.push(`Add your experience level to check: ${requirement.description}`);
  } else if (range.maximum < requirement.minimumYears) {
    result.conflicts.push(`Your experience range is below the represented minimum: ${requirement.description}`);
  } else if (range.minimum >= requirement.minimumYears) {
    result.confirmedChecks.push(
      `${getOptionLabel(EXPERIENCE_LEVEL_OPTIONS, level)} meets the represented minimum experience check.`,
    );
  } else {
    result.informationNeeded.push(
      `Your selected experience range overlaps the requirement; confirm your exact experience: ${requirement.description}`,
    );
  }
}

export function evaluateEligibility(opportunity, profile = {}) {
  const guidance = isPlainObject(opportunity?.eligibilityGuidance) ? opportunity.eligibilityGuidance : {};
  const requirements = Array.isArray(guidance.representedRequirements) ? guidance.representedRequirements : [];
  const unrepresented = Array.isArray(guidance.unrepresentedRequirements) ? guidance.unrepresentedRequirements : [];
  const result = {
    status: "verify-at-source",
    confirmedChecks: [],
    conflicts: [],
    informationNeeded: [],
    sourceVerificationNeeded: [],
  };

  requirements.forEach((requirement) => {
    if (!requirement?.verified) {
      result.sourceVerificationNeeded.push(`${requirement?.description || "A requirement"} is not represented as verified.`);
      return;
    }

    if (requirement.type === "age_range") {
      evaluateAgeRequirement(requirement, profile, result);
    } else if (requirement.type === "education_stage") {
      evaluateEducationRequirement(requirement, profile, result);
    } else if (requirement.type === "minimum_experience") {
      evaluateExperienceRequirement(requirement, profile, result);
    } else {
      result.sourceVerificationNeeded.push(`This represented check must be verified at the source: ${requirement.description}`);
    }
  });

  unrepresented.forEach((requirement) => {
    const description = typeof requirement?.description === "string"
      ? requirement.description
      : "Additional current requirements are not structured in the directory.";
    result.sourceVerificationNeeded.push(description);
  });

  if (!requirements.length && !result.sourceVerificationNeeded.length) {
    result.sourceVerificationNeeded.push("The directory does not contain enough structured requirements for an eligibility determination.");
  }

  if (result.conflicts.length) {
    result.status = "known-conflict";
  } else if (result.informationNeeded.length) {
    result.status = "information-needed";
  } else if (result.sourceVerificationNeeded.length) {
    result.status = "verify-at-source";
  } else if (requirements.length && result.confirmedChecks.length === requirements.length) {
    result.status = "confirmed-fit";
  }

  return result;
}

export function validateEligibilityGuidance(opportunity) {
  const errors = [];
  const guidance = opportunity?.eligibilityGuidance;

  if (!isPlainObject(guidance)) return ["eligibilityGuidance must be an object"];
  if (guidance.schemaVersion !== ELIGIBILITY_SCHEMA_VERSION) {
    errors.push(`eligibilityGuidance.schemaVersion must be ${ELIGIBILITY_SCHEMA_VERSION}`);
  }

  if (!Array.isArray(guidance.representedRequirements)) {
    errors.push("eligibilityGuidance.representedRequirements must be an array");
  } else {
    const ids = new Set();

    guidance.representedRequirements.forEach((requirement, index) => {
      const prefix = `eligibilityGuidance.representedRequirements[${index}]`;
      if (!isPlainObject(requirement)) {
        errors.push(`${prefix} must be an object`);
        return;
      }

      if (typeof requirement.id !== "string" || !requirement.id) errors.push(`${prefix}.id is required`);
      if (ids.has(requirement.id)) errors.push(`${prefix}.id must be unique`);
      ids.add(requirement.id);
      if (!["age_range", "education_stage", "minimum_experience"].includes(requirement.type)) {
        errors.push(`${prefix}.type is unsupported`);
      }
      if (requirement.verified !== true) errors.push(`${prefix}.verified must be true`);
      if (typeof requirement.description !== "string" || !requirement.description.trim()) {
        errors.push(`${prefix}.description is required`);
      }
      if (typeof requirement.sourceField !== "string" || !Object.hasOwn(opportunity, requirement.sourceField)) {
        errors.push(`${prefix}.sourceField must reference an existing opportunity field`);
      }

      if (requirement.type === "age_range") {
        const hasMinimum = Number.isInteger(requirement.minAge);
        const hasMaximum = Number.isInteger(requirement.maxAge);
        if (!hasMinimum && !hasMaximum) errors.push(`${prefix} needs minAge or maxAge`);
        if (hasMinimum && requirement.minAge < 1) errors.push(`${prefix}.minAge must be positive`);
        if (hasMaximum && requirement.maxAge < 1) errors.push(`${prefix}.maxAge must be positive`);
        if (hasMinimum && hasMaximum && requirement.minAge > requirement.maxAge) errors.push(`${prefix} has an invalid age range`);
      }

      if (requirement.type === "education_stage") {
        const allowed = new Set(EDUCATION_STAGE_OPTIONS.map(({ value }) => value));
        if (!Array.isArray(requirement.allowedValues) || !requirement.allowedValues.length
          || requirement.allowedValues.some((value) => !allowed.has(value))) {
          errors.push(`${prefix}.allowedValues contains unsupported education stages`);
        }
      }

      if (requirement.type === "minimum_experience"
        && (!Number.isFinite(requirement.minimumYears) || requirement.minimumYears < 0)) {
        errors.push(`${prefix}.minimumYears must be a non-negative number`);
      }
    });
  }

  if (!Array.isArray(guidance.unrepresentedRequirements)) {
    errors.push("eligibilityGuidance.unrepresentedRequirements must be an array");
  } else {
    guidance.unrepresentedRequirements.forEach((requirement, index) => {
      const prefix = `eligibilityGuidance.unrepresentedRequirements[${index}]`;
      if (!isPlainObject(requirement) || typeof requirement.description !== "string" || !requirement.description.trim()) {
        errors.push(`${prefix}.description is required`);
      }
      if (!isPlainObject(requirement) || typeof requirement.sourceField !== "string"
        || !Object.hasOwn(opportunity, requirement.sourceField)) {
        errors.push(`${prefix}.sourceField must reference an existing opportunity field`);
      }
    });
  }

  return errors;
}
