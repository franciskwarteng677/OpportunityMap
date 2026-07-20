import assert from "node:assert/strict";
import test from "node:test";

import { COACH_SCHEMA_VERSION, COACH_STORAGE_KEY } from "../js/config.js";
import {
  clearStoredProfile,
  createDefaultCoachState,
  loadCoachState,
  parseCoachState,
  resetCoachState,
  saveCoachState,
  updateStoredProfile,
} from "../js/storage.js";

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.setCalls = [];
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.setCalls.push([key, value]);
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const validProfile = {
  citizenshipCountry: "GH",
  residenceCountry: "GH",
  age: null,
  educationStage: "undergraduate",
  fieldsOfInterest: ["engineering"],
  preferredCategories: ["scholarships"],
  goal: "Study renewable-energy engineering.",
  fundingPreference: "fully_funded",
  mobilityPreference: "travel_and_relocate",
  experienceLevel: "under_one_year",
};

test("default coach state has the versioned empty shape and is fresh each time", () => {
  const first = createDefaultCoachState();
  const second = createDefaultCoachState();

  assert.deepEqual(first, {
    schemaVersion: COACH_SCHEMA_VERSION,
    profile: {},
    savedOpportunities: {},
    preferences: {},
    updatedAt: "",
  });
  assert.notStrictEqual(first.profile, second.profile);
  assert.notStrictEqual(first.savedOpportunities, second.savedOpportunities);
});

test("missing storage data loads as a valid empty state", () => {
  const result = loadCoachState({ storage: new MemoryStorage() });
  assert.equal(result.ok, true);
  assert.equal(result.status, "empty");
  assert.deepEqual(result.state.profile, {});
});

test("save serializes under the namespace, timestamps, and round-trips", () => {
  const storage = new MemoryStorage();
  const state = { ...createDefaultCoachState(), profile: validProfile };
  const now = new Date("2026-07-20T12:30:00.000Z");
  const saved = saveCoachState(state, { storage, now });

  assert.equal(saved.ok, true);
  assert.equal(saved.state.updatedAt, now.toISOString());
  assert.equal(storage.setCalls.length, 1);
  assert.equal(storage.setCalls[0][0], COACH_STORAGE_KEY);

  const loaded = loadCoachState({ storage });
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(loaded.state.profile, validProfile);
  assert.equal(loaded.state.updatedAt, now.toISOString());
});

test("corrupted JSON is reported without throwing or rewriting storage", () => {
  const storage = new MemoryStorage({ [COACH_STORAGE_KEY]: "{not-json" });
  const result = loadCoachState({ storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "corrupted");
  assert.deepEqual(result.state, createDefaultCoachState());
  assert.equal(storage.setCalls.length, 0);
});

test("unsupported values and schema versions are rejected defensively", () => {
  for (const value of ["null", "[]", "42", JSON.stringify({ schemaVersion: 99 })]) {
    const result = parseCoachState(value);
    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported");
  }
});

test("unavailable and throwing storage return visible failure results", () => {
  assert.equal(loadCoachState({ storage: null }).status, "unavailable");

  const throwingStorage = {
    getItem() {
      throw new Error("blocked");
    },
  };
  const result = loadCoachState({ storage: throwingStorage });
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
});

test("saving failures do not claim success", () => {
  const storage = {
    getItem: () => null,
    setItem() {
      throw new Error("quota exceeded");
    },
  };
  const result = updateStoredProfile(validProfile, { storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "save_failed");
  assert.match(result.message, /could not save/i);
});

test("unsupported profile input is rejected without touching storage", () => {
  const storage = new MemoryStorage();
  const result = updateStoredProfile(null, { storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.equal(storage.setCalls.length, 0);
});

test("saving and editing a profile preserve reserved future state", () => {
  const storage = new MemoryStorage();
  const initialState = {
    schemaVersion: COACH_SCHEMA_VERSION,
    profile: validProfile,
    savedOpportunities: { "opp-future": { saved: true } },
    preferences: { theme: "system" },
    updatedAt: "2026-07-19T00:00:00.000Z",
  };
  storage.setItem(COACH_STORAGE_KEY, JSON.stringify(initialState));
  storage.setCalls = [];

  const editedProfile = { ...validProfile, goal: "Complete a master's in sustainable energy." };
  const result = updateStoredProfile(editedProfile, {
    storage,
    now: new Date("2026-07-20T14:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.profile, editedProfile);
  assert.deepEqual(result.state.savedOpportunities, initialState.savedOpportunities);
  assert.deepEqual(result.state.preferences, initialState.preferences);
});

test("clearing removes only the profile and keeps the namespaced state", () => {
  const storage = new MemoryStorage();
  const initialState = {
    schemaVersion: COACH_SCHEMA_VERSION,
    profile: validProfile,
    savedOpportunities: { "opp-future": { saved: true } },
    preferences: { compact: true },
    updatedAt: "2026-07-19T00:00:00.000Z",
  };
  storage.setItem(COACH_STORAGE_KEY, JSON.stringify(initialState));

  const result = clearStoredProfile({ storage, now: new Date("2026-07-20T15:00:00.000Z") });

  assert.equal(result.ok, true);
  assert.equal(result.status, "cleared");
  assert.deepEqual(result.state.profile, {});
  assert.deepEqual(result.state.savedOpportunities, initialState.savedOpportunities);
  assert.deepEqual(result.state.preferences, initialState.preferences);
  assert.equal(storage.values.has(COACH_STORAGE_KEY), true);
});

test("a future schema is not silently overwritten during profile save", () => {
  const futureState = JSON.stringify({
    schemaVersion: 2,
    profile: {},
    savedOpportunities: {},
    preferences: {},
    updatedAt: "",
  });
  const storage = new MemoryStorage({ [COACH_STORAGE_KEY]: futureState });
  const result = updateStoredProfile(validProfile, { storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.equal(storage.getItem(COACH_STORAGE_KEY), futureState);
  assert.equal(storage.setCalls.length, 0);

  const reset = resetCoachState({ storage, now: new Date("2026-07-20T16:00:00.000Z") });
  assert.equal(reset.ok, true);
  assert.equal(reset.status, "reset");
  assert.deepEqual(reset.state.profile, {});
  assert.deepEqual(reset.state.savedOpportunities, {});
  assert.notEqual(storage.getItem(COACH_STORAGE_KEY), futureState);
});
