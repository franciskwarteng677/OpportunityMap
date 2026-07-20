"use strict";

import {
  EDUCATION_STAGE_OPTIONS,
  FIELD_OF_INTEREST_OPTIONS,
  OPPORTUNITY_CATEGORY_OPTIONS,
  getOptionLabel,
} from "./config.js";
import { evaluateEligibility } from "./eligibility.js";
import { rankOpportunityMatches } from "./matching.js";
import { validateProfile } from "./profile.js";

function setMessage(element, type, message) {
  element.hidden = !message;
  element.className = `profile-message${type ? ` profile-message--${type}` : ""}`;
  element.textContent = message;
}

function renderProfileContext(elements, profile) {
  const fields = profile.fieldsOfInterest
    .slice(0, 2)
    .map((value) => getOptionLabel(FIELD_OF_INTEREST_OPTIONS, value));
  const categories = profile.preferredCategories
    .slice(0, 2)
    .map((value) => getOptionLabel(OPPORTUNITY_CATEGORY_OPTIONS, value));
  const items = [
    ["Current stage", getOptionLabel(EDUCATION_STAGE_OPTIONS, profile.educationStage)],
    ["Selected interests", fields.join(", ")],
    ["Preferred categories", categories.join(", ")],
  ];
  const fragment = document.createDocumentFragment();

  items.forEach(([label, value]) => {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    fragment.append(wrapper);
  });

  elements.profileContext.replaceChildren(fragment);
  elements.profileContextCopy.textContent = "Matches use only represented opportunity metadata and this saved browser profile.";
}

export function initialiseMatchingExperience({
  root = document,
  getProfile,
  editProfile,
  createOpportunityCard,
} = {}) {
  const elements = {
    required: root.querySelector("#matching-profile-required"),
    requiredHeading: root.querySelector("#matching-profile-required-title"),
    ready: root.querySelector("#matching-ready"),
    profileContext: root.querySelector("#matching-profile-context"),
    profileContextCopy: root.querySelector("#matching-profile-context-copy"),
    editProfile: root.querySelector("#matching-edit-profile"),
    findMatches: root.querySelector("#find-matches"),
    dataStatus: root.querySelector("#matching-data-status"),
    status: root.querySelector("#matching-status"),
    results: root.querySelector("#matching-results"),
    resultsHeading: root.querySelector("#matching-results-title"),
    resultsSummary: root.querySelector("#matching-results-summary"),
    resultCount: root.querySelector("#matching-result-count"),
    grid: root.querySelector("#matching-grid"),
    empty: root.querySelector("#matching-empty-view"),
    viewButtons: [...root.querySelectorAll("[data-match-view]")],
  };

  if (
    typeof getProfile !== "function"
    || typeof editProfile !== "function"
    || typeof createOpportunityCard !== "function"
    || Object.entries(elements).some(([key, value]) => key !== "viewButtons" && !value)
    || !elements.viewButtons.length
  ) {
    throw new Error("The personalized matching interface is missing required dependencies or elements.");
  }

  let opportunities = [];
  let dataState = "loading";
  let generated = false;
  let activeView = "best";
  let matchedProfile = null;

  function currentValidProfile() {
    const validation = validateProfile(getProfile());
    return validation.valid ? validation.profile : null;
  }

  function updateFindAvailability() {
    elements.findMatches.disabled = dataState !== "ready" || !currentValidProfile();
    elements.dataStatus.textContent = dataState === "ready"
      ? `${opportunities.length} verified opportunities ready to compare.`
      : dataState === "error"
        ? "Opportunity data unavailable."
        : "Loading verified opportunities…";
  }

  function showProfileRequired({ focus = false, message = "" } = {}) {
    elements.required.hidden = false;
    elements.ready.hidden = true;
    elements.results.hidden = true;
    generated = false;
    matchedProfile = null;
    elements.grid.replaceChildren();
    if (message) setMessage(elements.status, "", message);
    if (focus) elements.requiredHeading.focus({ preventScroll: true });
  }

  function showReady(profile, { message = "" } = {}) {
    elements.required.hidden = true;
    elements.ready.hidden = false;
    renderProfileContext(elements, profile);
    updateFindAvailability();
    if (message) setMessage(elements.status, "success", message);
  }

  function updateViewButtons() {
    elements.viewButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.matchView === activeView));
    });
  }

  function renderResults() {
    if (!generated || !matchedProfile) return;
    const rankedMatches = rankOpportunityMatches(opportunities, matchedProfile, { view: activeView });
    const opportunitiesById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
    const fragment = document.createDocumentFragment();

    rankedMatches.forEach((match) => {
      const opportunity = opportunitiesById.get(match.opportunityId);
      if (!opportunity) return;
      const eligibility = evaluateEligibility(opportunity, matchedProfile);
      const card = createOpportunityCard(opportunity, { match, eligibility });
      card.setAttribute("role", "listitem");
      fragment.append(card);
    });

    elements.grid.replaceChildren(fragment);
    elements.empty.hidden = rankedMatches.length > 0;
    elements.resultCount.textContent = `${rankedMatches.length} ${rankedMatches.length === 1 ? "opportunity" : "opportunities"} in this view.`;
    updateViewButtons();
  }

  function generateMatches() {
    const profile = currentValidProfile();

    if (!profile) {
      showProfileRequired({ focus: true, message: "Create and save a complete profile before generating personalized matches." });
      return;
    }

    if (dataState !== "ready") {
      setMessage(elements.status, "error", "The verified opportunity data is not available yet. Try again after it loads.");
      return;
    }

    matchedProfile = profile;
    generated = true;
    activeView = "best";
    elements.results.hidden = false;
    elements.resultsSummary.textContent = `${opportunities.length} verified opportunities compared. Best matches place currently actionable opportunities before closed opportunities.`;
    renderResults();
    setMessage(elements.status, "success", `Personalized results generated. ${opportunities.length} opportunities compared.`);
    elements.resultsHeading.focus({ preventScroll: true });
    elements.resultsHeading.scrollIntoView({ block: "nearest" });
  }

  elements.findMatches.addEventListener("click", generateMatches);
  elements.editProfile.addEventListener("click", () => editProfile());
  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.matchView;
      renderResults();
    });
  });

  root.addEventListener("opportunitymap:profilechange", (event) => {
    if (event.detail?.valid) {
      elements.results.hidden = true;
      generated = false;
      matchedProfile = null;
      showReady(event.detail.profile, {
        message: "Profile saved. Generate new matches to use your updated profile.",
      });
    } else {
      showProfileRequired({
        focus: false,
        message: "Your saved profile was removed. Create a profile to generate personalized matches.",
      });
    }
  });

  const initialProfile = currentValidProfile();
  if (initialProfile) {
    showReady(initialProfile);
  } else {
    showProfileRequired();
  }
  updateFindAvailability();

  return {
    setOpportunities(data) {
      opportunities = Array.isArray(data) ? [...data] : [];
      dataState = opportunities.length > 0 ? "ready" : "error";
      if (dataState === "ready" && elements.status.classList.contains("profile-message--error")) {
        setMessage(elements.status, "", "");
      }
      updateFindAvailability();
    },
    setDataError() {
      opportunities = [];
      dataState = "error";
      updateFindAvailability();
      elements.results.hidden = true;
      generated = false;
      setMessage(elements.status, "error", "Personalized matching is unavailable until the verified directory loads.");
    },
  };
}
