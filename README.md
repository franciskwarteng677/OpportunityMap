# OpportunityMap AI Coach

OpportunityMap AI Coach is a static, privacy-conscious opportunity discovery and application-planning tool for Ghanaian and African students. It brings scholarships, competitions, fellowships, research programmes, summer programmes, internships, and other academic pathways into one searchable directory, then adds transparent browser-side personalisation and progress tracking.

> **OpenAI Build Week track:** Education
>
> **Public demo:** [opportunitymap-gh.vercel.app](https://opportunitymap-gh.vercel.app)

The application remains intentionally framework-free, with no backend, database, account system, cloud synchronization, or runtime API integration. Students can always browse the full directory without creating a profile.

## The problem

Talented students regularly miss valuable opportunities because information is fragmented across university pages, foundation websites, social posts, and informal networks. Even after finding a programme, a student may still need to work out whether it is relevant to their location, stage of study, field, and timeline.

This is partly an educational equity problem: access to opportunity often depends on access to timely, well-organised information.

## Intended users

The primary users are secondary-school, undergraduate, postgraduate, and early-career students in Ghana and across Africa who need a clearer way to discover opportunities, assess possible fit, and organize application preparation. The directory also remains useful to educators, advisers, and mentors helping students locate trustworthy official sources.

## The solution

OpportunityMap offers one clear place to:

- discover different types of academic and career-building opportunities;
- search across titles, locations, eligibility, fields, and descriptions;
- narrow results by category, country or reach, field of study, and deadline status;
- understand key details before investing time in an application; and
- continue to the official programme source for current requirements and submission steps.

Students who choose to create a private browser profile can also generate a transparent ranking of the same verified directory. Each personalised result explains the profile factors that were compared and presents eligibility guidance separately from relevance. From either view, students can save an opportunity to a browser-local application dashboard, follow clearly labelled preparation guidance, add their own tasks and notes, and track progress across reloads.

The interface uses careful language and direct official links. A “verified source” label means the programme's official page was reviewed when the starter dataset was prepared; it is not an endorsement, and applicants should always reconfirm dates and eligibility.

## Main features

- Responsive, portfolio-ready interface for desktop, tablet, and mobile
- Strong education-access value proposition
- JSON-powered opportunity cards—no cards are hardcoded in the HTML
- Live, case-insensitive keyword search across opportunity details and source metadata
- Category filters for:
  - Scholarships
  - Competitions
  - Fellowships
  - Research Programs
  - Summer Programs
  - Internships
- Data-derived country, field, and deadline-status filters
- Combined filtering and one-click filter reset
- Professional loading, empty, and data-error states
- Secure external links to official sources
- Per-card source name, verification date, student level, funding type, and application context
- Data-driven Opportunity Distribution panel with a lightweight Africa regional view
- “How OpportunityMap Works” guidance
- Real OpportunityMap AI Coach introduction with transparent Build Week scope
- Accessible landmarks, labels, focus states, status announcements, and reduced-motion support
- Accessible student profile creation, editing, summary, completeness, and clearing
- Canonical internal profile values for deterministic personalisation
- Private, no-account profile persistence in the current browser only
- Defensive handling for missing, corrupted, unsupported, or unwritable browser storage
- Ranked profile matches across all nine existing verified opportunities
- Separate views for best matches, all opportunities, currently actionable opportunities, and closed opportunities
- Weighted profile-match percentages with comparable-factor confidence text
- Two or three plain-language ranking explanations that lead with positive matches and clearly label preference differences or unavailable comparisons
- Evidence-limited eligibility guidance that distinguishes represented matches, known conflicts, missing information, and source verification
- Per-result score-calculation disclosures and direct official-source links
- Synchronized Save/Saved controls on ordinary directory cards and personalised results
- Browser-local My Applications dashboard with seven application statuses and status filters
- General preparation checklists, evidence-limited verified-requirement reminders, and custom tasks
- Task-level and aggregate progress tracking across reloads
- Private plain-text notes with a 2,000-character limit
- Defensive storage-schema migration that preserves existing Phase 1 profiles

Profile-match scores are relevance scores, not eligibility, admission, selection, or funding probabilities. Saving an opportunity also does not confirm eligibility. See the [Build Week baseline](BUILD_WEEK_BASELINE.md) for the exact pre-hackathon boundary and the [Build Week progress record](BUILD_WEEK_PROGRESS.md) for the phased development history.

## Technology stack

- HTML5
- CSS3
- Vanilla JavaScript
- JSON
- Browser `localStorage`
- Node.js built-in test runner for development tests only

There are no runtime dependencies, build tools, frameworks, backend services, or database requirements.

## Architecture overview

OpportunityMap is a client-side application served as static files:

1. `index.html` provides the semantic page structure, forms, directory, AI Coach, and My Applications regions.
2. `styles.css` provides the shared responsive visual system, focus treatment, dialogs, status presentation, and reduced-motion rules.
3. `app.js` is the main entry point. It loads the JSON dataset, controls ordinary search and filters, synchronizes URL query parameters, renders directory cards, and initializes the feature modules.
4. `js/config.js`, `js/profile.js`, and `js/storage.js` define canonical profile choices, validate/profile-form input, and manage defensive versioned browser persistence.
5. `js/matching.js` and `js/eligibility.js` are separate pure engines for relevance ranking and evidence-limited eligibility guidance; `js/matches-ui.js` renders personalised results.
6. `js/action-plans.js` and `js/saved-opportunities.js` manage deterministic checklists and immutable saved-record operations; `js/applications-ui.js` synchronizes save controls and renders the dashboard.
7. `data/opportunities.json` is the single source of directory records. The interface does not hardcode or duplicate the full opportunity objects in browser storage.

All product logic runs in the browser. Node.js is used only for development tests, while the browser smoke test drives a locally installed Chromium browser against a temporary local server and isolated browser profile.

## Browser-local data and privacy

The AI Coach stores its versioned state under the single `localStorage` key `opportunityMapCoachState`. It may contain a student profile, saved opportunity IDs, application statuses, tasks, and private notes. It does not store full duplicate opportunity records, permanent match scores, or eligibility decisions.

- No account is required.
- No coach data is transmitted to OpportunityMap, OpenAI, or another service.
- The current application makes no runtime OpenAI API calls.
- Students can browse manually without creating a profile or saving anything.
- Students are told not to enter identification, financial, login, contact, grade, or other sensitive information.
- Clearing site data, changing browser profiles, or moving to another device can remove or isolate the locally stored data; there is no cloud backup or synchronization.

## Accessibility and responsive design

The application uses semantic landmarks and headings, a skip link, labelled forms, fieldsets and legends, visible focus styles, keyboard-operable controls, validation summaries, live status announcements, text alongside colour-coded states, native progress elements with textual equivalents, and accessible disclosure and confirmation-dialog patterns. Motion is reduced under the user's `prefers-reduced-motion` setting.

The layout is designed for desktop, tablet, and narrow mobile screens. The automated Chromium smoke test checks horizontal overflow at 1280 px, 768 px, 390 px, and 320 px. Manual screen-reader, contrast, reduced-motion, complete keyboard-path, and non-Chromium checks remain part of the final submission checklist.

## Project structure

```text
OpportunityMap/
├── .gitignore
├── BUILD_WEEK_BASELINE.md
├── BUILD_WEEK_PROGRESS.md
├── LICENSE
├── SUBMISSION_CHECKLIST.md
├── README.md
├── index.html
├── styles.css
├── app.js
├── js/
│   ├── action-plans.js
│   ├── applications-ui.js
│   ├── config.js
│   ├── eligibility.js
│   ├── matches-ui.js
│   ├── matching.js
│   ├── profile.js
│   ├── saved-opportunities.js
│   └── storage.js
├── data/
│   └── opportunities.json
├── tests/
│   ├── action-plans.test.js
│   ├── browser-smoke.mjs
│   ├── config.test.js
│   ├── data.test.js
│   ├── eligibility.test.js
│   ├── markup.test.js
│   ├── matching.test.js
│   ├── profile.test.js
│   ├── progress.test.js
│   ├── saved-opportunities.test.js
│   ├── storage-migration.test.js
│   └── storage.test.js
└── package.json
```

## Run locally

The app loads `data/opportunities.json` with `fetch()`. For security reasons, many browsers block that request when `index.html` is opened directly with a `file://` address. Serve the folder locally for reliable testing.

From the project directory, run either:

```powershell
py -m http.server 8000
```

or:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

The project also works with editor tools such as Live Server. If the page is opened directly and the browser blocks the JSON file, the interface shows a helpful setup message instead of failing silently.

## Opportunity data

All opportunity cards come from `data/opportunities.json`. The starter dataset is deliberately small so the information model and interface remain easy to inspect.

Every object retains its original display fields and now has versioned matching metadata. The abbreviated structure is:

```json
{
  "id": "opp-001",
  "schemaVersion": 2,
  "title": "Opportunity title",
  "category": "Scholarships",
  "country": "Ghana",
  "region": "West Africa",
  "eligibleFor": "Plain-language eligibility summary",
  "studentLevel": "Postgraduate",
  "field": "Field of study",
  "fundingType": "Fully Funded Scholarship",
  "applicationType": "Individual Application",
  "deadline": "2026-08-27",
  "deadlineStatus": "Open",
  "description": "Short opportunity summary",
  "sourceName": "Official programme owner",
  "officialUrl": "https://official.example.org/",
  "lastVerified": "2026-07-09",
  "verified": true,
  "matching": {
    "schemaVersion": 1,
    "educationStages": [],
    "fields": [],
    "categories": [],
    "eligibleNationalities": [],
    "eligibleResidencies": [],
    "geographicReach": [],
    "fundingPreferences": [],
    "mobilityRequired": null,
    "experienceLevels": [],
    "minAge": null,
    "maxAge": null,
    "goalKeywords": [],
    "criteriaSources": {}
  },
  "eligibilityGuidance": {
    "schemaVersion": 1,
    "representedRequirements": [],
    "unrepresentedRequirements": []
  }
}
```

Deadline values may be ISO dates, rolling windows, vacancy-specific dates, or a clearly stated announcement status. The current filter statuses are `Open`, `Upcoming`, `Rolling`, and `Closed`.

Display information remains separate from canonical matching values. Structured values were added only where an existing record field supported them; uncertain criteria remain `null`, an empty array, or an explicitly unrepresented requirement. `criteriaSources` and requirement `sourceField` values identify the existing record fields that support the structured criterion. They are provenance aids, not a substitute for checking the current official source.

`studentLevel`, `fundingType`, and `applicationType` remain concise, human-readable display values. `sourceName` identifies the programme owner, while `lastVerified` records the most recent manual source check as an ISO date (`YYYY-MM-DD`).

## Verified-source approach

OpportunityMap links students directly to the organisation responsible for each programme. A record marked `"verified": true` means its official source page was manually reviewed on the date stored in `lastVerified`. It does not mean the opportunity is endorsed, guaranteed, or permanently open.

The starter records were checked against official programme sources on 9 July 2026. Since deadlines and eligibility can change, students are reminded in the interface to confirm every detail and apply through the official programme website. A production version should add an editorial review queue, per-record verification history, and automated stale-data checks.

## Deploy to Vercel

OpportunityMap is a static site and requires no build command.

1. Push the folder to a GitHub repository.
2. Import the repository into Vercel.
3. Choose the static/other framework preset if prompted.
4. Leave the build command empty and deploy from the repository root.

The same project can also be hosted on GitHub Pages or another static hosting service.

## OpenAI Build Week Development

The dated Git history, [historical baseline](BUILD_WEEK_BASELINE.md), and [phase progress record](BUILD_WEEK_PROGRESS.md) establish these boundaries:

| Product boundary | Commit | Date (UTC) | Commit subject |
| --- | --- | --- | --- |
| Pre–Build Week baseline | `f1b88ff` | 2026-07-13 | `Initial professional OpportunityMap build` |
| Phase 1 complete | `f3d8193` | 2026-07-20 | `feat: add AI Coach profile foundation and local persistence` |
| Phase 2 complete | `aaa4160` | 2026-07-20 | `feat: add explainable matching and eligibility guidance` |
| Phase 3 complete | `b0c733f` | 2026-07-21 | `feat: add saved opportunities and application tracking` |

### Features that existed before Build Week

Commit `f1b88ff` already contained the professional static directory: the same nine verified opportunity records, keyword search, category/country/field/deadline filters, reset controls, URL query synchronization, responsive opportunity cards, official-source links, the regional distribution panel, responsive navigation, loading/error/empty states, and foundational accessibility behavior. Its “AI Matching · Coming Soon” area was a fictional preview; there was no profile, browser persistence, working personalisation, eligibility guidance, saving, or application tracking.

### Phase 1: profile and persistence

Students can now create a local profile containing citizenship, residence, optional age, education stage, interests, preferred categories, a broad goal, funding and mobility preferences, and experience level. Stable canonical values are stored under the versioned key `opportunityMapCoachState`.

Profile data stays in the current browser. It is not uploaded, synchronized, or backed up, and it may be lost when browser data is cleared. No account is required. Students should not enter contact details, identification numbers, grades, financial data, or other sensitive information.

Manual browsing remains available at all times, including when no profile exists.

### Phase 2: explainable matching

With a valid saved profile, a student can choose **Find my matches** to compare their profile with all nine existing opportunities. The matching engine is pure and deterministic: the same profile, opportunity data, and selected view always produce the same order and result.

The score uses eight weighted relevance factors:

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

For every factor that has both a represented opportunity criterion and usable profile information, the engine awards the full factor weight for a match or zero for a mismatch. It calculates:

```text
profile match = round(100 × matched comparable weight / total comparable weight)
```

Unknown opportunity criteria and missing or neutral profile values are excluded from both sides of the formula. They are shown to the student instead of silently counted as failures. The confidence text reports the number of factors actually compared against the number represented for that opportunity. This means two equal percentages may be based on different amounts of information.

The default **Best matches** view places currently actionable records (`Open` or `Rolling`) ahead of closed records, then orders by score, comparable-factor count, and stable opportunity ID. `Upcoming` records remain visible in Best matches and All opportunities but are not labelled currently actionable. **All opportunities** orders primarily by score; dedicated actionable and closed views filter only when the student explicitly selects them. Conflicting and closed opportunities remain available.

### Relevance is not eligibility

Profile relevance and eligibility guidance are deliberately computed and displayed separately. A high profile-match percentage means the represented opportunity characteristics align with the student's preferences; it does not mean the student is eligible or likely to be admitted, selected, or funded.

Eligibility guidance evaluates only explicit, verified hard requirements represented in the dataset. Current represented check types are age range, education stage, and minimum experience. It uses these statuses:

- `confirmed-fit`: all represented hard requirements match and there are no unresolved structured requirements;
- `known-conflict`: at least one represented hard requirement conflicts with the profile;
- `information-needed`: the profile lacks information needed for a represented check, or its broad value is not precise enough;
- `verify-at-source`: the directory lacks enough structured information for a reliable determination or additional requirements remain unrepresented.

Status precedence is: known conflict, then information needed, then source verification, then confirmed fit. Missing or unknown requirements never count as passes. Age conflicts are produced only when the opportunity record contains an explicit verified age boundary. Every result directs the student to check the full, current requirements at the official source.

### Phase 3: My Applications and progress tracking

Every ordinary opportunity card and personalised match card now has a visible, stateful Save/Saved control. Saving the same opportunity from both views updates one record instead of making a duplicate, and every rendered card is synchronized immediately. A newly saved record contains only its opportunity ID and the student's local planning data; the full directory record is not copied into browser storage.

The **My Applications** section provides an empty-state route back to the directory or, when records exist:

- a saved-opportunity count, status summary, and aggregate task progress;
- filters for All, Saved, Researching, Preparing, Ready to apply, Submitted, Outcome received, and Archived;
- deadline and deadline-status context from the current directory record;
- a labelled application-status selector;
- per-opportunity task progress and checklist management;
- optional custom tasks and private plain-text notes; and
- the current official-source link.

Archived records remain stored and recoverable through the Archived filter. If a saved opportunity is temporarily absent from the directory dataset, its ID and planning work remain available; official details and generated-checklist reset stay unavailable until the directory record returns.

When a valid profile and current opportunity record are both available, a saved card recalculates the current profile-match score and eligibility guidance. Neither value is stored as a permanent application or eligibility fact, so it can change after the profile or opportunity data changes.

#### Storage schema and migration

Phase 3 continues to use the single namespaced key `opportunityMapCoachState` and upgrades the state to schema version 2:

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

A supported version 1 state is migrated in place on first load. The profile, preferences, and existing `updatedAt` value are preserved, and the empty reserved saved-opportunity map becomes the version 2 application store. Version 1 data containing unknown non-empty saved records is rejected rather than guessed at. Malformed JSON, unsupported shapes, and future schema versions are reported and left untouched. If writing the migration fails—for example because storage is unavailable or full—the original value is not overwritten and mutations remain blocked until storage can be recovered or the user explicitly resets it.

Each subsequent save, status, task, or note mutation validates the complete supported structure and changes only the targeted record. A saved ID remains intact even if the matching directory record is temporarily unavailable.

#### Application statuses

Application status is separate from checklist progress and uses these stable values:

- `saved`
- `researching`
- `preparing`
- `ready-to-apply`
- `submitted`
- `outcome-received`
- `archived`

Status changes persist immediately and update the dashboard count and filters. Completing tasks does not silently advance application status.

#### Action-plan rules

Every newly saved opportunity receives nine **General guidance** tasks:

1. Review the current official eligibility page.
2. Confirm the current deadline or application window.
3. Review required application documents and materials.
4. Check whether a CV or résumé is required and update it if needed.
5. Check whether a personal statement is required and prepare it if needed.
6. Check whether references are required and request them if needed.
7. Review the completed application against the official instructions.
8. Submit through the official source.
9. Save the submission confirmation.

These are preparation prompts, not official programme instructions. Additional **Verified requirement** reminders are generated only from explicit verified `eligibilityGuidance.representedRequirements` entries supported by a current source field. They are phrased as items to verify at the official source; the action-plan engine does not infer documents, essays, tests, fees, dates, or other requirements from promotional text. It intentionally creates no target dates, including for fixed, rolling, year-round, vacancy-specific, unknown, or closed deadlines.

Each task can be Not started, In progress, or Complete. Students may add, rename, and delete **Custom task** items; generated guidance cannot be renamed or individually deleted. Resetting a checklist requires confirmation, recreates the General guidance and Verified requirement items as Not started, and preserves custom tasks, notes, application status, and the original saved timestamp.

Per-opportunity progress is:

```text
progress = round(100 × complete tasks / total tasks)
```

In-progress tasks remain visible but do not count as complete. Overall progress uses the same formula across every task in every saved record, including archived records. When there are no tasks, progress is 0%.

Removing a freshly saved opportunity with untouched generated tasks happens directly. Confirmation is required when removal would also delete meaningful planning work: a changed application status, non-empty notes, a custom task, or any task moved beyond Not started. Custom-task deletion and generated-checklist reset also require confirmation.

Private notes are stored as plain text, limited to 2,000 characters, and never inserted as HTML. They remain in this browser only. Students should not enter identification numbers, passwords, financial details, contact details, or other sensitive information.

## Current limitations

- The directory intentionally remains the same small inventory of nine opportunities; ranking quality is limited by that coverage.
- Matching metadata is conservative and incomplete. Unknown factors reduce the amount of comparison evidence rather than reducing the score.
- Goal matching uses deterministic represented keywords, not semantic AI analysis.
- Broad profile ranges, especially experience, may require the student to verify an exact requirement.
- Programme criteria and deadlines can change after `lastVerified`; the official source is authoritative.
- Browser profiles, saved opportunities, notes, and progress do not synchronize between devices or browsers and disappear if site storage is cleared.
- The checklist deliberately contains general preparation guidance unless a task is explicitly labelled as a verified requirement.
- No target dates or reminders are generated in Phase 3.
- There is no OpenAI or other API integration, account, backend, database, cloud storage, or notification service.
- The project does not live-check official pages, so a `verified` record can become stale after its recorded `lastVerified` date.
- Browser automation currently targets Chromium; screen-reader, contrast, reduced-motion, complete keyboard-path, Firefox, and Safari checks remain manual.

The directory is a discovery aid, not a complete catalogue. A profile match is not an eligibility, admission, selection, or funding probability; eligibility guidance covers only explicitly represented criteria. Students must check the current deadline, complete eligibility rules, funding terms, required documents, and application process at the linked official source before acting.

## How to test

No dependency installation or build step is required. With Node.js and a local Chromium-based browser available, run from the repository root:

```powershell
npm test
npm run test:syntax
npm run test:browser
```

`npm test` runs the complete Node test suite. `test:syntax` parses the application modules and browser-smoke script. `test:browser` uses a locally installed Chrome or Edge executable to exercise the app through an isolated temporary browser profile; set `OPPORTUNITYMAP_BROWSER` to an alternate Chromium executable if needed.

To repeat the HTTP smoke check, serve the repository as described in [Run locally](#run-locally), then confirm that `/`, `/index.html?search=internship`, `/styles.css`, `/app.js`, and `/data/opportunities.json` each return HTTP 200 with an appropriate content type. Validate final patch formatting with:

```powershell
git diff --check
```

### Automated test results

Latest local submission audit: **21 July 2026**.

| Check | Result |
| --- | --- |
| Complete Node test suite | 93 passed, 0 failed, 0 skipped |
| JavaScript syntax checks | Passed for the entry point, all feature modules, and browser-smoke script |
| Dataset and metadata validation | Passed; exactly 9 unique records, unchanged baseline display fields, valid schema/provenance |
| HTTP and content-type smoke checks | 5 of 5 passed |
| Browser integration | Passed: profile, matching, saving, dashboard, tasks, notes, persistence, and confirmations |
| JavaScript console | No errors during the browser flow |
| Responsive overflow | Passed at 1280 px, 768 px, 390 px, and 320 px |
| Internal documentation and page-fragment links | Passed |
| `git diff --check` | Passed |

For a high-level manual check, serve the repository locally, save one opportunity from the normal directory and another from personalised results, then open **My Applications**. Change their statuses, update task states, add/edit/delete a custom task, save notes, apply each status filter, and reload the page to confirm persistence. Also verify that an unsave with planning work asks for confirmation and that cancelling the dialog keeps the record. Repeat with keyboard-only navigation and at desktop, tablet, 390px, and 320px widths.

## How Codex and GPT-5.6 were used

GPT-5.6 powered the primary Codex engineering sessions used during OpenAI Build Week. Codex first audited the pre-existing `f1b88ff` repository and helped turn the selected product direction into three bounded implementation phases. It then supported implementation of the browser-local profile foundation and defensive persistence; deterministic, explainable relevance matching and separate eligibility guidance; saved opportunities, action-plan checklists, statuses, tasks, progress, and private notes; and the focused automated test and browser-validation suite.

The human developer selected the Education-track problem and feature scope, made the product and risk decisions, reviewed the design and implementation, manually tested the application, and committed each completed phase. Codex assisted with repository analysis, architecture, implementation, documentation, and repeatable validation; it did not replace human product judgment or official-source review.

The application itself currently uses deterministic browser-side JavaScript and makes **no runtime OpenAI API calls**. It does not send profiles, saved work, or notes to OpenAI. GPT-5.6 was part of the Codex engineering workflow, not a hidden production service or a claim that the deployed interface is generative AI.

Important product and engineering decisions made during that workflow include:

- keeping the profile-match percentage separate from eligibility guidance, admission likelihood, and funding outcomes;
- refusing to invent eligibility claims, application requirements, documents, or deadlines when the dataset lacks evidence;
- directing students to the current official source for every final eligibility and application decision;
- keeping personal profiles and application work browser-local with no account or backend;
- preserving the original nine-opportunity inventory and its pre-existing display information;
- documenting `f1b88ff` as the historical pre–Build Week boundary and recording each later phase separately;
- protecting meaningful application work with conditional unsave confirmation while profile clearing preserves saved applications; and
- migrating supported version 1 browser state to schema version 2 so existing profiles survive the Phase 3 storage upgrade.

## Research and analytics component

OpportunityMap can also become a research tool for understanding how opportunity access is distributed. The first regional panel already aggregates the JSON dataset into direct regional, Africa-wide, and international coverage.

With a larger, consistently maintained dataset, future research dashboards could examine:

- which African regions and countries receive the most listings;
- the balance between scholarships, internships, research, and other pathways;
- fields of study with strong or limited opportunity coverage;
- typical deadline patterns and application lead time;
- eligibility barriers by age, nationality, study level, or mobility; and
- gaps between where students are searching and where opportunities are available.

Those analytics should clearly distinguish directory coverage from the real-world supply of opportunities; an incomplete dataset must not be presented as a complete measure of access.

## Future improvements

The JSON dataset is appropriate for the first version. A fuller platform can later add:

- a database and editorial content-management workflow;
- optional account-based profile synchronization, if later justified;
- optional deadline reminders and calendar integration;
- per-record verification history and automated stale-data checks;
- optional AI-assisted application planning, with appropriate privacy and source safeguards;
- country-level mapping and opportunity analytics;
- partner or institution submissions with moderation; and
- a research dashboard for educational opportunity access.

## Data and contribution notes

Before adding or updating an opportunity:

1. Use the programme owner's official HTTPS page.
2. Confirm the category, eligible students, location, field, and current deadline.
3. Record the official organisation in `sourceName` and the review date in `lastVerified`.
4. Keep descriptions and funding labels factual and concise.
5. Avoid implying endorsement, guaranteed selection, or funding beyond what the source states.
6. Update `deadlineStatus` whenever the application cycle changes.
7. Test search, filters, cards, and regional counts after editing the JSON.

OpportunityMap is an early product foundation built around a simple idea: students should not miss a path merely because they never had a fair chance to see it.

## License

OpportunityMap is available under the [MIT License](LICENSE).
