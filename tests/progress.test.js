import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateOverallProgress,
  calculateTaskProgress,
  updateTaskStatus,
} from "../js/action-plans.js";

const CREATED_AT = "2026-07-20T10:00:00.000Z";

function task(id, status) {
  return {
    id,
    title: `Task ${id}`,
    status,
    sourceType: "general-guidance",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

test("task progress counts every status and bases percentage on completed tasks only", () => {
  const progress = calculateTaskProgress([
    task("one", "complete"),
    task("two", "complete"),
    task("three", "in-progress"),
    task("four", "not-started"),
    task("five", "not-started"),
    task("six", "not-started"),
  ]);

  assert.deepEqual(progress, {
    completed: 2,
    inProgress: 1,
    notStarted: 3,
    total: 6,
    percentage: 33,
  });
});

test("empty or unsupported task collections produce safe zero progress", () => {
  const empty = {
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    total: 0,
    percentage: 0,
  };

  assert.deepEqual(calculateTaskProgress([]), empty);
  assert.deepEqual(calculateTaskProgress(null), empty);
  assert.deepEqual(calculateOverallProgress({}), empty);
});

test("overall progress aggregates independent saved records, including archived records", () => {
  const records = {
    "opp-one": {
      applicationStatus: "preparing",
      tasks: [task("one", "complete"), task("two", "in-progress")],
    },
    "opp-archived": {
      applicationStatus: "archived",
      tasks: [task("three", "complete"), task("four", "not-started")],
    },
  };

  assert.deepEqual(calculateOverallProgress(records), {
    completed: 2,
    inProgress: 1,
    notStarted: 1,
    total: 4,
    percentage: 50,
  });
  assert.deepEqual(calculateOverallProgress(Object.values(records)), {
    completed: 2,
    inProgress: 1,
    notStarted: 1,
    total: 4,
    percentage: 50,
  });
});

test("progress changes do not infer or alter an application status", () => {
  const record = {
    applicationStatus: "saved",
    tasks: [task("one", "not-started")],
  };
  const changed = updateTaskStatus(record.tasks, "one", "complete", {
    now: "2026-07-21T10:00:00.000Z",
  });

  assert.equal(changed.ok, true);
  assert.equal(calculateTaskProgress(changed.tasks).percentage, 100);
  assert.equal(record.applicationStatus, "saved");
});
