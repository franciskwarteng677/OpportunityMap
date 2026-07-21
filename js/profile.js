"use strict";

import {
  COUNTRY_CODES,
  EDUCATION_STAGE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  FIELD_OF_INTEREST_OPTIONS,
  FUNDING_PREFERENCE_OPTIONS,
  MOBILITY_PREFERENCE_OPTIONS,
  OPPORTUNITY_CATEGORY_OPTIONS,
  PROFILE_LIMITS,
  PROFILE_REQUIRED_FIELDS,
  getCountryOptions,
  getOptionLabel,
} from "./config.js";
import { clearStoredProfile, loadCoachState, resetCoachState, updateStoredProfile } from "./storage.js";

const OPTION_GROUPS = Object.freeze({
  educationStage: EDUCATION_STAGE_OPTIONS,
  fieldsOfInterest: FIELD_OF_INTEREST_OPTIONS,
  preferredCategories: OPPORTUNITY_CATEGORY_OPTIONS,
  fundingPreference: FUNDING_PREFERENCE_OPTIONS,
  mobilityPreference: MOBILITY_PREFERENCE_OPTIONS,
  experienceLevel: EXPERIENCE_LEVEL_OPTIONS,
});

const ERROR_TARGETS = Object.freeze({
  citizenshipCountry: "citizenship-country",
  residenceCountry: "residence-country",
  age: "profile-age",
  educationStage: "education-stage",
  fieldsOfInterest: "fields-of-interest-group",
  preferredCategories: "preferred-categories-group",
  goal: "profile-goal",
  fundingPreference: "funding-preference",
  mobilityPreference: "mobility-preference",
  experienceLevel: "experience-level",
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normaliseText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function optionIncludes(options, value) {
  return options.some((option) => option.value === value);
}

export function createEmptyProfile() {
  return {
    citizenshipCountry: "",
    residenceCountry: "",
    age: null,
    educationStage: "",
    fieldsOfInterest: [],
    preferredCategories: [],
    goal: "",
    fundingPreference: "",
    mobilityPreference: "",
    experienceLevel: "",
  };
}

export function normaliseProfile(value) {
  const source = isPlainObject(value) ? value : {};
  const rawAge = source.age;
  let age = null;

  if (typeof rawAge === "number") {
    age = Number.isFinite(rawAge) ? rawAge : Number.NaN;
  } else if (typeof rawAge === "string" && rawAge.trim() !== "") {
    const trimmedAge = rawAge.trim();
    age = /^\d+(?:\.\d+)?$/.test(trimmedAge) ? Number(trimmedAge) : Number.NaN;
  } else if (rawAge !== null && rawAge !== undefined && rawAge !== "") {
    age = Number.NaN;
  }

  return {
    citizenshipCountry: normaliseText(source.citizenshipCountry).toUpperCase(),
    residenceCountry: normaliseText(source.residenceCountry).toUpperCase(),
    age,
    educationStage: normaliseText(source.educationStage),
    fieldsOfInterest: normaliseArray(source.fieldsOfInterest),
    preferredCategories: normaliseArray(source.preferredCategories),
    goal: normaliseText(source.goal),
    fundingPreference: normaliseText(source.fundingPreference),
    mobilityPreference: normaliseText(source.mobilityPreference),
    experienceLevel: normaliseText(source.experienceLevel),
  };
}

export function validateProfile(value) {
  const profile = normaliseProfile(value);
  const errors = {};

  if (!COUNTRY_CODES.includes(profile.citizenshipCountry)) {
    errors.citizenshipCountry = "Choose your country of citizenship.";
  }

  if (!COUNTRY_CODES.includes(profile.residenceCountry)) {
    errors.residenceCountry = "Choose your current country of residence.";
  }

  if (
    profile.age !== null
    && (!Number.isInteger(profile.age)
      || profile.age < PROFILE_LIMITS.minimumAge
      || profile.age > PROFILE_LIMITS.maximumAge)
  ) {
    errors.age = `Enter a whole-number age between ${PROFILE_LIMITS.minimumAge} and ${PROFILE_LIMITS.maximumAge}, or leave it blank.`;
  }

  if (!optionIncludes(EDUCATION_STAGE_OPTIONS, profile.educationStage)) {
    errors.educationStage = "Choose your current education or career stage.";
  }

  if (
    !profile.fieldsOfInterest.length
    || profile.fieldsOfInterest.some((item) => !optionIncludes(FIELD_OF_INTEREST_OPTIONS, item))
  ) {
    errors.fieldsOfInterest = "Choose at least one field of interest.";
  }

  if (
    !profile.preferredCategories.length
    || profile.preferredCategories.some((item) => !optionIncludes(OPPORTUNITY_CATEGORY_OPTIONS, item))
  ) {
    errors.preferredCategories = "Choose at least one preferred opportunity category.";
  }

  if (!profile.goal) {
    errors.goal = "Describe one career or study goal.";
  } else if (profile.goal.length > PROFILE_LIMITS.goalMaximumLength) {
    errors.goal = `Keep your career or study goal within ${PROFILE_LIMITS.goalMaximumLength} characters.`;
  }

  if (!optionIncludes(FUNDING_PREFERENCE_OPTIONS, profile.fundingPreference)) {
    errors.fundingPreference = "Choose a funding preference.";
  }

  if (!optionIncludes(MOBILITY_PREFERENCE_OPTIONS, profile.mobilityPreference)) {
    errors.mobilityPreference = "Choose your travel or relocation preference.";
  }

  if (!optionIncludes(EXPERIENCE_LEVEL_OPTIONS, profile.experienceLevel)) {
    errors.experienceLevel = "Choose your relevant experience level.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    profile,
  };
}

export function hasProfile(value) {
  if (!isPlainObject(value)) return false;
  const profile = normaliseProfile(value);

  return Object.entries(profile).some(([, fieldValue]) => (
    Array.isArray(fieldValue) ? fieldValue.length > 0 : fieldValue !== "" && fieldValue !== null
  ));
}

export function calculateProfileCompleteness(value) {
  const { errors } = validateProfile(value);
  const missingFields = PROFILE_REQUIRED_FIELDS.filter((field) => Object.hasOwn(errors, field));
  const total = PROFILE_REQUIRED_FIELDS.length;
  const complete = total - missingFields.length;

  return {
    complete,
    total,
    percentage: Math.round((complete / total) * 100),
    missingFields,
  };
}

export function createProfileSummary(value, locale = "en") {
  const profile = normaliseProfile(value);
  const countryLabels = new Map(getCountryOptions(locale).map((country) => [country.value, country.label]));
  const listLabels = (options, values) => values.map((item) => getOptionLabel(options, item)).join(", ");

  return [
    { label: "Citizenship", value: countryLabels.get(profile.citizenshipCountry) || "Not provided" },
    { label: "Current residence", value: countryLabels.get(profile.residenceCountry) || "Not provided" },
    { label: "Age", value: profile.age === null ? "Not provided (optional)" : String(profile.age) },
    { label: "Education stage", value: getOptionLabel(EDUCATION_STAGE_OPTIONS, profile.educationStage) },
    { label: "Fields of interest", value: listLabels(FIELD_OF_INTEREST_OPTIONS, profile.fieldsOfInterest) || "Not provided" },
    { label: "Preferred categories", value: listLabels(OPPORTUNITY_CATEGORY_OPTIONS, profile.preferredCategories) || "Not provided" },
    { label: "Career or study goal", value: profile.goal || "Not provided" },
    { label: "Funding preference", value: getOptionLabel(FUNDING_PREFERENCE_OPTIONS, profile.fundingPreference) },
    { label: "Travel or relocation", value: getOptionLabel(MOBILITY_PREFERENCE_OPTIONS, profile.mobilityPreference) },
    { label: "Relevant experience", value: getOptionLabel(EXPERIENCE_LEVEL_OPTIONS, profile.experienceLevel) },
  ];
}

function appendOptions(select, options) {
  if (!select || select.options.length > 1) return;
  const fragment = document.createDocumentFragment();

  options.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    fragment.append(option);
  });

  select.append(fragment);
}

function appendChoiceOptions(container, options, name) {
  if (!container || container.children.length) return;
  const fragment = document.createDocumentFragment();

  options.forEach(({ value, label }) => {
    const wrapper = document.createElement("span");
    const input = document.createElement("input");
    const choiceLabel = document.createElement("label");
    const id = `${name}-${value.replaceAll("_", "-")}`;

    wrapper.className = "profile-choice";
    input.type = "checkbox";
    input.name = name;
    input.value = value;
    input.id = id;
    choiceLabel.htmlFor = id;
    choiceLabel.textContent = label;
    wrapper.append(input, choiceLabel);
    fragment.append(wrapper);
  });

  container.append(fragment);
}

function collectFormProfile(form) {
  const formData = new FormData(form);

  return normaliseProfile({
    citizenshipCountry: formData.get("citizenshipCountry"),
    residenceCountry: formData.get("residenceCountry"),
    age: formData.get("age"),
    educationStage: formData.get("educationStage"),
    fieldsOfInterest: formData.getAll("fieldsOfInterest"),
    preferredCategories: formData.getAll("preferredCategories"),
    goal: formData.get("goal"),
    fundingPreference: formData.get("fundingPreference"),
    mobilityPreference: formData.get("mobilityPreference"),
    experienceLevel: formData.get("experienceLevel"),
  });
}

function setControlValue(form, name, value) {
  const control = form.elements.namedItem(name);
  if (control && "value" in control) control.value = value ?? "";
}

function fillProfileForm(form, value) {
  const profile = normaliseProfile(value);
  form.reset();
  setControlValue(form, "citizenshipCountry", profile.citizenshipCountry);
  setControlValue(form, "residenceCountry", profile.residenceCountry);
  setControlValue(form, "age", profile.age);
  setControlValue(form, "educationStage", profile.educationStage);
  setControlValue(form, "goal", profile.goal);
  setControlValue(form, "fundingPreference", profile.fundingPreference);
  setControlValue(form, "mobilityPreference", profile.mobilityPreference);
  setControlValue(form, "experienceLevel", profile.experienceLevel);

  [
    ["fieldsOfInterest", profile.fieldsOfInterest],
    ["preferredCategories", profile.preferredCategories],
  ].forEach(([name, selectedValues]) => {
    form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
      input.checked = selectedValues.includes(input.value);
    });
  });
}

export function initialiseProfileExperience({ root = document, storage } = {}) {
  const section = root.querySelector("#ai-coach");
  if (!section) return null;

  const elements = {
    createButtons: [...root.querySelectorAll("[data-create-profile]")],
    workspace: root.querySelector("#profile-workspace"),
    status: root.querySelector("#profile-status"),
    emptyView: root.querySelector("#profile-empty-view"),
    emptyHeading: root.querySelector("#profile-empty-title"),
    formView: root.querySelector("#profile-editor"),
    formHeading: root.querySelector("#profile-form-title"),
    form: root.querySelector("#student-profile-form"),
    errorSummary: root.querySelector("#profile-error-summary"),
    errorList: root.querySelector("#profile-error-list"),
    formProgress: root.querySelector("#profile-form-progress"),
    formProgressText: root.querySelector("#profile-form-progress-text"),
    goalCount: root.querySelector("#profile-goal-count"),
    cancel: root.querySelector("#cancel-profile-edit"),
    discardInvalid: root.querySelector("#discard-invalid-profile"),
    resetState: root.querySelector("#reset-coach-data"),
    summaryView: root.querySelector("#profile-summary"),
    summaryHeading: root.querySelector("#profile-summary-title"),
    summaryList: root.querySelector("#profile-summary-list"),
    summaryProgress: root.querySelector("#profile-summary-progress"),
    summaryProgressText: root.querySelector("#profile-summary-progress-text"),
    edit: root.querySelector("#edit-profile"),
    clear: root.querySelector("#clear-profile"),
    clearDialog: root.querySelector("#clear-profile-dialog"),
    clearDialogTitle: root.querySelector("#clear-profile-title"),
    clearDialogDescription: root.querySelector("#clear-profile-description"),
    confirmClear: root.querySelector("#confirm-clear-profile"),
  };

  if (Object.entries(elements).some(([key, value]) => key !== "createButtons" && !value) || !elements.createButtons.length) {
    throw new Error("The student profile interface is missing required elements.");
  }

  const storageOptions = storage === undefined ? {} : { storage };
  const loaded = loadCoachState(storageOptions);
  let currentProfile = normaliseProfile(loaded.state.profile);
  let profileExists = hasProfile(loaded.state.profile);
  const initialValidation = validateProfile(currentProfile);
  let savedProfileIsValid = profileExists && initialValidation.valid;
  let persistentStorageIssue = loaded.ok ? "" : loaded.message;
  let pendingClearMode = "profile";

  appendOptions(root.querySelector("#citizenship-country"), getCountryOptions());
  appendOptions(root.querySelector("#residence-country"), getCountryOptions());
  appendOptions(root.querySelector("#education-stage"), EDUCATION_STAGE_OPTIONS);
  appendOptions(root.querySelector("#funding-preference"), FUNDING_PREFERENCE_OPTIONS);
  appendOptions(root.querySelector("#mobility-preference"), MOBILITY_PREFERENCE_OPTIONS);
  appendOptions(root.querySelector("#experience-level"), EXPERIENCE_LEVEL_OPTIONS);
  appendChoiceOptions(root.querySelector("#fields-of-interest-options"), FIELD_OF_INTEREST_OPTIONS, "fieldsOfInterest");
  appendChoiceOptions(root.querySelector("#preferred-categories-options"), OPPORTUNITY_CATEGORY_OPTIONS, "preferredCategories");

  function setStatus(type, message) {
    elements.status.hidden = !message;
    elements.status.className = `profile-message${type ? ` profile-message--${type}` : ""}`;
    elements.status.textContent = message;
  }

  function dispatchProfileChange(reason) {
    const view = root.defaultView || root.ownerDocument?.defaultView;
    if (!view?.CustomEvent || typeof root.dispatchEvent !== "function") return;

    root.dispatchEvent(new view.CustomEvent("opportunitymap:profilechange", {
      detail: {
        reason,
        exists: profileExists,
        valid: savedProfileIsValid,
        profile: savedProfileIsValid ? normaliseProfile(currentProfile) : createEmptyProfile(),
      },
    }));
  }

  function setView(view) {
    elements.emptyView.hidden = view !== "empty";
    elements.formView.hidden = view !== "form";
    elements.summaryView.hidden = view !== "summary";
    elements.createButtons.forEach((button) => {
      button.setAttribute("aria-expanded", String(view === "form"));
    });
  }

  function updateCreateButtonLabels() {
    elements.createButtons.forEach((button) => {
      const label = button.querySelector("[data-profile-cta-label]");
      if (label) label.textContent = profileExists ? button.dataset.editLabel : button.dataset.createLabel;
    });
  }

  function updateProgress(profile, progressElement, textElement) {
    const completeness = calculateProfileCompleteness(profile);
    const ageNeedsAttention = Boolean(validateProfile(profile).errors.age);
    progressElement.value = completeness.percentage;
    textElement.textContent = `${completeness.complete} of ${completeness.total} required sections complete (${completeness.percentage}%)${ageNeedsAttention ? "; optional age needs attention" : ""}`;
  }

  function updateFormProgress() {
    const profile = collectFormProfile(elements.form);
    updateProgress(profile, elements.formProgress, elements.formProgressText);
    elements.goalCount.textContent = `${profile.goal.length} / ${PROFILE_LIMITS.goalMaximumLength}`;
  }

  function clearFormErrors() {
    elements.errorSummary.hidden = true;
    elements.errorList.replaceChildren();
    elements.form.querySelectorAll("[aria-invalid='true']").forEach((control) => control.removeAttribute("aria-invalid"));
    elements.form.querySelectorAll(".field-error").forEach((message) => {
      message.hidden = true;
      message.textContent = "";
    });
  }

  function clearFieldError(field) {
    const targetId = ERROR_TARGETS[field];
    const target = targetId ? root.querySelector(`#${targetId}`) : null;
    const wrapper = elements.form.querySelector(`[data-profile-field="${field}"]`);
    const inlineError = wrapper?.querySelector(".field-error");
    const summaryItem = elements.errorList.querySelector(`[data-profile-error="${field}"]`);

    target?.removeAttribute("aria-invalid");
    if (inlineError) {
      inlineError.hidden = true;
      inlineError.textContent = "";
    }
    summaryItem?.remove();

    if (!elements.errorList.children.length) elements.errorSummary.hidden = true;
  }

  function renderFormErrors(errors) {
    clearFormErrors();
    const fragment = document.createDocumentFragment();

    Object.entries(errors).forEach(([field, message]) => {
      const targetId = ERROR_TARGETS[field];
      const target = root.querySelector(`#${targetId}`);
      const wrapper = elements.form.querySelector(`[data-profile-field="${field}"]`);
      const inlineError = wrapper?.querySelector(".field-error");
      const item = document.createElement("li");
      const link = document.createElement("a");

      item.dataset.profileError = field;

      if (target) target.setAttribute("aria-invalid", "true");
      if (inlineError) {
        inlineError.textContent = message;
        inlineError.hidden = false;
      }

      link.href = `#${targetId}`;
      link.textContent = message;
      link.addEventListener("click", () => {
        window.setTimeout(() => target?.focus(), 0);
      });
      item.append(link);
      fragment.append(item);
    });

    elements.errorList.append(fragment);
    elements.errorSummary.hidden = false;
    elements.errorSummary.focus({ preventScroll: true });
    elements.errorSummary.scrollIntoView({ block: "nearest" });
  }

  function renderSummary(profile) {
    const fragment = document.createDocumentFragment();

    createProfileSummary(profile).forEach((item) => {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = item.label;
      description.textContent = item.value;
      wrapper.append(term, description);
      fragment.append(wrapper);
    });

    elements.summaryList.replaceChildren(fragment);
    updateProgress(profile, elements.summaryProgress, elements.summaryProgressText);
  }

  function showForm(profile, { focus = true } = {}) {
    elements.workspace.hidden = false;
    setView("form");
    fillProfileForm(elements.form, profile);
    clearFormErrors();
    updateFormProgress();
    elements.cancel.hidden = false;
    elements.cancel.textContent = savedProfileIsValid ? "Cancel editing" : "Cancel";
    elements.discardInvalid.hidden = !profileExists || savedProfileIsValid;

    if (focus) {
      elements.formHeading.focus({ preventScroll: true });
      elements.formHeading.scrollIntoView({ block: "nearest" });
    }
  }

  function showSummary({ focus = false } = {}) {
    elements.workspace.hidden = false;
    renderSummary(currentProfile);
    setView("summary");

    if (focus) {
      elements.summaryHeading.focus({ preventScroll: true });
      elements.summaryHeading.scrollIntoView({ block: "nearest" });
    }
  }

  function showEmpty({ focus = false } = {}) {
    elements.workspace.hidden = false;
    setView("empty");
    if (focus) elements.emptyHeading.focus({ preventScroll: true });
  }

  elements.createButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (persistentStorageIssue) {
        setStatus("error", persistentStorageIssue);
      } else {
        setStatus("", "");
      }
      showForm(profileExists ? currentProfile : createEmptyProfile());
    });
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const validation = validateProfile(collectFormProfile(elements.form));

    if (!validation.valid) {
      renderFormErrors(validation.errors);
      setStatus("error", "Your profile has not been saved yet. Review the highlighted fields.");
      return;
    }

    const saved = updateStoredProfile(validation.profile, storageOptions);

    if (!saved.ok) {
      setStatus("error", saved.message);
      elements.formHeading.focus({ preventScroll: true });
      return;
    }

    currentProfile = validation.profile;
    profileExists = true;
    savedProfileIsValid = true;
    persistentStorageIssue = "";
    elements.resetState.hidden = true;
    elements.discardInvalid.hidden = true;
    updateCreateButtonLabels();
    setStatus("success", saved.message);
    showSummary({ focus: true });
    dispatchProfileChange("saved");
  });

  function handleFormChange(event) {
    updateFormProgress();
    const field = event.target.closest("[data-profile-field]")?.dataset.profileField;
    if (field) clearFieldError(field);
  }

  elements.form.addEventListener("input", handleFormChange);
  elements.form.addEventListener("change", handleFormChange);

  elements.cancel.addEventListener("click", () => {
    clearFormErrors();
    if (savedProfileIsValid) {
      setStatus("", "");
      showSummary({ focus: true });
    } else {
      setStatus(persistentStorageIssue ? "error" : "", persistentStorageIssue);
      showEmpty({ focus: true });
    }
  });

  elements.edit.addEventListener("click", () => {
    setStatus("", "");
    showForm(currentProfile);
  });

  function requestClearConfirmation(mode) {
    pendingClearMode = mode;
    const resettingState = mode === "state";
    elements.clearDialogTitle.textContent = resettingState ? "Reset coach data in this browser?" : "Clear your student profile?";
    elements.clearDialogDescription.textContent = resettingState
      ? "This replaces incompatible OpportunityMap AI Coach data stored by this site. It deletes any profile, saved opportunities, application statuses, checklist progress, custom tasks, and private notes, and cannot be undone. Directory browsing is not affected."
      : "This removes only the profile from this browser. Saved opportunities, application progress, tasks, and notes remain. This action cannot be undone.";
    elements.confirmClear.textContent = resettingState ? "Reset coach data" : "Clear profile";

    if (typeof elements.clearDialog.showModal === "function") {
      elements.clearDialog.showModal();
    } else if (window.confirm(elements.clearDialogDescription.textContent)) {
      elements.confirmClear.click();
    }
  }

  elements.clear.addEventListener("click", () => requestClearConfirmation("profile"));
  elements.discardInvalid.addEventListener("click", () => requestClearConfirmation("profile"));
  elements.resetState.addEventListener("click", () => requestClearConfirmation("state"));

  elements.confirmClear.addEventListener("click", () => {
    const cleared = pendingClearMode === "state"
      ? resetCoachState(storageOptions)
      : clearStoredProfile(storageOptions);
    if (elements.clearDialog.open) elements.clearDialog.close();

    if (!cleared.ok) {
      setStatus("error", cleared.message);
      const fallbackTarget = pendingClearMode === "state"
        ? elements.resetState
        : (!elements.formView.hidden && !elements.discardInvalid.hidden ? elements.discardInvalid : elements.clear);
      fallbackTarget.focus();
      return;
    }

    currentProfile = createEmptyProfile();
    profileExists = false;
    savedProfileIsValid = false;
    persistentStorageIssue = "";
    elements.resetState.hidden = true;
    updateCreateButtonLabels();
    setStatus("success", cleared.message);
    showEmpty({ focus: true });
    dispatchProfileChange(pendingClearMode === "state" ? "reset" : "cleared");
  });

  elements.resetState.hidden = !["corrupted", "unsupported"].includes(loaded.status);
  updateCreateButtonLabels();

  if (savedProfileIsValid) {
    currentProfile = initialValidation.profile;
    showSummary();
    if (!loaded.ok) setStatus("error", loaded.message);
  } else if (profileExists) {
    showForm(currentProfile, { focus: false });
    setStatus("error", "Your saved profile is incomplete or uses unsupported profile values. Review it before saving again.");
  } else if (!loaded.ok) {
    showEmpty();
    setStatus("error", loaded.message);
  } else {
    elements.workspace.hidden = true;
    setView("empty");
  }

  return {
    getProfile: () => normaliseProfile(currentProfile),
    showForm,
  };
}

export { OPTION_GROUPS };
