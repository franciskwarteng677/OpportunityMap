# OpportunityMap

OpportunityMap is a static scholarship and opportunity finder designed for Ghanaian and African students. It brings scholarships, competitions, fellowships, research programmes, summer programmes, internships, and other academic pathways into one searchable, student-friendly directory.

This repository contains the professional directory plus the first two OpenAI Build Week phases of **OpportunityMap AI Coach**. It remains intentionally framework-free, with no backend, database, account system, or API integration. Students can browse the full directory without creating a profile.

## The problem

Talented students regularly miss valuable opportunities because information is fragmented across university pages, foundation websites, social posts, and informal networks. Even after finding a programme, a student may still need to work out whether it is relevant to their location, stage of study, field, and timeline.

This is partly an educational equity problem: access to opportunity often depends on access to timely, well-organised information.

## The solution

OpportunityMap offers one clear place to:

- discover different types of academic and career-building opportunities;
- search across titles, locations, eligibility, fields, and descriptions;
- narrow results by category, country or reach, field of study, and deadline status;
- understand key details before investing time in an application; and
- continue to the official programme source for current requirements and submission steps.

Students who choose to create a private browser profile can also generate a transparent ranking of the same verified directory. Each personalised result explains the profile factors that were compared and presents eligibility guidance separately from relevance.

The interface uses careful language and direct official links. A “verified source” label means the programme's official page was reviewed when the starter dataset was prepared; it is not an endorsement, and applicants should always reconfirm dates and eligibility.

## Features in this version

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
- Real OpportunityMap AI Coach introduction with transparent Phase 2 scope
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

Profile-match scores are relevance scores, not eligibility, admission, selection, or funding probabilities. Saved opportunities, action plans, progress tracking, and API features are not active in this phase. See `BUILD_WEEK_BASELINE.md` for the exact pre-hackathon boundary and `BUILD_WEEK_PROGRESS.md` for the phased Build Week record.

## Technology stack

- HTML5
- CSS3
- Vanilla JavaScript
- JSON
- Browser `localStorage`
- Node.js built-in test runner for development tests only

There are no runtime dependencies, build tools, frameworks, backend services, or database requirements.

## Project structure

```text
OpportunityMap/
├── BUILD_WEEK_BASELINE.md
├── BUILD_WEEK_PROGRESS.md
├── index.html
├── styles.css
├── app.js
├── js/
│   ├── config.js
│   ├── eligibility.js
│   ├── matches-ui.js
│   ├── matching.js
│   ├── profile.js
│   └── storage.js
├── data/
│   └── opportunities.json
├── tests/
│   ├── config.test.js
│   ├── data.test.js
│   ├── eligibility.test.js
│   ├── markup.test.js
│   ├── matching.test.js
│   ├── profile.test.js
│   └── storage.test.js
├── package.json
└── README.md
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

## OpportunityMap AI Coach

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

### Current limitations and scope

- The directory intentionally remains the same small inventory of nine opportunities; ranking quality is limited by that coverage.
- Matching metadata is conservative and incomplete. Unknown factors reduce the amount of comparison evidence rather than reducing the score.
- Goal matching uses deterministic represented keywords, not semantic AI analysis.
- Broad profile ranges, especially experience, may require the student to verify an exact requirement.
- Programme criteria and deadlines can change after `lastVerified`; the official source is authoritative.
- Browser profiles do not synchronize between devices or browsers and disappear if site storage is cleared.
- There is no OpenAI or other API integration, account, backend, saved-opportunity feature, action plan, or progress tracker in Phase 2.

Run the focused development tests with:

```powershell
npm test
```

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

## Platform growth path

The JSON dataset is appropriate for the first version. A fuller platform can later add:

- a database and editorial content-management workflow;
- optional account-based profile synchronization, if later justified;
- saved opportunities and deadline reminders;
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
