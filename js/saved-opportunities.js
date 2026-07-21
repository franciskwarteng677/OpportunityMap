"use strict";

import {
  addCustomTask,
  deleteCustomTask,
  editCustomTask,
  generateActionPlan,
  resetGeneratedChecklist,
  updateTaskStatus,
} from "./action-plans.js";
import { APPLICATION_LIMITS, APPLICATION_STATUS_OPTIONS } from "./config.js";
import {
  createTimestamp,
  loadCoachState,
  removeStoredOpportunity,
  saveStoredOpportunity,
  updateStoredOpportunity,
} from "./storage.js";

const APPLICATION_STATUSES = new Set(APPLICATION_STATUS_OPTIONS.map(({ value }) => value));

function invalidResult(message) {
  return { ok: false, status: "invalid_request", message };
}

export function getSavedOpportunityMap(options = {}) {
  const loaded = loadCoachState(options);
  return loaded.ok ? { ...loaded, savedOpportunities: loaded.state.savedOpportunities } : loaded;
}

export function isOpportunitySaved(opportunityId, options = {}) {
  const loaded = loadCoachState(options);
  return loaded.ok && Object.hasOwn(loaded.state.savedOpportunities, opportunityId);
}

export function saveOpportunity(opportunity, options = {}) {
  if (!opportunity || typeof opportunity.id !== "string" || !opportunity.id.trim()) {
    return invalidResult("This opportunity cannot be saved because its identifier is missing.");
  }

  let timestamp;
  let tasks;
  try {
    timestamp = createTimestamp(options.now);
    tasks = generateActionPlan(opportunity, { now: timestamp });
  } catch {
    return invalidResult("This opportunity could not be prepared for saving.");
  }

  return saveStoredOpportunity({
    opportunityId: opportunity.id,
    savedAt: timestamp,
    updatedAt: timestamp,
    applicationStatus: "saved",
    tasks,
    notes: "",
  }, { ...options, now: timestamp });
}

export function hasMeaningfulApplicationWork(record) {
  if (!record) return false;
  return record.applicationStatus !== "saved"
    || Boolean(record.notes?.trim())
    || record.tasks?.some((task) => task.sourceType === "custom" || task.status !== "not-started")
    || false;
}

export function unsaveOpportunity(opportunityId, { confirmed = false, ...options } = {}) {
  const loaded = loadCoachState(options);
  if (!loaded.ok) return { ...loaded, message: `${loaded.message} The opportunity was not removed.` };

  const record = Object.hasOwn(loaded.state.savedOpportunities, opportunityId)
    ? loaded.state.savedOpportunities[opportunityId]
    : null;
  if (record && hasMeaningfulApplicationWork(record) && !confirmed) {
    return {
      ok: false,
      status: "confirmation_required",
      state: loaded.state,
      record,
      message: "Removing this opportunity will also delete its status, task progress, custom tasks, and private notes.",
    };
  }

  return removeStoredOpportunity(opportunityId, options);
}

export function changeApplicationStatus(opportunityId, applicationStatus, options = {}) {
  if (!APPLICATION_STATUSES.has(applicationStatus)) return invalidResult("Choose a supported application status.");

  const result = updateStoredOpportunity(opportunityId, (record, updatedAt) => ({
    ...record,
    applicationStatus,
    updatedAt,
  }), options);
  return result.ok
    ? { ...result, message: "Application status updated." }
    : result;
}

export function saveOpportunityNotes(opportunityId, notes, options = {}) {
  if (typeof notes !== "string") return invalidResult("Notes must be plain text.");
  if (notes.length > APPLICATION_LIMITS.notesMaximumLength) {
    return invalidResult(`Notes must contain no more than ${APPLICATION_LIMITS.notesMaximumLength} characters.`);
  }

  const result = updateStoredOpportunity(opportunityId, (record, updatedAt) => ({
    ...record,
    notes,
    updatedAt,
  }), options);
  return result.ok
    ? { ...result, message: "Private notes saved in this browser." }
    : result;
}

export function changeTaskStatus(opportunityId, taskId, taskStatus, options = {}) {
  let actionResult;
  const result = updateStoredOpportunity(opportunityId, (record, updatedAt) => {
    actionResult = updateTaskStatus(record.tasks, taskId, taskStatus, { now: updatedAt });
    if (!actionResult.ok) throw new TypeError(actionResult.message);
    return { ...record, tasks: actionResult.tasks, updatedAt };
  }, options);

  if (!result.ok && actionResult && !actionResult.ok) return { ...result, status: actionResult.status, message: actionResult.message };
  return result.ok
    ? { ...result, task: actionResult.task, message: "Task status updated." }
    : result;
}

export function addOpportunityCustomTask(opportunityId, title, options = {}) {
  let actionResult;
  const result = updateStoredOpportunity(opportunityId, (record, updatedAt) => {
    actionResult = addCustomTask(record.tasks, title, {
      now: updatedAt,
      idFactory: options.idFactory,
    });
    if (!actionResult.ok) throw new TypeError(actionResult.message);
    return { ...record, tasks: actionResult.tasks, updatedAt };
  }, options);

  if (!result.ok && actionResult && !actionResult.ok) return { ...result, status: actionResult.status, message: actionResult.message };
  return result.ok
    ? { ...result, task: actionResult.task, message: "Custom task added." }
    : result;
}

export function editOpportunityCustomTask(opportunityId, taskId, title, options = {}) {
  let actionResult;
  const result = updateStoredOpportunity(opportunityId, (record, updatedAt) => {
    actionResult = editCustomTask(record.tasks, taskId, title, { now: updatedAt });
    if (!actionResult.ok) throw new TypeError(actionResult.message);
    return { ...record, tasks: actionResult.tasks, updatedAt };
  }, options);

  if (!result.ok && actionResult && !actionResult.ok) return { ...result, status: actionResult.status, message: actionResult.message };
  return result.ok
    ? { ...result, task: actionResult.task, message: "Custom task updated." }
    : result;
}

export function deleteOpportunityCustomTask(opportunityId, taskId, options = {}) {
  let actionResult;
  const result = updateStoredOpportunity(opportunityId, (record, updatedAt) => {
    actionResult = deleteCustomTask(record.tasks, taskId);
    if (!actionResult.ok) throw new TypeError(actionResult.message);
    return { ...record, tasks: actionResult.tasks, updatedAt };
  }, options);

  if (!result.ok && actionResult && !actionResult.ok) return { ...result, status: actionResult.status, message: actionResult.message };
  return result.ok
    ? { ...result, task: actionResult.task, message: "Custom task deleted." }
    : result;
}

export function resetOpportunityChecklist(opportunityId, opportunity, options = {}) {
  let actionResult;
  const result = updateStoredOpportunity(opportunityId, (record, updatedAt) => {
    actionResult = resetGeneratedChecklist(record.tasks, opportunity, { now: updatedAt });
    if (!actionResult.ok) throw new TypeError(actionResult.message);
    return { ...record, tasks: actionResult.tasks, updatedAt };
  }, options);

  if (!result.ok && actionResult && !actionResult.ok) return { ...result, status: actionResult.status, message: actionResult.message };
  return result.ok
    ? { ...result, message: actionResult.message }
    : result;
}
