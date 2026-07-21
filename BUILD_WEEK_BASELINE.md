# OpenAI Build Week baseline

## Baseline reference

Commit `f1b88ff` (`Initial professional OpportunityMap build`) is the pre–OpenAI Build Week baseline for this repository.

That commit is the boundary between the original OpportunityMap directory and the hackathon extension named **OpportunityMap AI Coach**. Build Week work must not be described as part of the original product, and existing directory behavior should remain available to students who do not create a profile.

## Functionality that existed before Build Week

The baseline was a framework-free static web application built with HTML, CSS, vanilla JavaScript, and JSON. It included:

- a responsive professional interface for desktop, tablet, and mobile;
- an education-access proposition focused on Ghanaian and African students;
- a directory of nine manually verified opportunities loaded from `data/opportunities.json`;
- scholarships, competitions, fellowships, research programs, summer programs, and internships;
- case-insensitive keyword search across opportunity and source details;
- category buttons plus country/reach, field, and deadline-status filters;
- combined filtering and one-click reset;
- URL query synchronization for the active search and filters;
- dynamically generated opportunity cards with no hardcoded opportunity records in HTML;
- title, description, location, eligibility summary, field, student level, funding type, deadline, source, and verification date on each card;
- secure links to official program sources;
- loading skeletons, an empty-results state, a data-error state, and retry handling;
- a helpful local-server message when browsers block JSON loading over `file://`;
- a dataset-driven regional distribution panel for African regions, Africa-wide opportunities, and international opportunities;
- primary, mobile, and footer navigation;
- semantic landmarks, labels, fieldsets, focus styles, status announcements, a skip link, and reduced-motion support;
- documentation for local serving, static deployment, data maintenance, and source verification; and
- a clearly labelled, non-functional visual preview of possible future AI matching.

The baseline did **not** include a student profile, browser persistence, matching, eligibility checks, match percentages, saved opportunities, progress tracking, application plans, accounts, a backend, or any OpenAI/API integration.

## New Build Week functionality

Phase 1 introduces only the student-profile and local-persistence foundation:

- a real OpportunityMap AI Coach entry point replacing the fictional matching preview;
- an accessible student profile form with canonical internal values;
- browser-only privacy and no-account explanations;
- versioned, namespaced local persistence under `opportunityMapCoachState`;
- defensive handling for missing, corrupted, unsupported, and unwritable browser storage;
- profile creation, editing, clearing, summary, completeness, validation, focus management, and visible status messages; and
- focused automated tests for profile and storage behavior.

## Explicitly outside Phase 1

The following remain future Build Week work and are not implemented in this phase:

- opportunity matching or ranking;
- match percentages or explanations;
- eligibility scoring, eligibility decisions, or missing-requirement warnings;
- saved opportunities;
- application action plans;
- application progress tracking; and
- OpenAI or other API integration.

The verified opportunity dataset remains unchanged in Phase 1. No opportunity requirements or eligibility information are inferred or fabricated.
