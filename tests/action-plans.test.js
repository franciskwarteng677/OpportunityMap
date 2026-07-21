import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { APPLICATION_LIMITS } from "../js/config.js";
import {
  addCustomTask,
  deleteCustomTask,
  editCustomTask,
  generateActionPlan,
  resetGeneratedChecklist,
  updateTaskStatus,
} from "../js/action-plans.js";

const CREATED_AT = "2026-07-20T10:00:00.000Z";
const UPDATED_AT = "2026-07-21T10:00:00.000Z";
const opportunities = JSON.parse(await readFile(new URL("../data/opportunities.json", import.meta.url), "utf8"));

const opportunityWithVerifiedCriteria = {
  id: "opp-test",
  eligibleFor: "Applicants must meet the stated age range.",
  studentLevel: "Secondary school",
  eligibilityGuidance: {
    schemaVersion: 1,
    representedRequirements: [
      {
        id: "age-range",
        type: "age_range",
        verified: true,
        description: "Applicants must meet the published age range.",
        sourceField: "eligibleFor",
      },
      {
        id: "education-stage",
        type: "education_stage",
        verified: true,
        description: "Applicants must be secondary-school students.",
        sourceField: "studentLevel",
      },
      {
        id: "unverified-promotional-copy",
        verified: false,
        description: "An unsupported promotional claim.",
        sourceField: "eligibleFor",
      },
    ],
    unrepresentedRequirements: [
      { description: "A requirement that is deliberately not structured." },
    ],
  },
};

test("action plans start with a deterministic general-guidance checklist", () => {
  const tasks = generateActionPlan({ id: "opp-general" }, { now: CREATED_AT });

  assert.equal(tasks.length, 9);
  assert.equal(new Set(tasks.map(({ id }) => id)).size, tasks.length);
  assert.ok(tasks.every((task) => task.sourceType === "general-guidance"));
  assert.ok(tasks.every((task) => task.status === "not-started"));
  assert.ok(tasks.every((task) => task.createdAt === CREATED_AT && task.updatedAt === CREATED_AT));
  assert.ok(tasks.some(({ title }) => /official eligibility page/i.test(title)));
  assert.ok(tasks.some(({ title }) => /official source/i.test(title)));
  assert.ok(tasks.every((task) => (
    Object.keys(task).sort().join(",")
      === "createdAt,id,sourceType,status,title,updatedAt"
  )));
});

test("only explicitly represented and verified criteria create opportunity-specific tasks", () => {
  const tasks = generateActionPlan(opportunityWithVerifiedCriteria, { now: CREATED_AT });
  const verifiedTasks = tasks.filter(({ sourceType }) => sourceType === "verified-requirement");

  assert.deepEqual(verifiedTasks.map(({ id }) => id), [
    "verified-age-range",
    "verified-education-stage",
  ]);
  assert.ok(verifiedTasks.every(({ title }) => title.startsWith("Verify at the official source:")));
  assert.equal(tasks.some(({ title }) => /unsupported promotional claim/i.test(title)), false);
  assert.equal(tasks.some(({ title }) => /deliberately not structured/i.test(title)), false);
});

test("all nine verified opportunities generate valid plans without invented target dates", () => {
  let verifiedTaskCount = 0;

  opportunities.forEach((opportunity) => {
    const tasks = generateActionPlan(opportunity, { now: CREATED_AT });
    const representedCount = opportunity.eligibilityGuidance.representedRequirements.length;

    assert.equal(tasks.length, 9 + representedCount, `${opportunity.id} should map only represented requirements`);
    assert.equal(new Set(tasks.map(({ id }) => id)).size, tasks.length);
    assert.ok(tasks.every(({ sourceType }) => ["general-guidance", "verified-requirement"].includes(sourceType)));
    assert.ok(tasks.every((task) => !Object.hasOwn(task, "targetDate")));
    verifiedTaskCount += tasks.filter(({ sourceType }) => sourceType === "verified-requirement").length;
  });

  assert.equal(opportunities.length, 9);
  assert.equal(verifiedTaskCount, 7);
});

test("generated task titles cannot be edited or individually deleted", () => {
  const tasks = generateActionPlan({ id: "opp-general" }, { now: CREATED_AT });
  const taskId = tasks[0].id;

  const edited = editCustomTask(tasks, taskId, "Misleading official requirement", { now: UPDATED_AT });
  const deleted = deleteCustomTask(tasks, taskId);

  assert.equal(edited.ok, false);
  assert.equal(edited.status, "protected_task");
  assert.equal(deleted.ok, false);
  assert.equal(deleted.status, "protected_task");
  assert.deepEqual(edited.tasks, tasks);
  assert.deepEqual(deleted.tasks, tasks);
});

test("custom tasks can be added, edited, and deleted without mutating prior arrays", () => {
  const initial = generateActionPlan({ id: "opp-general" }, { now: CREATED_AT });
  const added = addCustomTask(initial, "  Book a quiet review session  ", {
    now: CREATED_AT,
    idFactory: () => "custom-review-session",
  });

  assert.equal(added.ok, true);
  assert.equal(initial.length, 9);
  assert.equal(added.tasks.length, 10);
  assert.deepEqual(added.task, {
    id: "custom-review-session",
    title: "Book a quiet review session",
    status: "not-started",
    sourceType: "custom",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });

  const edited = editCustomTask(
    added.tasks,
    added.task.id,
    "Review the application with a mentor",
    { now: UPDATED_AT },
  );
  assert.equal(edited.ok, true);
  assert.equal(edited.task.title, "Review the application with a mentor");
  assert.equal(edited.task.createdAt, CREATED_AT);
  assert.equal(edited.task.updatedAt, UPDATED_AT);
  assert.equal(added.task.title, "Book a quiet review session");

  const deleted = deleteCustomTask(edited.tasks, added.task.id);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.tasks.length, 9);
  assert.equal(deleted.tasks.some(({ id }) => id === added.task.id), false);
});

test("custom task validation enforces empty, length, and duplicate-id limits", () => {
  const initial = generateActionPlan({ id: "opp-general" }, { now: CREATED_AT });

  assert.equal(addCustomTask(initial, "   ", { now: CREATED_AT }).status, "invalid_title");
  assert.equal(addCustomTask(initial, "x".repeat(APPLICATION_LIMITS.customTaskTitleMaximumLength + 1), {
    now: CREATED_AT,
  }).status, "invalid_title");
  assert.equal(addCustomTask(initial, "Duplicate", {
    now: CREATED_AT,
    idFactory: () => initial[0].id,
  }).status, "invalid_id");
});

test("task status changes accept canonical values and update only the chosen task", () => {
  const tasks = generateActionPlan({ id: "opp-general" }, { now: CREATED_AT });
  const target = tasks[1];
  const result = updateTaskStatus(tasks, target.id, "in-progress", { now: UPDATED_AT });

  assert.equal(result.ok, true);
  assert.equal(result.task.status, "in-progress");
  assert.equal(result.task.updatedAt, UPDATED_AT);
  assert.equal(result.tasks[0].status, "not-started");
  assert.equal(tasks[1].status, "not-started");
  assert.equal(updateTaskStatus(tasks, target.id, "done", { now: UPDATED_AT }).status, "invalid_status");
  assert.equal(updateTaskStatus(tasks, "missing-task", "complete", { now: UPDATED_AT }).status, "not_found");
});

test("reset replaces generated guidance while preserving custom tasks and their progress", () => {
  const generated = generateActionPlan(opportunityWithVerifiedCriteria, { now: CREATED_AT });
  const progressed = updateTaskStatus(generated, generated[0].id, "complete", { now: UPDATED_AT }).tasks;
  const added = addCustomTask(progressed, "Ask my teacher to review my plan", {
    now: CREATED_AT,
    idFactory: () => "custom-teacher-review",
  });
  const customProgressed = updateTaskStatus(
    added.tasks,
    added.task.id,
    "in-progress",
    { now: UPDATED_AT },
  ).tasks;

  const reset = resetGeneratedChecklist(customProgressed, opportunityWithVerifiedCriteria, {
    now: "2026-07-22T10:00:00.000Z",
  });

  assert.equal(reset.ok, true);
  assert.equal(reset.tasks.filter(({ sourceType }) => sourceType !== "custom").length, 11);
  assert.ok(reset.tasks.filter(({ sourceType }) => sourceType !== "custom").every((task) => (
    task.status === "not-started" && task.createdAt === "2026-07-22T10:00:00.000Z"
  )));
  assert.deepEqual(
    reset.tasks.find(({ id }) => id === added.task.id),
    customProgressed.find(({ id }) => id === added.task.id),
  );

  const unavailable = resetGeneratedChecklist(customProgressed, null, { now: UPDATED_AT });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.status, "opportunity_unavailable");
  assert.deepEqual(unavailable.tasks, customProgressed);
});
