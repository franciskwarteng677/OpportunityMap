# OpportunityMap AI Coach — Build Week progress

## Product boundary

Commit `f1b88ff` (`Initial professional OpportunityMap build`) is the pre–OpenAI Build Week baseline. The original directory remains available without an account or student profile, and its inventory remains nine verified opportunities.

`BUILD_WEEK_BASELINE.md` is the historical record of that boundary. This file records the additions made after it.

### Dated commit boundaries

The current branch history records each completed phase separately:

| Boundary | Commit | Date (UTC) | Commit subject |
| --- | --- | --- | --- |
| Pre–Build Week baseline | `f1b88ff` | 2026-07-13 | `Initial professional OpportunityMap build` |
| Phase 1 complete | `f3d8193` | 2026-07-20 | `feat: add AI Coach profile foundation and local persistence` |
| Phase 2 complete | `aaa4160` | 2026-07-20 | `feat: add explainable matching and eligibility guidance` |
| Phase 3 complete | `b0c733f` | 2026-07-21 | `feat: add saved opportunities and application tracking` |

These commits, together with `BUILD_WEEK_BASELINE.md`, separate the original product from the three Build Week extensions. The final submission-documentation audit occurs after `b0c733f` and does not change product behaviour or the historical boundaries above.

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

Phase 1 introduced this version 1 top-level shape:

```json
{
  "schemaVersion": 1,
  "profile": {},
  "savedOpportunities": {},
  "preferences": {},
  "updatedAt": ""
}
```

At that point, the reserved `savedOpportunities` and `preferences` objects did not activate those future features. Phase 3 migrates supported version 1 state to version 2 without discarding the profile.

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

## Phase 3 — saved opportunities, action plans, and progress

Phase 3 adds browser-local application organization without changing the nine-record opportunity inventory, the directory ordering, the matching formula, or the eligibility methodology.

### Saving and My Applications

Ordinary directory cards and personalised result cards now share a visible Save/Saved control with an accessible pressed state. Saving in either view updates all rendered instances immediately. The same opportunity ID maps to one saved record, so saving it from more than one view never creates a duplicate. Saving means only that the student wants to plan around the opportunity; it does not indicate eligibility.

The new **My Applications** section includes:

- an explanatory empty state and a route back to Browse opportunities;
- the number of saved records, a status breakdown, and overall task progress;
- filters for every application status;
- current deadline information and an official-source link where the directory record is available;
- a labelled application-status selector;
- current per-opportunity checklist progress;
- general, verified-requirement, and custom task labels;
- private notes; and
- optional current profile-match and eligibility guidance recalculated from the active profile and current dataset.

The seven canonical application statuses are:

```text
saved
researching
preparing
ready-to-apply
submitted
outcome-received
archived
```

Status changes persist immediately and update dashboard summaries. Archived records stay stored and can be restored to another status. Task completion and application status remain independent; one never silently changes the other.

A saved ID and all of its local work remain available when its directory record is temporarily missing. In that state, the dashboard uses the ID instead of inventing a title or source, hides unavailable current details, and disables generated-checklist reset until the verified record is available again.

### Version 1 to version 2 storage migration

Phase 3 keeps the same namespaced key, `opportunityMapCoachState`, and advances its schema to version 2:

```json
{
  "schemaVersion": 2,
  "profile": {},
  "savedOpportunities": {
    "opp-001": {
      "opportunityId": "opp-001",
      "savedAt": "2026-07-20T12:00:00.000Z",
      "updatedAt": "2026-07-20T12:00:00.000Z",
      "applicationStatus": "saved",
      "tasks": [],
      "notes": ""
    }
  },
  "preferences": {},
  "updatedAt": "2026-07-20T12:00:00.000Z"
}
```

On first load, a supported version 1 state is migrated in place. Its profile, preferences, and existing top-level `updatedAt` value are preserved, while the reserved empty `savedOpportunities` object becomes the version 2 application store. The migration is intentionally conservative:

- malformed JSON is reported and not overwritten;
- a future or otherwise unsupported schema is reported and not overwritten;
- version 1 state containing unknown non-empty saved records is rejected rather than interpreted or discarded; and
- if the migration write fails because browser storage is unavailable, blocked, or full, the original stored value is not overwritten and further mutations remain blocked.

All version 2 mutations validate the supported state, record, task, timestamp, status, and character-limit shapes. Adding, changing, or removing one saved opportunity copies and updates only that keyed record; it does not delete or rewrite another record. Full opportunity objects and profile-match or eligibility results are never stored inside saved records.

### Action-plan generation

Saving an opportunity for the first time creates nine tasks labelled **General guidance**:

1. Review the current official eligibility page.
2. Confirm the current deadline or application window.
3. Review required application documents and materials.
4. Check whether a CV or résumé is required and update it if needed.
5. Check whether a personal statement is required and prepare it if needed.
6. Check whether references are required and request them if needed.
7. Review the completed application against the official instructions.
8. Submit through the official source.
9. Save the submission confirmation.

These prompts are general preparation help, never official instructions. An extra **Verified requirement** task is generated only when an `eligibilityGuidance.representedRequirements` entry is explicitly marked verified, has a supported hard-requirement type, and points to an existing source field in that opportunity record. Its wording directs the student to verify the represented criterion at the official source. The generator does not infer essays, documents, references, fees, tests, dates, or eligibility rules from broad descriptions.

Phase 3 intentionally generates no target dates. This avoids inventing dates for rolling, year-round, vacancy-specific, unknown, or closed deadlines and keeps the same conservative rule even for records with an ISO deadline.

Each task uses one of three canonical statuses—`not-started`, `in-progress`, or `complete`—and one of three source types—`general-guidance`, `verified-requirement`, or `custom`. Generated guidance titles cannot be edited into misleading requirements or deleted individually. Students can add, rename, and delete their own custom tasks, up to the documented limits.

Resetting generated guidance requires confirmation. It recreates the general and supported verified-requirement tasks as Not started while keeping custom tasks, notes, application status, and the original saved timestamp. Reset is disabled when the current directory record is unavailable because the verified requirement set cannot be safely regenerated.

### Progress, notes, and destructive-action safeguards

Per-opportunity progress counts only tasks whose status is `complete`:

```text
progress percentage = round(100 × complete tasks / total tasks)
```

The interface also reports complete and total counts. In-progress tasks are reported separately but contribute zero to the percentage. An empty task list reports 0%. Overall progress applies the same calculation to the combined tasks for every saved opportunity, including archived records.

Students can store optional notes of up to 2,000 characters per opportunity. Notes are validated and stored as plain text; the interface does not render them as HTML. It explicitly warns students not to enter identification, financial, password, contact, or other sensitive information.

Unsave confirmation is conditional. A new record with its default `saved` status, empty notes, no custom task, and every generated task still Not started can be removed directly. Confirmation is required when unsaving would also delete any meaningful planning work: a changed application status, non-empty notes, a custom task, or a task moved beyond Not started. Deleting a custom task and resetting generated guidance also require confirmation, with focus returned appropriately when a dialog is cancelled or an item disappears.

Current match and eligibility information on saved cards is recalculated from the current profile and dataset. It is not persisted as application progress or as an authoritative eligibility fact and may change after profile edits.

## Privacy and data handling

- Profile, saved-opportunity, status, task, progress, and note data remain in the current browser's `localStorage` only.
- No account is required.
- No coach data is transmitted to OpportunityMap, OpenAI, or another service.
- Matching and eligibility guidance run locally in deterministic JavaScript.
- Students are told not to enter sensitive personal, identification, grade, contact, login, or financial information.
- Clearing site data, changing browsers, or changing devices can remove or isolate all local coach data.
- Manual browsing works without creating or saving a profile.

## Current limitations

- The nine-record dataset is intentionally small and cannot represent the full opportunity landscape.
- Structured criteria are deliberately conservative; many current requirements still require official-source review.
- A high match score can be based on only a few comparable factors, so confidence text is essential context.
- Goal matching is canonical keyword overlap, not semantic or generative AI.
- Broad experience bands may be insufficient for an exact minimum-experience check.
- Source facts, deadlines, and application cycles can change after the recorded verification date.
- Eligibility guidance never replaces an official programme decision.
- Action plans are predominantly general guidance and are not official application instructions.
- No target dates, calendar reminders, notifications, or deadline alerts are generated.
- Browser-local application data does not synchronize or back up across browsers or devices.

## Explicitly outside Phase 3

Phase 3 does not include:

- an OpenAI or other API integration;
- accounts or cross-device profile synchronization;
- a backend, database, cloud storage, or notification service;
- automated semantic or generative action plans; or
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
- `js/action-plans.js` owns pure checklist generation, task operations, and progress calculations;
- `js/saved-opportunities.js` owns saved-record, status, task, note, and conditional-unsave operations;
- `js/applications-ui.js` synchronizes Save/Saved controls and renders the My Applications dashboard; and
- `data/opportunities.json` remains the single nine-record opportunity dataset.

Focused Node.js tests cover profile behavior; schema migration and storage recovery; matching and eligibility; metadata validity; saved-record deduplication and isolation; action-plan generation; custom task and note operations; progress calculations; deterministic ordering; and the continued integrity of all nine records. The application has no runtime dependencies, build step, backend, paid service, or API key.

Run the full Node test suite and JavaScript syntax checks with:

```powershell
npm test
npm run test:syntax
npm run test:browser
```

The browser command launches a locally installed Chromium browser with an isolated temporary profile and checks the complete save-to-dashboard flow, reload persistence, destructive confirmations, JavaScript console errors, and horizontal overflow at 1280px, 768px, 390px, and 320px. `OPPORTUNITYMAP_BROWSER` may point to an alternate Chromium executable.

For manual use, serve the project over HTTP, browse or generate personalised results, and use a Save control. Open **My Applications**, change status and task states, add/edit/delete a custom task, save notes, filter by status, and reload to verify persistence. Check conditional unsave, checklist-reset, and custom-task-delete confirmations with keyboard-only input. Test the responsive layout at desktop, tablet, 390px, and 320px widths. The 21 July 2026 local submission audit passed the automated browser flow; public-deployment, screen-reader, complete keyboard-path, reduced-motion, contrast, and non-Chromium checks remain manual.
