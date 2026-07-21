"use strict";

import { calculateOverallProgress, calculateTaskProgress } from "./action-plans.js";
import {
  APPLICATION_LIMITS,
  APPLICATION_STATUS_OPTIONS,
  TASK_SOURCE_TYPE_OPTIONS,
  TASK_STATUS_OPTIONS,
  getOptionLabel,
} from "./config.js";
import { evaluateEligibility } from "./eligibility.js";
import { matchOpportunity } from "./matching.js";
import { validateProfile } from "./profile.js";
import {
  addOpportunityCustomTask,
  changeApplicationStatus,
  changeTaskStatus,
  deleteOpportunityCustomTask,
  editOpportunityCustomTask,
  resetOpportunityChecklist,
  saveOpportunity,
  saveOpportunityNotes,
  unsaveOpportunity,
} from "./saved-opportunities.js";
import { loadCoachState } from "./storage.js";

const ELIGIBILITY_LABELS = Object.freeze({
  "confirmed-fit": "Represented requirements match — verify at source",
  "known-conflict": "Known requirement conflict",
  "information-needed": "More information needed",
  "verify-at-source": "Potential fit — verify eligibility",
});

function formatDate(value, fallback = "Not available") {
  if (typeof value !== "string") return fallback;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value || fallback;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function setMessage(element, type, message) {
  const baseClass = element.id === "applications-status" ? "applications-message" : "profile-message";
  element.hidden = !message;
  element.className = `${baseClass}${type ? ` ${baseClass}--${type}` : ""}`;
  element.textContent = message;
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function appendOptions(select, options, selectedValue) {
  const fragment = select.ownerDocument.createDocumentFragment();
  options.forEach(({ value, label }) => {
    const option = select.ownerDocument.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedValue;
    fragment.append(option);
  });
  select.replaceChildren(fragment);
}

function currentValidProfile(getProfile) {
  if (typeof getProfile !== "function") return null;
  const validation = validateProfile(getProfile());
  return validation.valid ? validation.profile : null;
}

function findByDataValue(elements, attribute, value) {
  return [...elements].find((element) => element.dataset[attribute] === value) || null;
}

export function initialiseApplicationsExperience({
  root = document,
  getProfile,
  storage,
} = {}) {
  const elements = {
    heading: root.querySelector("#applications-title"),
    status: root.querySelector("#applications-status"),
    empty: root.querySelector("#applications-empty"),
    content: root.querySelector("#applications-content"),
    savedCount: root.querySelector("#applications-saved-count"),
    statusSummary: root.querySelector("#applications-status-summary"),
    overallProgress: root.querySelector("#applications-overall-progress"),
    progressText: root.querySelector("#applications-progress-text"),
    resultCount: root.querySelector("#applications-result-count"),
    list: root.querySelector("#applications-list"),
    filterEmpty: root.querySelector("#applications-filter-empty"),
    filterButtons: [...root.querySelectorAll("[data-application-filter]")],
    cardTemplate: root.querySelector("#application-card-template"),
    confirmDialog: root.querySelector("#application-confirm-dialog"),
    confirmTitle: root.querySelector("#application-confirm-title"),
    confirmDescription: root.querySelector("#application-confirm-description"),
    confirmAction: root.querySelector("#confirm-application-action"),
    customDialog: root.querySelector("#custom-task-dialog"),
    customForm: root.querySelector("#custom-task-form"),
    customInput: root.querySelector("#custom-task-input"),
    customError: root.querySelector("#custom-task-error"),
  };

  if (
    Object.entries(elements).some(([key, value]) => key !== "filterButtons" && !value)
    || !elements.filterButtons.length
  ) {
    throw new Error("The My Applications interface is missing required elements.");
  }

  const storageOptions = storage === undefined ? {} : { storage };
  let opportunitiesById = new Map();
  let dataState = "loading";
  let activeFilter = "all";
  let loadedState = loadCoachState(storageOptions);
  let pendingConfirmation = null;
  let confirmationOpener = null;
  let editingTask = null;

  function savedMap() {
    return loadedState.ok ? loadedState.state.savedOpportunities : {};
  }

  function getSavedRecord(opportunityId) {
    const records = savedMap();
    return Object.hasOwn(records, opportunityId) ? records[opportunityId] : null;
  }

  function setCardMessage(opportunityId, type, message) {
    const card = [...elements.list.querySelectorAll(".application-card")]
      .find((item) => item.dataset.opportunityId === opportunityId);
    const messageElement = card?.querySelector(".application-card__message");
    if (!messageElement) return;
    messageElement.hidden = !message;
    messageElement.className = `application-card__message${type === "error" ? " is-error" : ""}`;
    messageElement.textContent = message;
  }

  function updateFilterButtons() {
    elements.filterButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.applicationFilter === activeFilter));
    });
  }

  function updateSaveButton(button) {
    const opportunityId = button.dataset.opportunityId;
    const isSaved = Boolean(getSavedRecord(opportunityId));
    const label = button.querySelector("[data-save-label]");
    const title = button.closest(".opportunity-card")?.querySelector(".card__title")?.textContent || "this opportunity";
    button.setAttribute("aria-pressed", String(isSaved));
    button.classList.toggle("is-saved", isSaved);
    button.disabled = !loadedState.ok;
    if (label) label.textContent = isSaved ? "Saved" : "Save";
    button.setAttribute(
      "aria-label",
      isSaved
        ? `Saved: ${title}. Activate to remove it from My Applications.`
        : `Save ${title} to My Applications. Saving does not confirm eligibility.`,
    );
  }

  function synchronizeSaveButtons() {
    root.querySelectorAll("[data-save-opportunity]").forEach(updateSaveButton);
  }

  function renderStatusSummary(records) {
    const documentRef = elements.statusSummary.ownerDocument;
    const counts = Object.fromEntries(APPLICATION_STATUS_OPTIONS.map(({ value }) => [value, 0]));
    records.forEach((record) => { counts[record.applicationStatus] += 1; });
    const fragment = documentRef.createDocumentFragment();

    APPLICATION_STATUS_OPTIONS.forEach(({ value, label }) => {
      const item = documentRef.createElement("li");
      const count = documentRef.createElement("strong");
      const text = documentRef.createElement("span");
      count.textContent = String(counts[value]);
      text.textContent = label;
      item.append(count, text);
      fragment.append(item);
    });
    elements.statusSummary.replaceChildren(fragment);
  }

  function createTaskItem(record, task, index) {
    const documentRef = elements.list.ownerDocument;
    const item = documentRef.createElement("li");
    const text = documentRef.createElement("div");
    const title = documentRef.createElement("p");
    const source = documentRef.createElement("span");
    const statusWrap = documentRef.createElement("div");
    const label = documentRef.createElement("label");
    const select = documentRef.createElement("select");
    const inputId = `task-status-${record.opportunityId}-${index}`;

    item.className = "application-task";
    item.dataset.taskId = task.id;
    text.className = "application-task__content";
    title.className = "application-task__title";
    title.textContent = task.title;
    source.className = `application-task__source application-task__source--${task.sourceType}`;
    source.dataset.sourceType = task.sourceType;
    source.textContent = getOptionLabel(TASK_SOURCE_TYPE_OPTIONS, task.sourceType, "Task");
    text.append(title, source);

    label.className = "sr-only";
    label.htmlFor = inputId;
    label.textContent = `Status for ${task.title}`;
    select.id = inputId;
    select.dataset.taskStatus = "";
    select.dataset.opportunityId = record.opportunityId;
    select.dataset.taskId = task.id;
    appendOptions(select, TASK_STATUS_OPTIONS, task.status);
    statusWrap.className = "application-task__status";
    statusWrap.append(label, select);
    item.append(text, statusWrap);

    if (task.sourceType === "custom") {
      const actions = documentRef.createElement("div");
      const edit = documentRef.createElement("button");
      const remove = documentRef.createElement("button");
      actions.className = "application-task__actions";
      edit.type = "button";
      edit.dataset.editCustomTask = "";
      edit.dataset.opportunityId = record.opportunityId;
      edit.dataset.taskId = task.id;
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit custom task: ${task.title}`);
      remove.type = "button";
      remove.dataset.deleteCustomTask = "";
      remove.dataset.opportunityId = record.opportunityId;
      remove.dataset.taskId = task.id;
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", `Delete custom task: ${task.title}`);
      actions.append(edit, remove);
      item.append(actions);
    }

    return item;
  }

  function renderTasks(card, record) {
    const list = card.querySelector(".application-task-list");
    const fragment = list.ownerDocument.createDocumentFragment();
    record.tasks.forEach((task, index) => fragment.append(createTaskItem(record, task, index)));
    list.replaceChildren(fragment);
  }

  function renderCurrentGuidance(card, opportunity) {
    const section = card.querySelector(".application-card__current-guidance");
    const profile = currentValidProfile(getProfile);
    if (!opportunity || !profile) {
      section.hidden = true;
      return;
    }

    const match = matchOpportunity(opportunity, profile);
    const eligibility = evaluateEligibility(opportunity, profile);
    card.querySelector(".application-card__match").textContent =
      `${match.score}% current profile match — based on ${match.confidence.comparedFactors} of ${match.confidence.availableFactors} comparable factors.`;
    card.querySelector(".application-card__eligibility").textContent =
      ELIGIBILITY_LABELS[eligibility.status] || "Check current eligibility at the official source.";
    section.hidden = false;
  }

  function renderApplicationCard(record, openManagementIds) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const opportunity = opportunitiesById.get(record.opportunityId);
    const progress = calculateTaskProgress(record.tasks);
    const statusSelect = card.querySelector(".application-card__status-select");
    const details = card.querySelector(".application-card__manage");
    const notes = card.querySelector(".application-notes");
    const official = card.querySelector(".application-card__official");
    const resetButton = card.querySelector("[data-reset-checklist]");

    card.dataset.opportunityId = record.opportunityId;
    card.setAttribute("role", "listitem");
    card.querySelector(".application-card__saved-date").textContent = formatDate(record.savedAt);
    card.querySelector(".application-card__status-label").textContent =
      getOptionLabel(APPLICATION_STATUS_OPTIONS, record.applicationStatus, "Saved");
    statusSelect.dataset.opportunityId = record.opportunityId;
    statusSelect.id = `application-status-${record.opportunityId}`;
    const statusLabel = card.querySelector("label[for='application-status-template']");
    if (statusLabel) statusLabel.htmlFor = statusSelect.id;
    appendOptions(statusSelect, APPLICATION_STATUS_OPTIONS, record.applicationStatus);
    card.querySelector(".application-card__progress").value = progress.percentage;
    card.querySelector(".application-card__progress").textContent = `${progress.percentage}%`;
    card.querySelector(".application-card__progress-text").textContent =
      `${progress.completed} of ${progress.total} tasks complete (${progress.percentage}%)`;
    notes.value = record.notes;
    notes.dataset.opportunityId = record.opportunityId;
    notes.id = `application-notes-${record.opportunityId}`;
    notes.maxLength = APPLICATION_LIMITS.notesMaximumLength;
    const notesLabel = card.querySelector("label[for='application-notes-template']");
    if (notesLabel) notesLabel.htmlFor = notes.id;
    card.querySelector(".application-notes-form").dataset.opportunityId = record.opportunityId;
    card.querySelector(".application-notes-count").textContent =
      `${record.notes.length} / ${APPLICATION_LIMITS.notesMaximumLength}`;
    const customInput = card.querySelector("[data-custom-task-input]");
    customInput.maxLength = APPLICATION_LIMITS.customTaskTitleMaximumLength;
    customInput.id = `custom-task-${record.opportunityId}`;
    const customLabel = card.querySelector("label[for='custom-task-template']");
    if (customLabel) customLabel.htmlFor = customInput.id;
    card.querySelector("[data-custom-task-form]").dataset.opportunityId = record.opportunityId;
    card.querySelector(".custom-task-count").textContent = `0 / ${APPLICATION_LIMITS.customTaskTitleMaximumLength}`;
    resetButton.dataset.opportunityId = record.opportunityId;
    const unsave = card.querySelector("[data-unsave-opportunity]");
    unsave.dataset.opportunityId = record.opportunityId;
    unsave.setAttribute("aria-label", `Remove ${opportunity?.title || `opportunity ${record.opportunityId}`} from My Applications`);
    details.open = openManagementIds.has(record.opportunityId);

    if (opportunity) {
      card.dataset.category = slugify(opportunity.category);
      card.querySelector(".application-card__category").textContent = opportunity.category;
      const deadlineStatus = card.querySelector(".application-card__deadline-status");
      deadlineStatus.textContent = opportunity.deadlineStatus;
      deadlineStatus.dataset.status = slugify(opportunity.deadlineStatus);
      card.querySelector(".application-card__title").textContent = opportunity.title;
      card.querySelector(".application-card__deadline").textContent = formatDate(opportunity.deadline, opportunity.deadline);
      official.href = opportunity.officialUrl;
      official.setAttribute("aria-label", `View official source for ${opportunity.title} (opens in a new tab)`);
      renderCurrentGuidance(card, opportunity);
    } else {
      card.classList.add("application-card--unavailable");
      card.querySelector(".application-card__category").textContent = "Saved record";
      card.querySelector(".application-card__deadline-status").textContent = dataState === "loading" ? "Loading details" : "Details unavailable";
      card.querySelector(".application-card__title").textContent = `Opportunity ID: ${record.opportunityId}`;
      card.querySelector(".application-card__deadline").textContent = "Not available";
      const unavailableMessage = card.querySelector(".application-card__unavailable");
      unavailableMessage.textContent = dataState === "loading"
        ? "Loading the current directory record. Your saved application work is already available."
        : "This saved opportunity is not currently available in the directory. Your saved work has been retained.";
      unavailableMessage.hidden = false;
      official.hidden = true;
      official.removeAttribute("href");
      resetButton.disabled = true;
      resetButton.title = "Checklist reset requires the current verified opportunity record.";
      card.querySelector(".application-card__current-guidance").hidden = true;
    }

    renderTasks(card, record);
    return card;
  }

  function getOpenManagementIds() {
    return new Set([...elements.list.querySelectorAll(".application-card__manage[open]")]
      .map((details) => details.closest(".application-card")?.dataset.opportunityId)
      .filter(Boolean));
  }

  function renderDashboard({ keepOpen = [], forceOpen = "" } = {}) {
    synchronizeSaveButtons();
    updateFilterButtons();

    if (!loadedState.ok) {
      elements.empty.hidden = true;
      elements.content.hidden = true;
      elements.list.replaceChildren();
      setMessage(elements.status, "error", loadedState.message);
      return;
    }

    const records = Object.values(savedMap()).sort((a, b) => (
      b.updatedAt.localeCompare(a.updatedAt) || a.opportunityId.localeCompare(b.opportunityId)
    ));
    const hasRecords = records.length > 0;
    elements.empty.hidden = hasRecords;
    elements.content.hidden = !hasRecords;

    if (!hasRecords) {
      elements.list.replaceChildren();
      return;
    }

    elements.savedCount.textContent = String(records.length);
    renderStatusSummary(records);
    const overall = calculateOverallProgress(records);
    elements.overallProgress.value = overall.percentage;
    elements.overallProgress.textContent = `${overall.percentage}%`;
    elements.progressText.textContent = `${overall.completed} of ${overall.total} tasks complete (${overall.percentage}%) across all saved opportunities, including archived items.`;

    const filtered = activeFilter === "all"
      ? records
      : records.filter((record) => record.applicationStatus === activeFilter);
    const openManagementIds = new Set([...keepOpen, forceOpen].filter(Boolean));
    const fragment = elements.list.ownerDocument.createDocumentFragment();
    filtered.forEach((record) => fragment.append(renderApplicationCard(record, openManagementIds)));
    elements.list.replaceChildren(fragment);
    elements.filterEmpty.hidden = filtered.length > 0;
    elements.resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "saved opportunity" : "saved opportunities"} in this view.`;
  }

  function reloadAndRender(options = {}) {
    const openIds = getOpenManagementIds();
    loadedState = loadCoachState(storageOptions);
    renderDashboard({ keepOpen: openIds, forceOpen: options.forceOpen });
    if (options.message) {
      setMessage(elements.status, options.type || (options.ok === false ? "error" : "success"), options.message);
      if (options.opportunityId) setCardMessage(options.opportunityId, options.type || "success", options.message);
    }
    if (options.focus) options.focus();
  }

  function finishMutation(result, {
    opportunityId = "",
    successMessage = result.message,
    forceOpen = "",
    focus,
  } = {}) {
    const ok = Boolean(result.ok);
    reloadAndRender({
      ok,
      type: ok ? "success" : "error",
      message: ok ? successMessage : result.message,
      opportunityId,
      forceOpen,
      focus,
    });
    return ok;
  }

  function showMutationFailure(opportunityId, message, focusTarget) {
    setMessage(elements.status, "error", message);
    setCardMessage(opportunityId, "error", message);
    focusTarget?.focus({ preventScroll: true });
  }

  function focusApplicationControl(opportunityId, selector, dataKey = "", dataValue = "") {
    const card = [...elements.list.querySelectorAll(".application-card")]
      .find((item) => item.dataset.opportunityId === opportunityId);
    const candidates = card ? card.querySelectorAll(selector) : [];
    const target = dataKey ? findByDataValue(candidates, dataKey, dataValue) : candidates[0];
    (target || card?.querySelector(".application-card__title") || elements.heading).focus({ preventScroll: true });
  }

  function performUnsave(opportunityId, opener, confirmed = false) {
    const result = unsaveOpportunity(opportunityId, { ...storageOptions, confirmed });
    if (result.status === "confirmation_required") {
      requestConfirmation({
        title: "Remove this saved opportunity?",
        description: result.message,
        confirmLabel: "Remove and delete progress",
        opener,
        action: () => performUnsave(opportunityId, opener, true),
      });
      return;
    }

    const message = "Opportunity removed from My Applications.";
    finishMutation(result, {
      successMessage: "Opportunity removed from My Applications.",
      focus: () => {
        if (opener?.isConnected) opener.focus({ preventScroll: true });
        else elements.heading.focus({ preventScroll: true });
      },
    });
    const cardFeedback = opener?.closest(".opportunity-card")?.querySelector(".card__save-feedback");
    if (result.ok && cardFeedback) {
      cardFeedback.hidden = false;
      cardFeedback.textContent = message;
    }
  }

  function requestConfirmation({ title, description, confirmLabel, action, opener }) {
    pendingConfirmation = action;
    confirmationOpener = opener;
    elements.confirmTitle.textContent = title;
    elements.confirmDescription.textContent = description;
    elements.confirmAction.textContent = confirmLabel;

    if (typeof elements.confirmDialog.showModal === "function") {
      elements.confirmDialog.returnValue = "";
      elements.confirmDialog.showModal();
    } else if (root.defaultView?.confirm(description)) {
      pendingConfirmation = null;
      confirmationOpener = null;
      action();
    } else {
      pendingConfirmation = null;
      confirmationOpener = null;
      opener?.focus({ preventScroll: true });
    }
  }

  function openCustomTaskEditor(opportunityId, taskId, opener) {
    const task = getSavedRecord(opportunityId)?.tasks.find((item) => item.id === taskId && item.sourceType === "custom");
    if (!task) {
      setMessage(elements.status, "error", "That custom task could not be found.");
      return;
    }

    editingTask = { opportunityId, taskId, opener };
    elements.customInput.value = task.title;
    elements.customError.hidden = true;
    elements.customError.textContent = "";
    if (typeof elements.customDialog.showModal === "function") {
      elements.customDialog.returnValue = "";
      elements.customDialog.showModal();
      elements.customInput.focus();
      elements.customInput.select();
    } else {
      const nextTitle = root.defaultView?.prompt("Edit custom task", task.title);
      if (nextTitle !== null && nextTitle !== undefined) {
        finishMutation(editOpportunityCustomTask(opportunityId, taskId, nextTitle, storageOptions), {
          opportunityId,
          forceOpen: opportunityId,
          focus: () => focusApplicationControl(opportunityId, "[data-edit-custom-task]", "taskId", taskId),
        });
      }
      editingTask = null;
    }
  }

  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.applicationFilter;
      renderDashboard({ keepOpen: getOpenManagementIds() });
    });
  });

  root.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-save-opportunity]");
    if (saveButton) {
      const opportunityId = saveButton.dataset.opportunityId;
      const cardFeedback = saveButton.closest(".opportunity-card")?.querySelector(".card__save-feedback");
      if (getSavedRecord(opportunityId)) {
        performUnsave(opportunityId, saveButton);
      } else {
        const result = saveOpportunity(opportunitiesById.get(opportunityId), storageOptions);
        const message = result.ok
          ? "Saved to My Applications for planning. Saving does not confirm eligibility."
          : result.message;
        finishMutation(result, { opportunityId, successMessage: message });
        if (cardFeedback) {
          cardFeedback.hidden = false;
          cardFeedback.textContent = message;
        }
      }
      return;
    }

    const unsaveButton = event.target.closest("[data-unsave-opportunity]");
    if (unsaveButton) {
      performUnsave(unsaveButton.dataset.opportunityId, unsaveButton);
      return;
    }

    const resetButton = event.target.closest("[data-reset-checklist]");
    if (resetButton) {
      const opportunityId = resetButton.dataset.opportunityId;
      requestConfirmation({
        title: "Reset generated checklist guidance?",
        description: "This resets the general and verified guidance to not started. Your custom tasks, notes, and application status will be kept.",
        confirmLabel: "Reset generated checklist",
        opener: resetButton,
        action: () => finishMutation(
          resetOpportunityChecklist(opportunityId, opportunitiesById.get(opportunityId), storageOptions),
          {
            opportunityId,
            forceOpen: opportunityId,
            focus: () => focusApplicationControl(opportunityId, "[data-reset-checklist]"),
          },
        ),
      });
      return;
    }

    const editButton = event.target.closest("[data-edit-custom-task]");
    if (editButton) {
      openCustomTaskEditor(editButton.dataset.opportunityId, editButton.dataset.taskId, editButton);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-custom-task]");
    if (deleteButton) {
      const { opportunityId, taskId } = deleteButton.dataset;
      requestConfirmation({
        title: "Delete this custom task?",
        description: "The custom task and its progress will be removed from this browser. This cannot be undone.",
        confirmLabel: "Delete custom task",
        opener: deleteButton,
        action: () => finishMutation(deleteOpportunityCustomTask(opportunityId, taskId, storageOptions), {
          opportunityId,
          forceOpen: opportunityId,
          focus: () => focusApplicationControl(opportunityId, "[data-custom-task-input]"),
        }),
      });
    }
  });

  root.addEventListener("change", (event) => {
    if (event.target.matches(".application-card__status-select")) {
      const opportunityId = event.target.dataset.opportunityId;
      finishMutation(changeApplicationStatus(opportunityId, event.target.value, storageOptions), {
        opportunityId,
        forceOpen: opportunityId,
        focus: () => focusApplicationControl(opportunityId, ".application-card__status-select"),
      });
      return;
    }

    if (event.target.matches("[data-task-status]")) {
      const { opportunityId, taskId } = event.target.dataset;
      finishMutation(changeTaskStatus(opportunityId, taskId, event.target.value, storageOptions), {
        opportunityId,
        forceOpen: opportunityId,
        focus: () => focusApplicationControl(opportunityId, "[data-task-status]", "taskId", taskId),
      });
    }
  });

  root.addEventListener("input", (event) => {
    if (event.target.matches(".application-notes")) {
      const count = event.target.closest(".application-notes-form")?.querySelector(".application-notes-count");
      if (count) count.textContent = `${event.target.value.length} / ${APPLICATION_LIMITS.notesMaximumLength}`;
    } else if (event.target.matches("[data-custom-task-input]")) {
      const count = event.target.closest("[data-custom-task-form]")?.querySelector(".custom-task-count");
      if (count) count.textContent = `${event.target.value.length} / ${APPLICATION_LIMITS.customTaskTitleMaximumLength}`;
    }
  });

  root.addEventListener("submit", (event) => {
    const customForm = event.target.closest("[data-custom-task-form]");
    if (customForm) {
      event.preventDefault();
      const opportunityId = customForm.dataset.opportunityId;
      const input = customForm.querySelector("[data-custom-task-input]");
      const result = addOpportunityCustomTask(opportunityId, input.value, storageOptions);
      if (!result.ok) {
        showMutationFailure(opportunityId, result.message, input);
        return;
      }
      finishMutation(result, {
        opportunityId,
        forceOpen: opportunityId,
        focus: () => focusApplicationControl(opportunityId, "[data-custom-task-input]"),
      });
      return;
    }

    const notesForm = event.target.closest(".application-notes-form");
    if (notesForm) {
      event.preventDefault();
      const opportunityId = notesForm.dataset.opportunityId;
      const notes = notesForm.querySelector(".application-notes").value;
      const result = saveOpportunityNotes(opportunityId, notes, storageOptions);
      if (!result.ok) {
        showMutationFailure(opportunityId, result.message, notesForm.querySelector(".application-notes"));
        return;
      }
      finishMutation(result, {
        opportunityId,
        forceOpen: opportunityId,
        focus: () => focusApplicationControl(opportunityId, ".application-notes-form button[type='submit']"),
      });
    }
  });

  elements.confirmAction.addEventListener("click", () => {
    const action = pendingConfirmation;
    pendingConfirmation = null;
    if (elements.confirmDialog.open) elements.confirmDialog.close("confirmed");
    action?.();
  });

  elements.confirmDialog.addEventListener("close", () => {
    if (elements.confirmDialog.returnValue !== "confirmed" && confirmationOpener?.isConnected) {
      confirmationOpener.focus({ preventScroll: true });
    }
    pendingConfirmation = null;
    confirmationOpener = null;
  });

  elements.customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editingTask) return;
    const { opportunityId, taskId } = editingTask;
    const result = editOpportunityCustomTask(opportunityId, taskId, elements.customInput.value, storageOptions);
    if (!result.ok) {
      elements.customError.hidden = false;
      elements.customError.textContent = result.message;
      elements.customInput.focus();
      return;
    }

    editingTask = null;
    if (elements.customDialog.open) elements.customDialog.close("saved");
    finishMutation(result, {
      opportunityId,
      successMessage: "Custom task updated.",
      forceOpen: opportunityId,
      focus: () => focusApplicationControl(opportunityId, "[data-edit-custom-task]", "taskId", taskId),
    });
  });

  elements.customDialog.addEventListener("close", () => {
    if (elements.customDialog.returnValue !== "saved" && editingTask?.opener?.isConnected) {
      editingTask.opener.focus({ preventScroll: true });
    }
    editingTask = null;
  });

  elements.customDialog.querySelector("[value='cancel']")?.addEventListener("click", () => {
    elements.customDialog.close("cancel");
  });

  root.addEventListener("opportunitymap:profilechange", () => {
    loadedState = loadCoachState(storageOptions);
    renderDashboard({ keepOpen: getOpenManagementIds() });
  });

  root.defaultView?.addEventListener("storage", (event) => {
    if (event.key && event.key !== "opportunityMapCoachState") return;
    loadedState = loadCoachState(storageOptions);
    renderDashboard({ keepOpen: getOpenManagementIds() });
  });

  renderDashboard();

  return {
    decorateOpportunityCard(card, opportunity) {
      const button = card.querySelector("[data-save-opportunity]");
      if (!button) throw new Error("The opportunity card is missing its save control.");
      button.dataset.opportunityId = opportunity.id;
      updateSaveButton(button);
    },
    setOpportunities(opportunities) {
      opportunitiesById = new Map((Array.isArray(opportunities) ? opportunities : [])
        .map((opportunity) => [opportunity.id, opportunity]));
      dataState = opportunitiesById.size ? "ready" : "error";
      loadedState = loadCoachState(storageOptions);
      renderDashboard({ keepOpen: getOpenManagementIds() });
    },
    setDataError() {
      opportunitiesById = new Map();
      dataState = "error";
      loadedState = loadCoachState(storageOptions);
      renderDashboard({ keepOpen: getOpenManagementIds() });
    },
    refresh() {
      reloadAndRender();
    },
  };
}
