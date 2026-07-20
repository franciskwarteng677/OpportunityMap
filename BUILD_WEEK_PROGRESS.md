# OpportunityMap AI Coach — Build Week progress

## Product boundary

Commit `f1b88ff` (`Initial professional OpportunityMap build`) is the pre–OpenAI Build Week baseline. The original directory remains available without an account or student profile, and its inventory remains nine verified opportunities.

`BUILD_WEEK_BASELINE.md` is the historical record of that boundary. This file records the additions made after it.

## Before OpenAI Build Week

The baseline product was a framework-free static opportunity directory with:

- nine verified opportunity records loaded from JSON;
- keyword search and category, country/reach, field, and deadline filters;
- combined filters, reset controls, and URL query synchronization;
- responsive opportunity cards and secure official-source links;
- loading, no-results, data-error, and retry states;
- a data-derived regional distribution panel;
- responsive desktop and mobile navigation; and
- semantic structure, keyboard focus, status announcements, a skip link, and reduced-motion support.

The baseline had no student profile, persistence, personalised ranking, eligibility guidance, saved opportunities, action plans, progress tracking, account, backend, or API integration. Its AI matching area was a non-functional future-feature preview.

## Phase 1 — student profile and local persistence

Phase 1 replaced the preview with a real OpportunityMap AI Coach entry point and added only the profile foundation:

- an accessible student questionnaire for citizenship, residence, optional age, education stage, multiple fields of interest, multiple preferred opportunity categories, career or study goal, funding preference, mobility preference, and experience level;
- stable canonical values kept separate from visible labels;
- profile validation, an error summary, field-level messages, and focus management;
- profile save, edit, summary, completeness, and confirmation before clearing;
- visible success, warning, and error messages;
- defensive, namespaced, versioned browser persistence under `opportunityMapCoachState`;
- recovery from missing storage, malformed JSON, unsupported state, empty profiles, and save failures; and
- explicit privacy messaging and uninterrupted manual directory browsing.

The persisted state has this top-level shape:

```json
{
  "schemaVersion": 1,
  "profile": {},
  "savedOpportunities": {},
  "preferences": {},
  "updatedAt": ""
}
```

The reserved `savedOpportunities` and `preferences` objects do not activate those future features.

## Phase 2 — transparent matching and eligibility guidance

Phase 2 adds a dedicated personalised-results area inside AI Coach while leaving the ordinary directory and its ordering intact.

With a valid saved profile, a student can:

- generate a deterministic ranking across all nine existing opportunity records;
- see a profile-match percentage and comparable-factor confidence statement;
- read two or three concise ranking explanations, led by positive match reasons and supplemented by clearly labelled preference differences or unavailable comparisons when fewer than two positive factors exist;
- review preference differences, missing profile information, and unknown opportunity criteria;
- inspect an accessible disclosure explaining the score calculation;
- see separate eligibility guidance with represented checks, conflicts, information needs, and criteria that still require source verification;
- choose Best matches, All opportunities, Currently actionable, or Closed opportunities; and
- return to the normal directory at any time.

No opportunity was added or removed. Existing display fields remain intact. Versioned `matching` and `eligibilityGuidance` metadata was added only where existing repository information safely supports it. Empty arrays and `null` represent criteria that are not sufficiently known. Criterion provenance points back to supporting existing record fields where practical.

### Profile-match methodology

The relevance engine compares eight factors:

| Factor | Weight |
| --- | ---: |
| Education stage | 20 |
| Fields of interest | 20 |
| Preferred opportunity category | 15 |
| Citizenship, residence, or represented geographic reach | 15 |
| Funding preference | 10 |
| Travel or relocation preference | 5 |
| Relevant experience level | 5 |
| Career or study goal keywords | 10 |

Each comparable factor receives its full configured weight when it matches and zero when it does not. A factor is comparable only when the opportunity has a supported structured value and the profile supplies a usable value. The score is:

```text
profile match = round(100 × matched comparable weight / total comparable weight)
```

Unknown opportunity criteria, missing profile information, and deliberately neutral answers such as an unsure preference are excluded from the denominator. They are surfaced in the result rather than treated as failures. If no factor is comparable, the score is `0` and the low evidence is made visible.

Confidence is expressed as “Based on X of Y comparable factors,” where X is the number actually compared and Y is the number for which the opportunity has represented metadata. Confidence changes the explanation, not the percentage formula.

The default Best matches view applies these deterministic ordering rules:

1. actionable statuses (`Open` and `Rolling`) before upcoming or unknown statuses, then closed records;
2. higher profile-match score;
3. more compared factors; and
4. stable opportunity ID.

The All opportunities view orders first by score, using actionability and the same stable tie-breakers after equal scores. `Upcoming` records remain visible but are not included in the Currently actionable view. The actionable and closed views filter only in response to the student's explicit choice. A conflict never causes an opportunity to be silently removed.

### Eligibility methodology

Eligibility guidance is not part of the profile-match percentage. It evaluates only explicit, verified hard requirements stored as represented checks. It does not infer hard rules from promotional wording or broad display descriptions.

The four statuses are:

- `confirmed-fit`: every represented hard requirement matches and no structured requirement remains unresolved;
- `known-conflict`: at least one explicit represented requirement conflicts with the saved profile;
- `information-needed`: a represented check needs a missing or more precise profile value;
- `verify-at-source`: the dataset does not contain enough structured information for a reliable determination, or additional requirements are known to remain unrepresented.

If multiple conditions apply, the status precedence is:

```text
known-conflict > information-needed > verify-at-source > confirmed-fit
```

The engine currently supports represented age-range, education-stage, and minimum-experience checks. Age conflicts are reported only when an explicit verified age range exists. Missing values and unknown criteria are never counted as passes. Even `confirmed-fit` refers only to the represented checks; it is not a guarantee of full eligibility, admission, selection, or funding. Every result directs the student to verify current requirements at the official source.

## Privacy and data handling

- Profile data remains in the current browser's `localStorage` only.
- No account is required.
- No profile data is transmitted to OpportunityMap, OpenAI, or another service.
- Matching and eligibility guidance run locally in deterministic JavaScript.
- Students are told not to enter sensitive personal, identification, grade, contact, or financial information.
- Clearing site data, changing browsers, or changing devices can remove or isolate the profile.
- Manual browsing works without creating or saving a profile.

## Phase 2 limitations

- The nine-record dataset is intentionally small and cannot represent the full opportunity landscape.
- Structured criteria are deliberately conservative; many current requirements still require official-source review.
- A high match score can be based on only a few comparable factors, so confidence text is essential context.
- Goal matching is canonical keyword overlap, not semantic or generative AI.
- Broad experience bands may be insufficient for an exact minimum-experience check.
- Source facts, deadlines, and application cycles can change after the recorded verification date.
- Eligibility guidance never replaces an official programme decision.

## Explicitly outside Phase 2

Phase 2 does not include:

- an OpenAI or other API integration;
- saved opportunities;
- personalised application action plans;
- application progress tracking;
- accounts or cross-device profile synchronization;
- a backend or database; or
- new or fabricated opportunity records or requirements.

## Current technical shape

The application remains static and framework-free:

- `app.js` is the main application entry point and directory controller;
- `js/config.js` defines canonical profile choices;
- `js/storage.js` owns versioned local persistence and recovery;
- `js/profile.js` owns profile validation and profile-form behavior;
- `js/matching.js` owns pure relevance scoring and ranking;
- `js/eligibility.js` owns pure eligibility guidance;
- `js/matches-ui.js` connects saved profiles, the two engines, and personalised result rendering; and
- `data/opportunities.json` remains the single nine-record opportunity dataset.

Focused Node.js tests cover profile and storage behavior, matching, eligibility, metadata validity, deterministic ordering, and the continued integrity of all nine records. The application has no runtime dependencies, build step, backend, paid service, or API key.
