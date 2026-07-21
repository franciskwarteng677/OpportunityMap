import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICATION_LIMITS,
  APPLICATION_STATUS_OPTIONS,
  COACH_STORAGE_KEY,
} from "../js/config.js";
import {
  addOpportunityCustomTask,
  changeApplicationStatus,
  changeTaskStatus,
  deleteOpportunityCustomTask,
  editOpportunityCustomTask,
  getSavedOpportunityMap,
  hasMeaningfulApplicationWork,
  isOpportunitySaved,
  resetOpportunityChecklist,
  saveOpportunity,
  saveOpportunityNotes,
  unsaveOpportunity,
} from "../js/saved-opportunities.js";

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
}

const FIRST_TIME = "2026-07-20T10:00:00.000Z";
const SECOND_TIME = "2026-07-21T10:00:00.000Z";
const THIRD_TIME = "2026-07-22T10:00:00.000Z";

const directoryOpportunity = {
  id: "opp-directory",
  title: "Directory opportunity",
  matching: {
    educationStages: ["undergraduate"],
    categories: ["scholarships"],
  },
  eligibilityGuidance: {
    schemaVersion: 1,
    representedRequirements: [],
    unrepresentedRequirements: [{ description: "Check full requirements." }],
  },
};

const personalizedResultForSameOpportunity = {
  ...directoryOpportunity,
  profileMatch: 94,
  matchedReasons: ["Your preferred category matches."],
  eligibilityStatus: "verify-at-source",
};

const secondOpportunity = {
  id: "opp-second",
  title: "Second opportunity",
  studentLevel: "Undergraduate",
  eligibilityGuidance: {
    schemaVersion: 1,
    representedRequirements: [
      {
        id: "education-stage",
        type: "education_stage",
        verified: true,
        description: "Applicants must be undergraduate students.",
        sourceField: "studentLevel",
      },
    ],
  },
};

function getPersistedRecord(storage, opportunityId) {
  return JSON.parse(storage.getItem(COACH_STORAGE_KEY)).savedOpportunities[opportunityId];
}

test("saving from directory and personalized representations creates one ID-based record", () => {
  const storage = new MemoryStorage();
  const first = saveOpportunity(directoryOpportunity, { storage, now: FIRST_TIME });
  const duplicate = saveOpportunity(personalizedResultForSameOpportunity, { storage, now: SECOND_TIME });
  const loaded = getSavedOpportunityMap({ storage });

  assert.equal(first.ok, true);
  assert.equal(first.status, "opportunity_saved");
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.status, "already_saved");
  assert.deepEqual(Object.keys(loaded.savedOpportunities), [directoryOpportunity.id]);
  assert.equal(storage.setCalls.length, 1);

  const record = loaded.savedOpportunities[directoryOpportunity.id];
  assert.deepEqual(Object.keys(record).sort(), [
    "applicationStatus",
    "notes",
    "opportunityId",
    "savedAt",
    "tasks",
    "updatedAt",
  ]);
  assert.equal(record.opportunityId, directoryOpportunity.id);
  assert.equal(record.applicationStatus, "saved");
  assert.equal(record.tasks.length, 9);
  assert.equal("title" in record, false);
  assert.equal("matching" in record, false);
  assert.equal("profileMatch" in record, false);
  assert.equal("eligibilityStatus" in record, false);
});

test("saved work survives a fresh module read using the same browser storage", () => {
  const storage = new MemoryStorage();
  saveOpportunity(directoryOpportunity, { storage, now: FIRST_TIME });
  changeApplicationStatus(directoryOpportunity.id, "preparing", { storage, now: SECOND_TIME });
  saveOpportunityNotes(directoryOpportunity.id, "Compare the official instructions with my draft.", {
    storage,
    now: THIRD_TIME,
  });

  const reloaded = getSavedOpportunityMap({ storage });
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.savedOpportunities[directoryOpportunity.id].applicationStatus, "preparing");
  assert.equal(
    reloaded.savedOpportunities[directoryOpportunity.id].notes,
    "Compare the official instructions with my draft.",
  );
  assert.equal(isOpportunitySaved(directoryOpportunity.id, { storage }), true);
});

test("multiple saved opportunities update independently", () => {
  const storage = new MemoryStorage();
  saveOpportunity(directoryOpportunity, { storage, now: FIRST_TIME });
  saveOpportunity(secondOpportunity, { storage, now: SECOND_TIME });
  const untouchedSnapshot = structuredClone(getPersistedRecord(storage, secondOpportunity.id));

  const changed = changeApplicationStatus(directoryOpportunity.id, "researching", {
    storage,
    now: THIRD_TIME,
  });

  assert.equal(changed.ok, true);
  assert.equal(getPersistedRecord(storage, directoryOpportunity.id).applicationStatus, "researching");
  assert.deepEqual(getPersistedRecord(storage, secondOpportunity.id), untouchedSnapshot);
  assert.deepEqual(
    Object.keys(JSON.parse(storage.getItem(COACH_STORAGE_KEY)).savedOpportunities).sort(),
    [directoryOpportunity.id, secondOpportunity.id].sort(),
  );
});

test("prototype-named opportunity IDs are handled as own saved records", () => {
  const storage = new MemoryStorage();
  const opportunity = { id: "constructor", title: "Prototype-name regression" };
  const saved = saveOpportunity(opportunity, { storage, now: FIRST_TIME });

  assert.equal(saved.ok, true);
  assert.equal(saved.status, "opportunity_saved");
  assert.equal(isOpportunitySaved(opportunity.id, { storage }), true);
  assert.equal(getSavedOpportunityMap({ storage }).savedOpportunities.constructor.opportunityId, "constructor");

  const removed = unsaveOpportunity(opportunity.id, { storage, now: SECOND_TIME });
  assert.equal(removed.ok, true);
  assert.equal(isOpportunitySaved(opportunity.id, { storage }), false);
});

test("all canonical application statuses persist without changing task progress", () => {
  const storage = new MemoryStorage();
  saveOpportunity(directoryOpportunity, { storage, now: FIRST_TIME });
  const originalTasks = structuredClone(getPersistedRecord(storage, directoryOpportunity.id).tasks);

  for (const { value } of APPLICATION_STATUS_OPTIONS) {
    const result = changeApplicationStatus(directoryOpportunity.id, value, {
      storage,
      now: SECOND_TIME,
    });
    assert.equal(result.ok, true);
    assert.equal(result.record.applicationStatus, value);
    assert.deepEqual(result.record.tasks, originalTasks);
  }

  const invalid = changeApplicationStatus(directoryOpportunity.id, "accepted", { storage, now: THIRD_TIME });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, "invalid_request");
  assert.equal(getPersistedRecord(storage, directoryOpportunity.id).applicationStatus, "archived");
});

test("unsaving clean records is immediate but meaningful work requires confirmation", () => {
  const cleanStorage = new MemoryStorage();
  saveOpportunity(directoryOpportunity, { storage: cleanStorage, now: FIRST_TIME });
  const cleanRemoval = unsaveOpportunity(directoryOpportunity.id, { storage: cleanStorage });
  assert.equal(cleanRemoval.ok, true);
  assert.equal(cleanRemoval.status, "opportunity_removed");
  assert.equal(isOpportunitySaved(directoryOpportunity.id, { storage: cleanStorage }), false);

  const workedStorage = new MemoryStorage();
  saveOpportunity(directoryOpportunity, { storage: workedStorage, now: FIRST_TIME });
  changeApplicationStatus(directoryOpportunity.id, "preparing", { storage: workedStorage, now: SECOND_TIME });
  const beforeConfirmation = workedStorage.getItem(COACH_STORAGE_KEY);
  const blocked = unsaveOpportunity(directoryOpportunity.id, { storage: workedStorage });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, "confirmation_required");
  assert.equal(workedStorage.getItem(COACH_STORAGE_KEY), beforeConfirmation);

  const confirmed = unsaveOpportunity(directoryOpportunity.id, {
    storage: workedStorage,
    confirmed: true,
    now: THIRD_TIME,
  });
  assert.equal(confirmed.ok, true);
  assert.equal(isOpportunitySaved(directoryOpportunity.id, { storage: workedStorage }), false);
});

test("meaningful-work detection covers status, notes, custom tasks, and task progress", () => {
  const base = {
    applicationStatus: "saved",
    notes: "",
    tasks: [{ id: "generated", status: "not-started", sourceType: "general-guidance" }],
  };

  assert.equal(hasMeaningfulApplicationWork(base), false);
  assert.equal(hasMeaningfulApplicationWork({ ...base, applicationStatus: "researching" }), true);
  assert.equal(hasMeaningfulApplicationWork({ ...base, notes: "A private reminder" }), true);
  assert.equal(hasMeaningfulApplicationWork({
    ...base,
    tasks: [{ id: "custom-one", status: "not-started", sourceType: "custom" }],
  }), true);
  assert.equal(hasMeaningfulApplicationWork({
    ...base,
    tasks: [{ id: "generated", status: "complete", sourceType: "general-guidance" }],
  }), true);
});

test("task status and custom task add, edit, and delete operations persist", () => {
  const storage = new MemoryStorage();
  saveOpportunity(directoryOpportunity, { storage, now: FIRST_TIME });
  const generatedTaskId = getPersistedRecord(storage, directoryOpportunity.id).tasks[0].id;

  const statusResult = changeTaskStatus(
    directoryOpportunity.id,
    generatedTaskId,
    "complete",
    { storage, now: SECOND_TIME },
  );
  assert.equal(statusResult.ok, true);
  assert.equal(statusResult.task.status, "complete");

  const added = addOpportunityCustomTask(directoryOpportunity.id, "  Compare two programme routes  ", {
    storage,
    now: SECOND_TIME,
    idFactory: () => "custom-compare-routes",
  });
  assert.equal(added.ok, true);
  assert.equal(added.task.sourceType, "custom");
  assert.equal(added.task.title, "Compare two programme routes");

  const edited = editOpportunityCustomTask(
    directoryOpportunity.id,
    added.task.id,
    "Compare the programme routes",
    { storage, now: THIRD_TIME },
  );
  assert.equal(edited.ok, true);
  assert.equal(edited.task.title, "Compare the programme routes");

  const deleted = deleteOpportunityCustomTask(directoryOpportunity.id, added.task.id, {
    storage,
    now: THIRD_TIME,
  });
  assert.equal(deleted.ok, true);
  assert.equal(
    getPersistedRecord(storage, directoryOpportunity.id).tasks.some(({ id }) => id === added.task.id),
    false,
  );
  assert.equal(
    getPersistedRecord(storage, directoryOpportunity.id).tasks.find(({ id }) => id === generatedTaskId).status,
    "complete",
  );
});

test("reset restores generated tasks while retaining custom tasks and their state", () => {
  const storage = new MemoryStorage();
  saveOpportunity(secondOpportunity, { storage, now: FIRST_TIME });
  const generatedId = getPersistedRecord(storage, secondOpportunity.id).tasks[0].id;
  changeTaskStatus(secondOpportunity.id, generatedId, "complete", { storage, now: SECOND_TIME });
  const added = addOpportunityCustomTask(secondOpportunity.id, "Check my calendar", {
    storage,
    now: SECOND_TIME,
    idFactory: () => "custom-calendar",
  });
  changeTaskStatus(secondOpportunity.id, added.task.id, "in-progress", { storage, now: SECOND_TIME });

  const reset = resetOpportunityChecklist(secondOpportunity.id, secondOpportunity, {
    storage,
    now: THIRD_TIME,
  });
  assert.equal(reset.ok, true);
  assert.equal(reset.record.tasks.find(({ id }) => generatedId).status, "not-started");
  assert.equal(reset.record.tasks.find(({ id }) => id === added.task.id).status, "in-progress");
  assert.equal(reset.record.tasks.filter(({ sourceType }) => sourceType === "verified-requirement").length, 1);
});

test("notes persist as plain strings and reject content over the character limit", () => {
  const storage = new MemoryStorage();
  saveOpportunity(directoryOpportunity, { storage, now: FIRST_TIME });
  const notes = "<strong>Private</strong> reminder — verify at source.";
  const saved = saveOpportunityNotes(directoryOpportunity.id, notes, { storage, now: SECOND_TIME });

  assert.equal(saved.ok, true);
  assert.equal(getPersistedRecord(storage, directoryOpportunity.id).notes, notes);

  const beforeInvalidSave = storage.getItem(COACH_STORAGE_KEY);
  const tooLong = saveOpportunityNotes(
    directoryOpportunity.id,
    "x".repeat(APPLICATION_LIMITS.notesMaximumLength + 1),
    { storage, now: THIRD_TIME },
  );
  assert.equal(tooLong.ok, false);
  assert.equal(storage.getItem(COACH_STORAGE_KEY), beforeInvalidSave);
});

test("a saved ID remains manageable when its directory record is unavailable", () => {
  const storage = new MemoryStorage();
  const removedOpportunity = { id: "opp-no-longer-in-current-data" };
  saveOpportunity(removedOpportunity, { storage, now: FIRST_TIME });

  const loadedWithoutDatasetLookup = getSavedOpportunityMap({ storage });
  assert.equal(loadedWithoutDatasetLookup.savedOpportunities[removedOpportunity.id].opportunityId, removedOpportunity.id);

  const reset = resetOpportunityChecklist(removedOpportunity.id, null, { storage, now: SECOND_TIME });
  assert.equal(reset.ok, false);
  assert.equal(reset.status, "opportunity_unavailable");
  assert.equal(isOpportunitySaved(removedOpportunity.id, { storage }), true);

  const status = changeApplicationStatus(removedOpportunity.id, "archived", { storage, now: THIRD_TIME });
  assert.equal(status.ok, true);
  assert.equal(status.record.applicationStatus, "archived");
});

test("an empty browser state exposes an empty dashboard map", () => {
  const loaded = getSavedOpportunityMap({ storage: new MemoryStorage() });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.savedOpportunities, {});
  assert.equal(isOpportunitySaved("opp-anything", { storage: new MemoryStorage() }), false);
});
