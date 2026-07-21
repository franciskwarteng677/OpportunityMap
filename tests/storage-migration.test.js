import assert from "node:assert/strict";
import test from "node:test";

import {
  COACH_SCHEMA_VERSION,
  COACH_STORAGE_KEY,
  LEGACY_COACH_SCHEMA_VERSION,
} from "../js/config.js";
import {
  loadCoachState,
  parseCoachState,
  saveStoredOpportunity,
  updateStoredProfile,
} from "../js/storage.js";

class MemoryStorage {
  constructor(initial = {}, { failWrites = false } = {}) {
    this.values = new Map(Object.entries(initial));
    this.failWrites = failWrites;
    this.setCalls = [];
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.setCalls.push([key, value]);
    if (this.failWrites) throw new Error("quota exceeded");
    this.values.set(key, value);
  }
}

const legacyProfile = {
  citizenshipCountry: "GH",
  residenceCountry: "GH",
  age: null,
  educationStage: "undergraduate",
  fieldsOfInterest: ["engineering"],
  preferredCategories: ["scholarships"],
  goal: "Study renewable energy engineering.",
  fundingPreference: "fully_funded",
  mobilityPreference: "travel_and_relocate",
  experienceLevel: "under_one_year",
};

function legacyState(overrides = {}) {
  return {
    schemaVersion: LEGACY_COACH_SCHEMA_VERSION,
    profile: legacyProfile,
    savedOpportunities: {},
    preferences: { resultsView: "best" },
    updatedAt: "2026-07-19T10:00:00.000Z",
    ...overrides,
  };
}

function savedRecord(opportunityId = "opp-retained") {
  return {
    opportunityId,
    savedAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    applicationStatus: "saved",
    tasks: [],
    notes: "",
  };
}

test("version 1 state is recognized as a migration without mutating the parsed profile", () => {
  const parsed = parseCoachState(JSON.stringify(legacyState()));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.status, "migration-needed");
  assert.equal(parsed.state.schemaVersion, COACH_SCHEMA_VERSION);
  assert.deepEqual(parsed.state.profile, legacyProfile);
  assert.deepEqual(parsed.state.preferences, { resultsView: "best" });
  assert.deepEqual(parsed.state.savedOpportunities, {});
  assert.equal(parsed.state.updatedAt, "2026-07-19T10:00:00.000Z");
});

test("loading version 1 persists one safe version 2 migration and retains the profile", () => {
  const rawLegacyState = JSON.stringify(legacyState());
  const storage = new MemoryStorage({ [COACH_STORAGE_KEY]: rawLegacyState });
  const migrated = loadCoachState({ storage });

  assert.equal(migrated.ok, true);
  assert.equal(migrated.status, "migrated");
  assert.equal(storage.setCalls.length, 1);
  const stored = JSON.parse(storage.getItem(COACH_STORAGE_KEY));
  assert.equal(stored.schemaVersion, COACH_SCHEMA_VERSION);
  assert.deepEqual(stored.profile, legacyProfile);
  assert.deepEqual(stored.preferences, { resultsView: "best" });
  assert.deepEqual(stored.savedOpportunities, {});

  const reloaded = loadCoachState({ storage });
  assert.equal(reloaded.status, "loaded");
  assert.equal(storage.setCalls.length, 1);
  assert.deepEqual(reloaded.state.profile, legacyProfile);
});

test("failed migration exposes the readable profile but leaves the original bytes untouched", () => {
  const rawLegacyState = JSON.stringify(legacyState());
  const storage = new MemoryStorage(
    { [COACH_STORAGE_KEY]: rawLegacyState },
    { failWrites: true },
  );
  const result = loadCoachState({ storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "migration_failed");
  assert.deepEqual(result.state.profile, legacyProfile);
  assert.equal(storage.getItem(COACH_STORAGE_KEY), rawLegacyState);
});

test("legacy state with unknown saved records is not guessed at or overwritten", () => {
  const rawLegacyState = JSON.stringify(legacyState({
    savedOpportunities: { "legacy-unknown": { saved: true } },
  }));
  const storage = new MemoryStorage({ [COACH_STORAGE_KEY]: rawLegacyState });
  const result = loadCoachState({ storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.equal(storage.getItem(COACH_STORAGE_KEY), rawLegacyState);
  assert.equal(storage.setCalls.length, 0);
});

test("corrupted JSON is never overwritten by a save mutation", () => {
  const rawCorruptedState = "{not-valid-json";
  const storage = new MemoryStorage({ [COACH_STORAGE_KEY]: rawCorruptedState });
  const result = saveStoredOpportunity(savedRecord(), { storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "corrupted");
  assert.equal(storage.getItem(COACH_STORAGE_KEY), rawCorruptedState);
  assert.equal(storage.setCalls.length, 0);
});

test("future schema versions are never silently overwritten", () => {
  const rawFutureState = JSON.stringify({
    schemaVersion: COACH_SCHEMA_VERSION + 1,
    profile: legacyProfile,
    savedOpportunities: {},
    preferences: {},
    updatedAt: "2026-07-20T10:00:00.000Z",
  });
  const storage = new MemoryStorage({ [COACH_STORAGE_KEY]: rawFutureState });
  const result = updateStoredProfile({ ...legacyProfile, goal: "A changed goal" }, { storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.equal(storage.getItem(COACH_STORAGE_KEY), rawFutureState);
  assert.equal(storage.setCalls.length, 0);
});

test("a valid saved ID remains loaded without requiring a current directory record", () => {
  const record = savedRecord("opp-removed-from-directory");
  const rawState = JSON.stringify({
    schemaVersion: COACH_SCHEMA_VERSION,
    profile: legacyProfile,
    savedOpportunities: { [record.opportunityId]: record },
    preferences: {},
    updatedAt: record.updatedAt,
  });
  const storage = new MemoryStorage({ [COACH_STORAGE_KEY]: rawState });
  const loaded = loadCoachState({ storage });

  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.savedOpportunities[record.opportunityId], record);
  assert.deepEqual(loaded.state.profile, legacyProfile);
  assert.equal(storage.setCalls.length, 0);
});

test("saved records reject embedded match or eligibility snapshots", () => {
  const recordWithMatchSnapshot = {
    ...savedRecord(),
    profileMatch: 100,
    eligibilityStatus: "confirmed-fit",
  };
  const storage = new MemoryStorage();
  const result = saveStoredOpportunity(recordWithMatchSnapshot, { storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.equal(storage.getItem(COACH_STORAGE_KEY), null);
  assert.equal(storage.setCalls.length, 0);
});

test("saved records reject calendar-invalid timestamps", () => {
  const invalidRecord = {
    ...savedRecord(),
    updatedAt: "2026-02-31T10:00:00.000Z",
  };
  const storage = new MemoryStorage();
  const result = saveStoredOpportunity(invalidRecord, { storage });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.equal(storage.setCalls.length, 0);
});

test("quota failures do not claim that a saved record was persisted", () => {
  const storage = new MemoryStorage({}, { failWrites: true });
  const result = saveStoredOpportunity(savedRecord(), {
    storage,
    now: "2026-07-20T11:00:00.000Z",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "save_failed");
  assert.equal(storage.getItem(COACH_STORAGE_KEY), null);
});
