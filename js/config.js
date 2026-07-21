"use strict";

export const COACH_STORAGE_KEY = "opportunityMapCoachState";
export const COACH_SCHEMA_VERSION = 2;
export const LEGACY_COACH_SCHEMA_VERSION = 1;

export const PROFILE_LIMITS = Object.freeze({
  minimumAge: 1,
  maximumAge: 120,
  goalMaximumLength: 500,
});

export const APPLICATION_LIMITS = Object.freeze({
  notesMaximumLength: 2000,
  customTaskTitleMaximumLength: 160,
  taskTitleMaximumLength: 240,
  identifierMaximumLength: 200,
  maximumTasksPerOpportunity: 100,
});

function freezeOptions(options) {
  return Object.freeze(options.map((option) => Object.freeze(option)));
}

export const EDUCATION_STAGE_OPTIONS = freezeOptions([
  { value: "secondary_school", label: "Secondary school" },
  { value: "tvet", label: "Technical or vocational education (TVET)" },
  { value: "undergraduate", label: "Undergraduate / bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "doctoral", label: "Doctoral / PhD" },
  { value: "recent_graduate", label: "Recent graduate" },
  { value: "early_career", label: "Early-career professional" },
  { value: "mid_career", label: "Mid-career professional" },
  { value: "other", label: "Another education or career stage" },
]);

export const FIELD_OF_INTEREST_OPTIONS = freezeOptions([
  { value: "agriculture_food_systems", label: "Agriculture & food systems" },
  { value: "arts_humanities", label: "Arts & humanities" },
  { value: "business_entrepreneurship", label: "Business & entrepreneurship" },
  { value: "computer_science_ai", label: "Computer science, data & AI" },
  { value: "education", label: "Education" },
  { value: "engineering", label: "Engineering" },
  { value: "environment_climate", label: "Environment & climate" },
  { value: "health_life_sciences", label: "Health & life sciences" },
  { value: "law_policy", label: "Law, governance & public policy" },
  { value: "mathematics_physical_sciences", label: "Mathematics & physical sciences" },
  { value: "social_sciences", label: "Social sciences" },
  { value: "interdisciplinary_other", label: "Interdisciplinary or another field" },
]);

export const OPPORTUNITY_CATEGORY_OPTIONS = freezeOptions([
  { value: "scholarships", label: "Scholarships" },
  { value: "competitions", label: "Competitions" },
  { value: "fellowships", label: "Fellowships" },
  { value: "research_programs", label: "Research programs" },
  { value: "summer_programs", label: "Summer programs" },
  { value: "internships", label: "Internships" },
]);

export const FUNDING_PREFERENCE_OPTIONS = freezeOptions([
  { value: "fully_funded", label: "Fully funded opportunities preferred" },
  { value: "some_funding", label: "Fully or partially funded opportunities" },
  { value: "any", label: "Any funding level" },
  { value: "unsure", label: "Not sure yet" },
]);

export const MOBILITY_PREFERENCE_OPTIONS = freezeOptions([
  { value: "travel_and_relocate", label: "Open to travel and relocate" },
  { value: "travel_only", label: "Open to short-term travel, not relocation" },
  { value: "local_or_remote", label: "Local or remote opportunities only" },
  { value: "unsure", label: "Not sure yet" },
]);

export const EXPERIENCE_LEVEL_OPTIONS = freezeOptions([
  { value: "none", label: "No formal experience yet" },
  { value: "under_one_year", label: "Less than 1 year" },
  { value: "one_to_two_years", label: "1–2 years" },
  { value: "three_to_five_years", label: "3–5 years" },
  { value: "over_five_years", label: "More than 5 years" },
]);

export const APPLICATION_STATUS_OPTIONS = freezeOptions([
  { value: "saved", label: "Saved" },
  { value: "researching", label: "Researching" },
  { value: "preparing", label: "Preparing" },
  { value: "ready-to-apply", label: "Ready to apply" },
  { value: "submitted", label: "Submitted" },
  { value: "outcome-received", label: "Outcome received" },
  { value: "archived", label: "Archived" },
]);

export const TASK_STATUS_OPTIONS = freezeOptions([
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "complete", label: "Complete" },
]);

export const TASK_SOURCE_TYPE_OPTIONS = freezeOptions([
  { value: "general-guidance", label: "General guidance" },
  { value: "verified-requirement", label: "Verified requirement" },
  { value: "custom", label: "Custom task" },
]);

export const PROFILE_REQUIRED_FIELDS = Object.freeze([
  "citizenshipCountry",
  "residenceCountry",
  "educationStage",
  "fieldsOfInterest",
  "preferredCategories",
  "goal",
  "fundingPreference",
  "mobilityPreference",
  "experienceLevel",
]);

// ISO 3166-1 alpha-2 codes give country fields stable stored values while
// visible country names can remain localisable presentation text.
export const COUNTRY_CODES = Object.freeze(
  "AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW PS EH".split(" "),
);

export function getCountryOptions(locale = "en") {
  let displayNames;

  try {
    displayNames = typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames([locale], { type: "region" })
      : null;
  } catch {
    displayNames = null;
  }

  return COUNTRY_CODES.map((value) => ({
    value,
    label: displayNames?.of(value) || value,
  })).sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function getOptionLabel(options, value, fallback = "Not provided") {
  return options.find((option) => option.value === value)?.label || fallback;
}
