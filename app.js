"use strict";

import { validateEligibilityGuidance } from "./js/eligibility.js";
import { initialiseApplicationsExperience } from "./js/applications-ui.js";
import { buildMatchExplanations, validateMatchingMetadata } from "./js/matching.js";
import { initialiseMatchingExperience } from "./js/matches-ui.js";
import { initialiseProfileExperience } from "./js/profile.js";

const DATA_URL = "./data/opportunities.json";
const REQUIRED_FIELDS = [
  "id",
  "title",
  "category",
  "country",
  "region",
  "eligibleFor",
  "studentLevel",
  "field",
  "fundingType",
  "applicationType",
  "deadline",
  "deadlineStatus",
  "description",
  "sourceName",
  "officialUrl",
  "lastVerified",
  "verified",
];
const AFRICAN_REGIONS = ["West Africa", "East Africa", "Central Africa", "North Africa", "Southern Africa"];
const STATUS_ORDER = ["Open", "Upcoming", "Rolling", "Closed"];
const FILTER_PARAM_NAMES = ["search", "country", "field", "deadlineStatus", "category"];

const elements = {
  form: document.querySelector("#filter-form"),
  search: document.querySelector("#search-input"),
  country: document.querySelector("#country-filter"),
  field: document.querySelector("#field-filter"),
  status: document.querySelector("#status-filter"),
  categoryButtons: [...document.querySelectorAll("[data-category]")],
  reset: document.querySelector("#reset-filters"),
  emptyReset: document.querySelector("#empty-reset"),
  resultCount: document.querySelector("#result-count"),
  grid: document.querySelector("#opportunity-grid"),
  template: document.querySelector("#opportunity-card-template"),
  loading: document.querySelector("#loading-state"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  retry: document.querySelector("#retry-load"),
  regionBars: document.querySelector("#region-bars"),
  mapRegions: [...document.querySelectorAll("[data-map-region]")],
  africaWideCount: document.querySelector("#africa-wide-count"),
  internationalCount: document.querySelector("#international-count"),
  currentYear: document.querySelector("#current-year"),
  mobileNav: document.querySelector(".mobile-nav"),
};

let opportunities = [];
let activeCategory = "All";
let matchingExperience = null;
let applicationsExperience = null;

function normalise(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugify(value) {
  return normalise(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatDeadline(value) {
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!isoDatePattern.test(value)) {
    return { label: value, dateTime: "" };
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return { label: value, dateTime: "" };
  }

  return {
    label: new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
    dateTime: value,
  };
}

function assertValidData(data) {
  if (!Array.isArray(data)) {
    throw new Error("The opportunity dataset must be a JSON array.");
  }

  const ids = new Set();

  data.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Opportunity ${index + 1} is not a valid object.`);
    }

    const missingFields = REQUIRED_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(item, field));

    if (missingFields.length) {
      throw new Error(`Opportunity ${index + 1} is missing: ${missingFields.join(", ")}.`);
    }

    if (typeof item.verified !== "boolean") {
      throw new Error(`Opportunity ${index + 1} has an invalid verified value.`);
    }

    if (item.schemaVersion !== 2) {
      throw new Error(`Opportunity ${index + 1} must use schemaVersion 2.`);
    }

    const textFields = REQUIRED_FIELDS.filter((field) => field !== "verified");
    const invalidTextFields = textFields.filter(
      (field) => typeof item[field] !== "string" || !item[field].trim(),
    );

    if (invalidTextFields.length) {
      throw new Error(`Opportunity ${index + 1} has invalid text values: ${invalidTextFields.join(", ")}.`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.lastVerified)) {
      throw new Error(`Opportunity ${index + 1} must use an ISO date for lastVerified.`);
    }

    if (ids.has(item.id)) {
      throw new Error(`Duplicate opportunity id: ${item.id}.`);
    }

    ids.add(item.id);

    const officialUrl = new URL(item.officialUrl);
    if (officialUrl.protocol !== "https:") {
      throw new Error(`Opportunity ${index + 1} must use a secure official URL.`);
    }

    const metadataErrors = [
      ...validateMatchingMetadata(item),
      ...validateEligibilityGuidance(item),
    ];

    if (metadataErrors.length) {
      throw new Error(`Opportunity ${index + 1} has invalid coaching metadata: ${metadataErrors.join("; ")}.`);
    }
  });

  return data;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function addOptions(select, values) {
  const fragment = document.createDocumentFragment();

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    fragment.append(option);
  });

  select.append(fragment);
}

function populateFilters(data) {
  [elements.country, elements.field, elements.status].forEach((select) => {
    while (select.options.length > 1) select.remove(1);
  });

  addOptions(elements.country, uniqueSorted(data.map((item) => item.country)));
  addOptions(elements.field, uniqueSorted(data.map((item) => item.field)));

  const availableStatuses = new Set(data.map((item) => item.deadlineStatus));
  const statuses = [
    ...STATUS_ORDER.filter((status) => availableStatuses.has(status)),
    ...uniqueSorted([...availableStatuses].filter((status) => !STATUS_ORDER.includes(status))),
  ];
  addOptions(elements.status, statuses);
}

function updateCategoryButtons(category) {
  activeCategory = category;

  elements.categoryButtons.forEach((button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function hasSelectOption(select, value) {
  return [...select.options].some((option) => option.value === value);
}

function restoreFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const country = params.get("country") ?? "";
  const field = params.get("field") ?? "";
  const status = params.get("deadlineStatus") ?? "";
  const category = params.get("category") ?? "";
  const validCategory = elements.categoryButtons.some(
    (button) => button.dataset.category === category && category !== "All",
  );

  elements.search.value = (params.get("search") ?? "").trim();
  elements.country.value = hasSelectOption(elements.country, country) ? country : "";
  elements.field.value = hasSelectOption(elements.field, field) ? field : "";
  elements.status.value = hasSelectOption(elements.status, status) ? status : "";
  updateCategoryButtons(validCategory ? category : "All");
}

function syncFiltersToUrl() {
  const url = new URL(window.location.href);
  const search = elements.search.value.trim();

  FILTER_PARAM_NAMES.forEach((param) => url.searchParams.delete(param));

  if (search) url.searchParams.set("search", search);
  if (elements.country.value) url.searchParams.set("country", elements.country.value);
  if (elements.field.value) url.searchParams.set("field", elements.field.value);
  if (elements.status.value) url.searchParams.set("deadlineStatus", elements.status.value);
  if (activeCategory !== "All") url.searchParams.set("category", activeCategory);

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

function appendGuidanceList(container, items, fallback) {
  const fragment = document.createDocumentFragment();
  const values = items.length ? items : [fallback];

  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    fragment.append(item);
  });

  container.replaceChildren(fragment);
}

function appendEligibilityGroup(container, headingText, items, className) {
  if (!items.length) return;
  const section = document.createElement("section");
  const heading = document.createElement("h5");
  const list = document.createElement("ul");
  heading.textContent = headingText;
  section.className = className;

  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.append(item);
  });

  section.append(heading, list);
  container.append(section);
}

function populateMatchGuidance(card, guidance) {
  const { match, eligibility } = guidance;
  const wrapper = card.querySelector(".card__match-guidance");
  const eligibilityStatus = card.querySelector(".card__eligibility-status");
  const eligibilityDetails = card.querySelector(".card__eligibility-details");
  const scoreDetails = card.querySelector(".card__score-details");
  const statusLabels = {
    "confirmed-fit": "Represented requirements match",
    "known-conflict": "Known requirement conflict",
    "information-needed": "More information needed",
    "verify-at-source": "Potential fit — verify eligibility",
  };

  wrapper.hidden = false;
  card.dataset.matchScore = String(match.score);
  card.querySelector(".card__match-score").textContent = `${match.score}% profile match`;
  card.querySelector(".card__match-confidence").textContent =
    `Based on ${match.confidence.comparedFactors} of ${match.confidence.availableFactors} comparable factors`;
  eligibilityStatus.dataset.eligibilityStatus = eligibility.status;
  eligibilityStatus.textContent = statusLabels[eligibility.status] || "Check eligibility at source";

  appendGuidanceList(
    card.querySelector(".card__match-reasons"),
    buildMatchExplanations(match),
    "No represented preference produced a positive match reason; review the calculation and official details.",
  );

  eligibilityDetails.replaceChildren();
  appendEligibilityGroup(eligibilityDetails, "Represented checks that match", eligibility.confirmedChecks, "is-confirmed");
  appendEligibilityGroup(eligibilityDetails, "Known conflicts", eligibility.conflicts, "has-conflict");
  appendEligibilityGroup(eligibilityDetails, "Information needed", eligibility.informationNeeded, "needs-information");
  appendEligibilityGroup(
    eligibilityDetails,
    "Requirements to verify at the source",
    eligibility.sourceVerificationNeeded,
    "needs-source",
  );

  const formula = document.createElement("p");
  const breakdown = document.createElement("ul");
  formula.textContent = match.comparedWeight
    ? `${match.earnedWeight} matched weight points out of ${match.comparedWeight} compared points were normalized to ${match.score}%. Unknown or unavailable factors were excluded.`
    : "No represented factors could be compared, so the profile-match score is 0%. Unknown factors were excluded.";

  match.scoreBreakdown.forEach((factor) => {
    const item = document.createElement("li");
    const pointText = ["matched", "mismatched"].includes(factor.state)
      ? `${factor.earnedWeight} of ${factor.weight} points`
      : "excluded from scoring";
    item.textContent = `${factor.label}: ${pointText}. ${factor.message}`;
    breakdown.append(item);
  });

  scoreDetails.replaceChildren(formula, breakdown);
}

function createCard(opportunity, guidance = null) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const deadline = formatDeadline(opportunity.deadline);
  const lastVerified = formatDeadline(opportunity.lastVerified);
  const link = card.querySelector(".card__link");
  const verified = card.querySelector(".card__verified");
  const deadlineElement = card.querySelector(".card__deadline time");
  const lastVerifiedElement = card.querySelector(".card__last-verified time");
  const status = card.querySelector(".card__status");

  card.dataset.id = opportunity.id;
  card.dataset.category = slugify(opportunity.category);
  card.querySelector(".card__category").textContent = opportunity.category;
  status.dataset.status = slugify(opportunity.deadlineStatus);
  status.querySelector("span").textContent = opportunity.deadlineStatus;
  card.querySelector(".card__title").textContent = opportunity.title;
  card.querySelector(".card__description").textContent = opportunity.description;
  card.querySelector(".card__location").textContent = `${opportunity.country} · ${opportunity.region}`;
  card.querySelector(".card__eligible").textContent = opportunity.eligibleFor;
  card.querySelector(".card__field").textContent = opportunity.field;
  card.querySelector(".card__student-level").textContent = opportunity.studentLevel;
  card.querySelector(".card__funding").textContent = opportunity.fundingType;
  card.querySelector(".card__source").textContent = opportunity.sourceName;
  deadlineElement.textContent = deadline.label;
  lastVerifiedElement.textContent = lastVerified.label;
  lastVerifiedElement.dateTime = opportunity.lastVerified;
  verified.title = `Official source reviewed on ${lastVerified.label}`;

  if (deadline.dateTime) {
    deadlineElement.dateTime = deadline.dateTime;
  } else {
    const flexibleDeadline = document.createElement("span");
    flexibleDeadline.textContent = deadline.label;
    deadlineElement.replaceWith(flexibleDeadline);
  }

  if (!opportunity.verified) {
    verified.classList.add("is-unverified");
    verified.querySelector("span").textContent = "Source review pending";
    verified.title = "The official source has not yet been reviewed";
  }

  link.href = opportunity.officialUrl;
  link.setAttribute(
    "aria-label",
    `View official source for ${opportunity.title} (opens in a new tab)`,
  );

  if (guidance) populateMatchGuidance(card, guidance);
  applicationsExperience?.decorateOpportunityCard(card, opportunity);

  return card;
}

function renderCards(data) {
  const fragment = document.createDocumentFragment();

  data.forEach((opportunity) => {
    fragment.append(createCard(opportunity));
  });

  elements.grid.replaceChildren(fragment);
  elements.empty.hidden = data.length > 0;
}

function matchesSearch(opportunity, query) {
  if (!query) return true;

  const searchableText = [
    opportunity.title,
    opportunity.category,
    opportunity.country,
    opportunity.region,
    opportunity.eligibleFor,
    opportunity.studentLevel,
    opportunity.field,
    opportunity.fundingType,
    opportunity.applicationType,
    opportunity.deadline,
    opportunity.deadlineStatus,
    opportunity.description,
    opportunity.sourceName,
    opportunity.lastVerified,
  ]
    .map(normalise)
    .join(" ");

  return searchableText.includes(query);
}

function applyFilters({ syncUrl = true } = {}) {
  const query = normalise(elements.search.value);
  const country = elements.country.value;
  const field = elements.field.value;
  const status = elements.status.value;

  const filtered = opportunities.filter((opportunity) => {
    const categoryMatches = activeCategory === "All" || opportunity.category === activeCategory;
    const countryMatches = !country || opportunity.country === country;
    const fieldMatches = !field || opportunity.field === field;
    const statusMatches = !status || opportunity.deadlineStatus === status;

    return categoryMatches && countryMatches && fieldMatches && statusMatches && matchesSearch(opportunity, query);
  });

  renderCards(filtered);
  elements.resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "opportunity" : "opportunities"} found`;

  if (syncUrl) {
    syncFiltersToUrl();
  }
}

function resetFilters({ focusSearch = false } = {}) {
  elements.search.value = "";
  elements.country.value = "";
  elements.field.value = "";
  elements.status.value = "";
  updateCategoryButtons("All");
  applyFilters();

  if (focusSearch) {
    elements.search.focus({ preventScroll: true });
  }
}

function renderDistribution(data) {
  // Future research dashboard hook: this aggregation can later be expanded with
  // country-level coverage, time-series trends, equity indicators, and map data.
  const regionCounts = Object.fromEntries(AFRICAN_REGIONS.map((region) => [region, 0]));

  data.forEach((opportunity) => {
    if (Object.prototype.hasOwnProperty.call(regionCounts, opportunity.region)) {
      regionCounts[opportunity.region] += 1;
    }
  });

  elements.mapRegions.forEach((regionElement) => {
    const region = regionElement.dataset.mapRegion;
    regionElement.querySelector("strong").textContent = regionCounts[region];
    regionElement.setAttribute(
      "aria-label",
      `${region}: ${regionCounts[region]} ${regionCounts[region] === 1 ? "listing" : "listings"}`,
    );
  });

  const maxCount = Math.max(1, ...Object.values(regionCounts));
  const bars = document.createDocumentFragment();

  AFRICAN_REGIONS.forEach((region) => {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    const label = document.createElement("span");
    const count = document.createElement("strong");
    const track = document.createElement("div");
    const fill = document.createElement("span");

    heading.className = "region-bar__top";
    track.className = "region-bar__track";
    fill.className = "region-bar__fill";
    label.textContent = region;
    count.textContent = `${regionCounts[region]} ${regionCounts[region] === 1 ? "listing" : "listings"}`;
    fill.style.setProperty("--bar-width", `${(regionCounts[region] / maxCount) * 100}%`);
    track.setAttribute("aria-hidden", "true");

    heading.append(label, count);
    track.append(fill);
    item.append(heading, track);
    bars.append(item);
  });

  elements.regionBars.replaceChildren(bars);
  elements.africaWideCount.textContent = data.filter((item) => item.region === "Africa-wide").length;
  elements.internationalCount.textContent = data.filter((item) => item.region === "International").length;
}

function setLoading(isLoading) {
  elements.loading.hidden = !isLoading;
  elements.grid.hidden = isLoading;

  if (isLoading) {
    elements.empty.hidden = true;
    elements.error.hidden = true;
    elements.resultCount.textContent = "Loading opportunities…";
  }
}

function showLoadError(error) {
  console.error("OpportunityMap data load failed:", error);
  setLoading(false);
  elements.grid.replaceChildren();
  elements.grid.hidden = true;
  elements.empty.hidden = true;
  elements.error.hidden = false;
  elements.resultCount.textContent = "Directory unavailable";
  matchingExperience?.setDataError();
  applicationsExperience?.setDataError();

  if (window.location.protocol === "file:") {
    elements.errorMessage.textContent =
      "This browser blocks local JSON files when a page is opened directly. Run a small local server using the README instructions, then open the local address.";
  } else {
    elements.errorMessage.textContent =
      "The opportunity data could not be loaded. Check your connection, refresh the page, or try again.";
  }
}

async function loadOpportunities() {
  setLoading(true);

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Data request failed with status ${response.status}.`);
    }

    const data = assertValidData(await response.json());
    opportunities = data;

    populateFilters(opportunities);
    restoreFiltersFromUrl();
    renderDistribution(opportunities);
    setLoading(false);
    elements.grid.hidden = false;
    applicationsExperience?.setOpportunities(opportunities);
    matchingExperience?.setOpportunities(opportunities);
    applyFilters();
  } catch (error) {
    showLoadError(error);
  }
}

function bindEvents() {
  elements.search.addEventListener("input", applyFilters);
  elements.country.addEventListener("change", applyFilters);
  elements.field.addEventListener("change", applyFilters);
  elements.status.addEventListener("change", applyFilters);

  elements.categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updateCategoryButtons(button.dataset.category);
      applyFilters();
    });
  });

  elements.form.addEventListener("reset", (event) => {
    event.preventDefault();
    resetFilters();
  });

  elements.emptyReset.addEventListener("click", () => resetFilters({ focusSearch: true }));
  elements.retry.addEventListener("click", loadOpportunities);
  window.addEventListener("popstate", () => {
    if (!opportunities.length) return;

    restoreFiltersFromUrl();
    applyFilters();
  });

  if (elements.mobileNav) {
    const mobileNavLabel = elements.mobileNav.querySelector(".sr-only");
    elements.mobileNav.addEventListener("toggle", () => {
      mobileNavLabel.textContent = elements.mobileNav.open ? "Close navigation" : "Open navigation";
    });
    elements.mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => elements.mobileNav.removeAttribute("open"));
    });
  }
}

function initialise() {
  elements.currentYear.textContent = new Date().getFullYear();
  bindEvents();
  const profileExperience = initialiseProfileExperience();
  applicationsExperience = initialiseApplicationsExperience({
    getProfile: profileExperience.getProfile,
  });
  matchingExperience = initialiseMatchingExperience({
    getProfile: profileExperience.getProfile,
    editProfile: () => profileExperience.showForm(profileExperience.getProfile()),
    createOpportunityCard: createCard,
  });
  loadOpportunities();
}

initialise();
