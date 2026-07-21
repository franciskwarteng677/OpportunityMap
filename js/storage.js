"use strict";

import {
  APPLICATION_LIMITS,
  APPLICATION_STATUS_OPTIONS,
  COACH_SCHEMA_VERSION,
  COACH_STORAGE_KEY,
  LEGACY_COACH_SCHEMA_VERSION,
  TASK_SOURCE_TYPE_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "./config.js";

const APPLICATION_STATUSES = new Set(APPLICATION_STATUS_OPTIONS.map(({ value }) => value));
const TASK_STATUSES = new Set(TASK_STATUS_OPTIONS.map(({ value }) => value));
const TASK_SOURCE_TYPES = new Set(TASK_SOURCE_TYPE_OPTIONS.map(({ value }) => value));
const STATE_KEYS = new Set(["schemaVersion", "profile", "savedOpportunities", "preferences", "updatedAt"]);
const SAVED_OPPORTUNITY_KEYS = new Set([
  "opportunityId",
  "savedAt",
  "updatedAt",
  "applicationStatus",
  "tasks",
  "notes",
]);
const TASK_KEYS = new Set(["id", "title", "status", "sourceType", "createdAt", "updatedAt"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isIdentifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= APPLICATION_LIMITS.identifierMaximumLength
    && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function isIsoTimestamp(value, { allowEmpty = false } = {}) {
  if (allowEmpty && value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]));
  }
  return value;
}

function isSupportedJsonValue(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!Array.isArray(value) && !isPlainObject(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const values = Array.isArray(value) ? value : Object.values(value);
  const supported = values.every((item) => isSupportedJsonValue(item, seen));
  seen.delete(value);
  return supported;
}

function hasStoredData(state) {
  return Object.keys(state.profile).length > 0
    || Object.keys(state.savedOpportunities).length > 0
    || Object.keys(state.preferences).length > 0;
}

function validateTask(task, position) {
  const errors = [];
  const prefix = `tasks[${position}]`;

  if (!isPlainObject(task) || !hasOnlyKeys(task, TASK_KEYS)) {
    return [`${prefix} must use the supported task structure.`];
  }

  if (!isIdentifier(task.id)) errors.push(`${prefix}.id must be a non-empty supported identifier.`);
  if (typeof task.title !== "string" || !task.title.trim() || task.title.length > APPLICATION_LIMITS.taskTitleMaximumLength) {
    errors.push(`${prefix}.title must be between 1 and ${APPLICATION_LIMITS.taskTitleMaximumLength} characters.`);
  }
  if (task.sourceType === "custom" && typeof task.title === "string" && task.title.length > APPLICATION_LIMITS.customTaskTitleMaximumLength) {
    errors.push(`${prefix}.title exceeds the custom-task limit of ${APPLICATION_LIMITS.customTaskTitleMaximumLength} characters.`);
  }
  if (!TASK_STATUSES.has(task.status)) errors.push(`${prefix}.status is unsupported.`);
  if (!TASK_SOURCE_TYPES.has(task.sourceType)) errors.push(`${prefix}.sourceType is unsupported.`);
  if (!isIsoTimestamp(task.createdAt)) errors.push(`${prefix}.createdAt must be an ISO timestamp.`);
  if (!isIsoTimestamp(task.updatedAt)) errors.push(`${prefix}.updatedAt must be an ISO timestamp.`);

  return errors;
}

export function validateSavedOpportunityRecord(record, expectedOpportunityId = "") {
  const errors = [];

  if (!isPlainObject(record) || !hasOnlyKeys(record, SAVED_OPPORTUNITY_KEYS)) {
    return ["The saved opportunity must use the supported record structure."];
  }

  if (!isIdentifier(record.opportunityId)) errors.push("opportunityId must be a non-empty supported identifier.");
  if (expectedOpportunityId && record.opportunityId !== expectedOpportunityId) {
    errors.push("The saved-opportunity map key must match opportunityId.");
  }
  if (!isIsoTimestamp(record.savedAt)) errors.push("savedAt must be an ISO timestamp.");
  if (!isIsoTimestamp(record.updatedAt)) errors.push("updatedAt must be an ISO timestamp.");
  if (!APPLICATION_STATUSES.has(record.applicationStatus)) errors.push("applicationStatus is unsupported.");
  if (!Array.isArray(record.tasks)) {
    errors.push("tasks must be an array.");
  } else {
    if (record.tasks.length > APPLICATION_LIMITS.maximumTasksPerOpportunity) {
      errors.push(`tasks cannot contain more than ${APPLICATION_LIMITS.maximumTasksPerOpportunity} items.`);
    }
    const taskIds = new Set();
    record.tasks.forEach((task, index) => {
      errors.push(...validateTask(task, index));
      if (isPlainObject(task) && typeof task.id === "string") {
        if (taskIds.has(task.id)) errors.push(`tasks[${index}].id must be unique within an opportunity.`);
        taskIds.add(task.id);
      }
    });
  }
  if (typeof record.notes !== "string" || record.notes.length > APPLICATION_LIMITS.notesMaximumLength) {
    errors.push(`notes must contain no more than ${APPLICATION_LIMITS.notesMaximumLength} characters.`);
  }

  return errors;
}

function validateCoachState(state) {
  const errors = [];

  if (!isPlainObject(state) || !hasOnlyKeys(state, STATE_KEYS)) {
    return ["Coach state must use the supported top-level structure."];
  }
  if (state.schemaVersion !== COACH_SCHEMA_VERSION) errors.push(`schemaVersion must be ${COACH_SCHEMA_VERSION}.`);
  if (!isPlainObject(state.profile)) errors.push("profile must be an object.");
  else if (!isSupportedJsonValue(state.profile)) errors.push("profile contains unsupported values.");
  if (!isPlainObject(state.savedOpportunities)) errors.push("savedOpportunities must be an object.");
  if (!isPlainObject(state.preferences)) errors.push("preferences must be an object.");
  else if (!isSupportedJsonValue(state.preferences)) errors.push("preferences contains unsupported values.");
  if (!isIsoTimestamp(state.updatedAt, { allowEmpty: true })) errors.push("updatedAt must be empty or an ISO timestamp.");

  if (isPlainObject(state.savedOpportunities)) {
    Object.entries(state.savedOpportunities).forEach(([opportunityId, record]) => {
      if (!isIdentifier(opportunityId)) errors.push("A saved-opportunity map key is unsupported.");
      errors.push(...validateSavedOpportunityRecord(record, opportunityId).map((error) => `${opportunityId}: ${error}`));
    });
  }

  return errors;
}

function unsupportedResult(message = "The saved coach data uses an unsupported format and has not been changed.") {
  return {
    ok: false,
    status: "unsupported",
    state: createDefaultCoachState(),
    message,
  };
}

export function createDefaultCoachState() {
  return {
    schemaVersion: COACH_SCHEMA_VERSION,
    profile: {},
    savedOpportunities: {},
    preferences: {},
    updatedAt: "",
  };
}

export function getBrowserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createTimestamp(now) {
  const supplied = typeof now === "function" ? now() : now;
  const date = supplied instanceof Date ? supplied : new Date(supplied ?? Date.now());

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required when saving coach state.");
  }

  return date.toISOString();
}

export function parseCoachState(rawValue) {
  if (rawValue === null || rawValue === "") {
    return {
      ok: true,
      status: "empty",
      state: createDefaultCoachState(),
      message: "",
    };
  }

  let parsed;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {
      ok: false,
      status: "corrupted",
      state: createDefaultCoachState(),
      message: "The saved coach data could not be read because its browser data is corrupted. It has not been changed.",
    };
  }

  if (!isPlainObject(parsed)) return unsupportedResult();

  if (parsed.schemaVersion === LEGACY_COACH_SCHEMA_VERSION) {
    const legacyShapeIsSupported = hasOnlyKeys(parsed, STATE_KEYS)
      && isPlainObject(parsed.profile)
      && isSupportedJsonValue(parsed.profile)
      && isPlainObject(parsed.savedOpportunities)
      && Object.keys(parsed.savedOpportunities).length === 0
      && isPlainObject(parsed.preferences)
      && isSupportedJsonValue(parsed.preferences)
      && isIsoTimestamp(parsed.updatedAt, { allowEmpty: true });

    if (!legacyShapeIsSupported) {
      return unsupportedResult("The existing version 1 coach data contains unsupported values and was not migrated or changed.");
    }

    return {
      ok: true,
      status: "migration-needed",
      state: {
        schemaVersion: COACH_SCHEMA_VERSION,
        profile: cloneJsonValue(parsed.profile),
        savedOpportunities: {},
        preferences: cloneJsonValue(parsed.preferences),
        updatedAt: parsed.updatedAt,
      },
      message: "",
    };
  }

  if (parsed.schemaVersion !== COACH_SCHEMA_VERSION) return unsupportedResult();

  const errors = validateCoachState(parsed);
  if (errors.length) return unsupportedResult();

  const state = cloneJsonValue(parsed);
  return {
    ok: true,
    status: hasStoredData(state) ? "loaded" : "empty",
    state,
    message: "",
  };
}

export function loadCoachState({ storage = getBrowserStorage() } = {}) {
  if (!storage || typeof storage.getItem !== "function") {
    return {
      ok: false,
      status: "unavailable",
      state: createDefaultCoachState(),
      message: "Browser storage is unavailable. Your coach data cannot be kept between visits.",
    };
  }

  let parsed;
  try {
    parsed = parseCoachState(storage.getItem(COACH_STORAGE_KEY));
  } catch {
    return {
      ok: false,
      status: "unavailable",
      state: createDefaultCoachState(),
      message: "Browser storage could not be accessed. Your coach data cannot be kept between visits.",
    };
  }

  if (parsed.status !== "migration-needed") return parsed;

  if (typeof storage.setItem !== "function") {
    return {
      ...parsed,
      ok: false,
      status: "migration_failed",
      message: "Your existing profile was read, but browser storage could not upgrade it for saved applications. The original data was not changed.",
    };
  }

  try {
    storage.setItem(COACH_STORAGE_KEY, JSON.stringify(parsed.state));
  } catch {
    return {
      ...parsed,
      ok: false,
      status: "migration_failed",
      message: "Your existing profile was read, but browser storage could not upgrade it for saved applications. The original data was not changed.",
    };
  }

  return {
    ...parsed,
    status: "migrated",
    message: "Your existing student profile was safely upgraded for My Applications.",
  };
}

export function saveCoachState(state, { storage = getBrowserStorage(), now } = {}) {
  if (!storage || typeof storage.setItem !== "function") {
    return {
      ok: false,
      status: "unavailable",
      state,
      message: "Browser storage is unavailable, so your coach data was not saved.",
    };
  }

  const errors = validateCoachState(state);
  if (errors.length) {
    return {
      ok: false,
      status: "unsupported",
      state,
      message: "Your coach data was not saved because it uses an unsupported format.",
    };
  }

  let nextState;

  try {
    nextState = cloneJsonValue(state);
    nextState.schemaVersion = COACH_SCHEMA_VERSION;
    nextState.updatedAt = createTimestamp(now);
    storage.setItem(COACH_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    return {
      ok: false,
      status: "save_failed",
      state,
      message: "The browser could not save your coach data. Check your storage settings and try again.",
    };
  }

  return {
    ok: true,
    status: "saved",
    state: nextState,
    message: "Your coach data was saved in this browser.",
  };
}

function blockedMutationResult(loaded, actionMessage) {
  return {
    ...loaded,
    message: actionMessage || loaded.message,
  };
}

export function updateStoredProfile(profile, options = {}) {
  if (!isPlainObject(profile)) {
    return unsupportedResult("The profile was not saved because its data has an unsupported format.");
  }

  const loaded = loadCoachState(options);
  if (!loaded.ok) {
    return blockedMutationResult(loaded, `${loaded.message} Your profile was not overwritten.`);
  }

  const saved = saveCoachState({ ...loaded.state, profile: cloneJsonValue(profile) }, options);
  return saved.ok
    ? { ...saved, message: "Your student profile was saved in this browser." }
    : saved;
}

export function clearStoredProfile(options = {}) {
  const loaded = loadCoachState(options);
  if (!loaded.ok) {
    return blockedMutationResult(loaded, `${loaded.message} Your profile was not changed.`);
  }

  const saved = saveCoachState({ ...loaded.state, profile: {} }, options);
  return saved.ok
    ? { ...saved, status: "cleared", message: "Your student profile was cleared. Saved applications remain in this browser." }
    : saved;
}

export function saveStoredOpportunity(record, options = {}) {
  const errors = validateSavedOpportunityRecord(record, record?.opportunityId || "");
  if (errors.length) return unsupportedResult("The opportunity was not saved because its application data is unsupported.");

  const loaded = loadCoachState(options);
  if (!loaded.ok) return blockedMutationResult(loaded, `${loaded.message} The opportunity was not saved.`);

  const existing = Object.hasOwn(loaded.state.savedOpportunities, record.opportunityId)
    ? loaded.state.savedOpportunities[record.opportunityId]
    : null;
  if (existing) {
    return {
      ok: true,
      status: "already_saved",
      state: loaded.state,
      record: cloneJsonValue(existing),
      message: "This opportunity is already saved in My Applications.",
    };
  }

  const nextState = cloneJsonValue(loaded.state);
  nextState.savedOpportunities[record.opportunityId] = cloneJsonValue(record);
  const saved = saveCoachState(nextState, options);
  return saved.ok
    ? { ...saved, status: "opportunity_saved", record: cloneJsonValue(record), message: "Opportunity saved to My Applications." }
    : saved;
}

export function updateStoredOpportunity(opportunityId, updater, options = {}) {
  if (!isIdentifier(opportunityId) || typeof updater !== "function") {
    return unsupportedResult("The saved application was not updated because the request is unsupported.");
  }

  const loaded = loadCoachState(options);
  if (!loaded.ok) return blockedMutationResult(loaded, `${loaded.message} The saved application was not updated.`);

  const current = Object.hasOwn(loaded.state.savedOpportunities, opportunityId)
    ? loaded.state.savedOpportunities[opportunityId]
    : null;
  if (!current) {
    return {
      ok: false,
      status: "not_found",
      state: loaded.state,
      message: "That opportunity is not currently saved in this browser.",
    };
  }

  let updatedAt;
  let nextRecord;
  try {
    updatedAt = createTimestamp(options.now);
    nextRecord = updater(cloneJsonValue(current), updatedAt);
  } catch {
    return unsupportedResult("The saved application was not updated because the requested change is invalid.");
  }

  const errors = validateSavedOpportunityRecord(nextRecord, opportunityId);
  if (errors.length) return unsupportedResult("The saved application was not updated because the resulting data is unsupported.");

  const nextState = cloneJsonValue(loaded.state);
  nextState.savedOpportunities[opportunityId] = cloneJsonValue(nextRecord);
  const saved = saveCoachState(nextState, { ...options, now: updatedAt });
  return saved.ok
    ? { ...saved, status: "opportunity_updated", record: cloneJsonValue(nextRecord), message: "Saved application updated." }
    : saved;
}

export function removeStoredOpportunity(opportunityId, options = {}) {
  if (!isIdentifier(opportunityId)) {
    return unsupportedResult("The opportunity was not removed because its identifier is unsupported.");
  }

  const loaded = loadCoachState(options);
  if (!loaded.ok) return blockedMutationResult(loaded, `${loaded.message} The opportunity was not removed.`);

  if (!Object.hasOwn(loaded.state.savedOpportunities, opportunityId)) {
    return {
      ok: true,
      status: "not_saved",
      state: loaded.state,
      message: "This opportunity was not saved.",
    };
  }

  const nextState = cloneJsonValue(loaded.state);
  delete nextState.savedOpportunities[opportunityId];
  const saved = saveCoachState(nextState, options);
  return saved.ok
    ? { ...saved, status: "opportunity_removed", message: "Opportunity removed from My Applications." }
    : saved;
}

export function resetCoachState(options = {}) {
  const saved = saveCoachState(createDefaultCoachState(), options);

  return saved.ok
    ? {
      ...saved,
      status: "reset",
      message: "OpportunityMap AI Coach data was reset in this browser.",
    }
    : saved;
}
