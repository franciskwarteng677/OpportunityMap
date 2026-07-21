"use strict";

import {
  APPLICATION_LIMITS,
  TASK_SOURCE_TYPE_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "./config.js";

const TASK_STATUSES = new Set(TASK_STATUS_OPTIONS.map(({ value }) => value));
const TASK_SOURCE_TYPES = new Set(TASK_SOURCE_TYPE_OPTIONS.map(({ value }) => value));

const GENERAL_TASK_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "general-review-eligibility", title: "Review the current official eligibility page" }),
  Object.freeze({ id: "general-confirm-deadline", title: "Confirm the current deadline or application window" }),
  Object.freeze({ id: "general-review-documents", title: "Review required application documents and materials" }),
  Object.freeze({ id: "general-update-cv", title: "Check whether a CV or résumé is required and update it if needed" }),
  Object.freeze({ id: "general-personal-statement", title: "Check whether a personal statement is required and prepare it if needed" }),
  Object.freeze({ id: "general-references", title: "Check whether references are required and request them if needed" }),
  Object.freeze({ id: "general-review-application", title: "Review the completed application against the official instructions" }),
  Object.freeze({ id: "general-submit-officially", title: "Submit through the official source" }),
  Object.freeze({ id: "general-save-confirmation", title: "Save the submission confirmation" }),
]);

function createTimestamp(now) {
  const supplied = typeof now === "function" ? now() : now;
  const date = supplied instanceof Date ? supplied : new Date(supplied ?? Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError("A valid date is required for an action plan.");
  return date.toISOString();
}

function cloneTasks(tasks) {
  return Array.isArray(tasks) ? tasks.map((task) => ({ ...task })) : [];
}

function createTask({ id, title, sourceType }, timestamp) {
  return {
    id,
    title,
    status: "not-started",
    sourceType,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function getVerifiedRequirements(opportunity) {
  const guidance = opportunity?.eligibilityGuidance;
  if (guidance?.schemaVersion !== 1) return [];
  const represented = guidance.representedRequirements;
  if (!Array.isArray(represented)) return [];

  return represented.filter((requirement) => (
    requirement
    && requirement.verified === true
    && typeof requirement.id === "string"
    && requirement.id.trim()
    && typeof requirement.description === "string"
    && requirement.description.trim()
    && ["age_range", "education_stage", "minimum_experience"].includes(requirement.type)
    && typeof requirement.sourceField === "string"
    && Object.hasOwn(opportunity, requirement.sourceField)
  ));
}

export function generateActionPlan(opportunity, { now } = {}) {
  const timestamp = createTimestamp(now);
  const generalTasks = GENERAL_TASK_DEFINITIONS.map((definition) => createTask({
    ...definition,
    sourceType: "general-guidance",
  }, timestamp));
  const verifiedTasks = getVerifiedRequirements(opportunity).map((requirement) => createTask({
    id: `verified-${requirement.id.trim()}`,
    title: `Verify at the official source: ${requirement.description.trim()}`,
    sourceType: "verified-requirement",
  }, timestamp));

  return [...generalTasks, ...verifiedTasks];
}

export function calculateTaskProgress(tasks) {
  const supportedTasks = Array.isArray(tasks) ? tasks : [];
  const total = supportedTasks.length;
  const completed = supportedTasks.filter((task) => task?.status === "complete").length;
  const inProgress = supportedTasks.filter((task) => task?.status === "in-progress").length;

  return {
    completed,
    inProgress,
    notStarted: Math.max(0, total - completed - inProgress),
    total,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function calculateOverallProgress(savedOpportunities) {
  const records = Array.isArray(savedOpportunities)
    ? savedOpportunities
    : Object.values(savedOpportunities || {});
  const totals = records.reduce((summary, record) => {
    const progress = calculateTaskProgress(record?.tasks);
    summary.completed += progress.completed;
    summary.inProgress += progress.inProgress;
    summary.notStarted += progress.notStarted;
    summary.total += progress.total;
    return summary;
  }, { completed: 0, inProgress: 0, notStarted: 0, total: 0 });

  return {
    ...totals,
    percentage: totals.total ? Math.round((totals.completed / totals.total) * 100) : 0,
  };
}

export function updateTaskStatus(tasks, taskId, status, { now } = {}) {
  if (!TASK_STATUSES.has(status)) {
    return { ok: false, status: "invalid_status", tasks: cloneTasks(tasks), message: "Choose a supported task status." };
  }

  const index = Array.isArray(tasks) ? tasks.findIndex((task) => task?.id === taskId) : -1;
  if (index < 0) {
    return { ok: false, status: "not_found", tasks: cloneTasks(tasks), message: "That task could not be found." };
  }

  const nextTasks = cloneTasks(tasks);
  nextTasks[index] = { ...nextTasks[index], status, updatedAt: createTimestamp(now) };
  return { ok: true, status: "updated", tasks: nextTasks, task: { ...nextTasks[index] }, message: "Task status updated." };
}

function defaultIdFactory() {
  if (globalThis.crypto?.randomUUID) return `custom-${globalThis.crypto.randomUUID()}`;
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addCustomTask(tasks, title, { now, idFactory = defaultIdFactory } = {}) {
  const nextTasks = cloneTasks(tasks);
  const cleanTitle = typeof title === "string" ? title.trim() : "";

  if (!cleanTitle) {
    return { ok: false, status: "invalid_title", tasks: nextTasks, message: "Enter a title for the custom task." };
  }
  if (cleanTitle.length > APPLICATION_LIMITS.customTaskTitleMaximumLength) {
    return {
      ok: false,
      status: "invalid_title",
      tasks: nextTasks,
      message: `Custom tasks must contain no more than ${APPLICATION_LIMITS.customTaskTitleMaximumLength} characters.`,
    };
  }
  if (nextTasks.length >= APPLICATION_LIMITS.maximumTasksPerOpportunity) {
    return {
      ok: false,
      status: "limit_reached",
      tasks: nextTasks,
      message: `An action plan can contain no more than ${APPLICATION_LIMITS.maximumTasksPerOpportunity} tasks.`,
    };
  }

  const taskId = String(idFactory()).trim();
  if (!taskId || taskId.length > APPLICATION_LIMITS.identifierMaximumLength || nextTasks.some((task) => task.id === taskId)) {
    return { ok: false, status: "invalid_id", tasks: nextTasks, message: "A unique task could not be created. Try again." };
  }

  const timestamp = createTimestamp(now);
  const task = createTask({ id: taskId, title: cleanTitle, sourceType: "custom" }, timestamp);
  nextTasks.push(task);
  return { ok: true, status: "added", tasks: nextTasks, task: { ...task }, message: "Custom task added." };
}

export function editCustomTask(tasks, taskId, title, { now } = {}) {
  const nextTasks = cloneTasks(tasks);
  const index = nextTasks.findIndex((task) => task?.id === taskId);
  const cleanTitle = typeof title === "string" ? title.trim() : "";

  if (index < 0) return { ok: false, status: "not_found", tasks: nextTasks, message: "That custom task could not be found." };
  if (nextTasks[index].sourceType !== "custom") {
    return { ok: false, status: "protected_task", tasks: nextTasks, message: "Generated guidance cannot be renamed. Add a custom task instead." };
  }
  if (!cleanTitle || cleanTitle.length > APPLICATION_LIMITS.customTaskTitleMaximumLength) {
    return {
      ok: false,
      status: "invalid_title",
      tasks: nextTasks,
      message: `Custom tasks must contain between 1 and ${APPLICATION_LIMITS.customTaskTitleMaximumLength} characters.`,
    };
  }

  nextTasks[index] = { ...nextTasks[index], title: cleanTitle, updatedAt: createTimestamp(now) };
  return { ok: true, status: "edited", tasks: nextTasks, task: { ...nextTasks[index] }, message: "Custom task updated." };
}

export function deleteCustomTask(tasks, taskId) {
  const nextTasks = cloneTasks(tasks);
  const index = nextTasks.findIndex((task) => task?.id === taskId);

  if (index < 0) return { ok: false, status: "not_found", tasks: nextTasks, message: "That custom task could not be found." };
  if (nextTasks[index].sourceType !== "custom") {
    return { ok: false, status: "protected_task", tasks: nextTasks, message: "Generated guidance cannot be deleted individually." };
  }

  const [task] = nextTasks.splice(index, 1);
  return { ok: true, status: "deleted", tasks: nextTasks, task, message: "Custom task deleted." };
}

export function resetGeneratedChecklist(tasks, opportunity, options = {}) {
  if (!opportunity) {
    return {
      ok: false,
      status: "opportunity_unavailable",
      tasks: cloneTasks(tasks),
      message: "The generated checklist cannot be reset while the opportunity record is unavailable.",
    };
  }

  const customTasks = cloneTasks(tasks).filter((task) => task.sourceType === "custom");
  const generatedTasks = generateActionPlan(opportunity, options);
  return {
    ok: true,
    status: "reset",
    tasks: [...generatedTasks, ...customTasks],
    message: "General and verified checklist guidance was reset. Custom tasks were kept.",
  };
}

export function isSupportedTaskSourceType(value) {
  return TASK_SOURCE_TYPES.has(value);
}
