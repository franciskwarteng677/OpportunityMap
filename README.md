# OpportunityMap

OpportunityMap is a static scholarship and opportunity finder designed for Ghanaian and African students. It brings scholarships, competitions, fellowships, research programmes, summer programmes, internships, and other academic pathways into one searchable, student-friendly directory.

This repository contains the professional directory plus the first OpenAI Build Week phase of **OpportunityMap AI Coach**. It remains intentionally framework-free, with no backend, database, account system, or API integration. Students can browse the full directory without creating a profile.

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
- Real OpportunityMap AI Coach introduction with honest Phase 1 scope
- Accessible landmarks, labels, focus states, status announcements, and reduced-motion support
- Accessible student profile creation, editing, summary, completeness, and clearing
- Canonical internal profile values for future explainable personalization
- Private, no-account profile persistence in the current browser only
- Defensive handling for missing, corrupted, unsupported, or unwritable browser storage

Opportunity matching, eligibility scoring, saved opportunities, action plans, and API features are not active in this phase. See `BUILD_WEEK_BASELINE.md` for the exact pre-hackathon boundary.

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
├── index.html
├── styles.css
├── app.js
├── js/
│   ├── config.js
│   ├── profile.js
│   └── storage.js
├── data/
│   └── opportunities.json
├── tests/
│   ├── config.test.js
│   ├── markup.test.js
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

Every object uses this structure:

```json
{
  "id": "opp-001",
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
  "verified": true
}
```

Deadline values may be ISO dates, rolling windows, vacancy-specific dates, or a clearly stated announcement status. The current filter statuses are `Open`, `Upcoming`, `Rolling`, and `Closed`.

`studentLevel`, `fundingType`, and `applicationType` use concise, human-readable values so the data can later support richer filters and AI matching. `sourceName` identifies the programme owner, while `lastVerified` records the most recent manual source check as an ISO date (`YYYY-MM-DD`).

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

## OpportunityMap AI Coach profile foundation

Students can now create a local profile containing citizenship, residence, optional age, education stage, interests, preferred categories, a broad goal, funding and mobility preferences, and experience level. Stable canonical values are stored under the versioned key `opportunityMapCoachState`.

Profile data stays in the current browser. It is not uploaded, synchronized, or backed up, and it may be lost when browser data is cleared. No account is required. Students should not enter contact details, identification numbers, grades, financial data, or other sensitive information.

This phase does not match or rank opportunities and does not make eligibility decisions. A later explainable layer can use the profile only after the verified opportunity data has suitable structured criteria. Manual browsing remains available at all times.

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
- personalised, explainable AI matching;
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
