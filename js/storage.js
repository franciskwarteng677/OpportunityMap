"use strict";

import { COACH_SCHEMA_VERSION, COACH_STORAGE_KEY } from "./config.js";

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copyPlainObject(value) {
  return Object.fromEntries(Object.entries(value));
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
      message: "The saved coach profile could not be read because its browser data is corrupted.",
    };
  }

  const hasSupportedShape = isPlainObject(parsed)
    && parsed.schemaVersion === COACH_SCHEMA_VERSION
    && isPlainObject(parsed.profile)
    && isPlainObject(parsed.savedOpportunities)
    && isPlainObject(parsed.preferences)
    && typeof parsed.updatedAt === "string";

  if (!hasSupportedShape) {
    return {
      ok: false,
      status: "unsupported",
      state: createDefaultCoachState(),
      message: "The saved coach data uses an unsupported format and has not been changed.",
    };
  }

  return {
    ok: true,
    status: Object.keys(parsed.profile).length ? "loaded" : "empty",
    state: {
      schemaVersion: COACH_SCHEMA_VERSION,
      profile: copyPlainObject(parsed.profile),
      savedOpportunities: copyPlainObject(parsed.savedOpportunities),
      preferences: copyPlainObject(parsed.preferences),
      updatedAt: parsed.updatedAt,
    },
    message: "",
  };
}

export function loadCoachState({ storage = getBrowserStorage() } = {}) {
  if (!storage || typeof storage.getItem !== "function") {
    return {
      ok: false,
      status: "unavailable",
      state: createDefaultCoachState(),
      message: "Browser storage is unavailable. Your profile cannot be kept between visits.",
    };
  }

  try {
    return parseCoachState(storage.getItem(COACH_STORAGE_KEY));
  } catch {
    return {
      ok: false,
      status: "unavailable",
      state: createDefaultCoachState(),
      message: "Browser storage could not be accessed. Your profile cannot be kept between visits.",
    };
  }
}

function createTimestamp(now) {
  const supplied = typeof now === "function" ? now() : now;
  const date = supplied instanceof Date ? supplied : new Date(supplied ?? Date.now());

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required when saving coach state.");
  }

  return date.toISOString();
}

export function saveCoachState(state, { storage = getBrowserStorage(), now } = {}) {
  if (!storage || typeof storage.setItem !== "function") {
    return {
      ok: false,
      status: "unavailable",
      state,
      message: "Browser storage is unavailable, so the profile was not saved.",
    };
  }

  const validState = isPlainObject(state)
    && state.schemaVersion === COACH_SCHEMA_VERSION
    && isPlainObject(state.profile)
    && isPlainObject(state.savedOpportunities)
    && isPlainObject(state.preferences);

  if (!validState) {
    return {
      ok: false,
      status: "unsupported",
      state,
      message: "The profile was not saved because the coach data has an unsupported format.",
    };
  }

  let nextState;

  try {
    nextState = {
      schemaVersion: COACH_SCHEMA_VERSION,
      profile: copyPlainObject(state.profile),
      savedOpportunities: copyPlainObject(state.savedOpportunities),
      preferences: copyPlainObject(state.preferences),
      updatedAt: createTimestamp(now),
    };
    storage.setItem(COACH_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    return {
      ok: false,
      status: "save_failed",
      state,
      message: "The browser could not save your profile. Check your storage settings and try again.",
    };
  }

  return {
    ok: true,
    status: "saved",
    state: nextState,
    message: "Your student profile was saved in this browser.",
  };
}

export function updateStoredProfile(profile, options = {}) {
  if (!isPlainObject(profile)) {
    return {
      ok: false,
      status: "unsupported",
      state: createDefaultCoachState(),
      message: "The profile was not saved because its data has an unsupported format.",
    };
  }

  const loaded = loadCoachState(options);

  if (loaded.status === "unsupported") {
    return {
      ...loaded,
      message: "Your existing coach data uses an unsupported format, so it was not overwritten.",
    };
  }

  const nextState = {
    ...loaded.state,
    profile: copyPlainObject(profile),
  };

  return saveCoachState(nextState, options);
}

export function clearStoredProfile(options = {}) {
  const loaded = loadCoachState(options);

  if (loaded.status === "unsupported") {
    return {
      ...loaded,
      message: "Your existing coach data uses an unsupported format, so it was not changed.",
    };
  }

  const nextState = {
    ...loaded.state,
    profile: {},
  };

  const saved = saveCoachState(nextState, options);

  return saved.ok
    ? { ...saved, status: "cleared", message: "Your student profile was cleared from this browser." }
    : saved;
}

export function resetCoachState(options = {}) {
  const saved = saveCoachState(createDefaultCoachState(), options);

  return saved.ok
    ? {
      ...saved,
      status: "reset",
      message: "The incompatible OpportunityMap AI Coach data was reset in this browser.",
    }
    : saved;
}
