import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTRY_CODES,
  EDUCATION_STAGE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  FIELD_OF_INTEREST_OPTIONS,
  FUNDING_PREFERENCE_OPTIONS,
  MOBILITY_PREFERENCE_OPTIONS,
  OPPORTUNITY_CATEGORY_OPTIONS,
  PROFILE_REQUIRED_FIELDS,
  getCountryOptions,
} from "../js/config.js";

const optionGroups = [
  EDUCATION_STAGE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  FIELD_OF_INTEREST_OPTIONS,
  FUNDING_PREFERENCE_OPTIONS,
  MOBILITY_PREFERENCE_OPTIONS,
  OPPORTUNITY_CATEGORY_OPTIONS,
];

test("canonical option values and generated control ids are nonblank and unique", () => {
  optionGroups.forEach((options) => {
    const values = options.map((option) => option.value);
    const generatedIds = values.map((value) => value.replaceAll("_", "-"));

    assert.ok(values.every(Boolean));
    assert.equal(new Set(values).size, values.length);
    assert.equal(new Set(generatedIds).size, generatedIds.length);
  });

  assert.equal(new Set(COUNTRY_CODES).size, COUNTRY_CODES.length);
  assert.equal(getCountryOptions().length, COUNTRY_CODES.length);
  assert.equal(new Set(PROFILE_REQUIRED_FIELDS).size, PROFILE_REQUIRED_FIELDS.length);
});

test("profile category values deliberately map to the existing directory categories", () => {
  assert.deepEqual(
    OPPORTUNITY_CATEGORY_OPTIONS.map(({ value, label }) => [value, label]),
    [
      ["scholarships", "Scholarships"],
      ["competitions", "Competitions"],
      ["fellowships", "Fellowships"],
      ["research_programs", "Research programs"],
      ["summer_programs", "Summer programs"],
      ["internships", "Internships"],
    ],
  );
});
