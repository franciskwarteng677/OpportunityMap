import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
});

function findBrowser() {
  const candidates = [
    process.env.OPPORTUNITYMAP_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = resolve(repositoryRoot, `.${requestedPath}`);
      const outsideRoot = relative(repositoryRoot, filePath).startsWith("..") || !filePath.startsWith(repositoryRoot);
      if (outsideRoot || !(await stat(filePath)).isFile()) throw new Error("not found");
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  return server.address().port;
}

async function reservePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function waitForEndpoint(url, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // The browser is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class DevToolsClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolvePromise, reject) => {
      this.socket.addEventListener("open", resolvePromise, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve: resolvePromise, reject, timer } = this.pending.get(message.id);
        clearTimeout(timer);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolvePromise(message.result || {});
        return;
      }
      (this.listeners.get(message.method) || []).forEach((listener) => listener(message));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out calling ${method}`));
      }, 10000);
      this.pending.set(id, { resolve: resolvePromise, reject, timer });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }
}

async function main() {
  const browserExecutable = findBrowser();
  assert.ok(browserExecutable, "Set OPPORTUNITYMAP_BROWSER to a Chrome or Edge executable.");
  const screenshotDirectory = process.env.OPPORTUNITYMAP_SCREENSHOT_DIR
    ? resolve(process.env.OPPORTUNITYMAP_SCREENSHOT_DIR)
    : "";
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });

  const server = createStaticServer();
  const serverPort = await listen(server);
  const debugPort = await reservePort();
  const profileDirectory = await mkdtemp(join(tmpdir(), "opportunitymap-browser-"));
  const browser = spawn(browserExecutable, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-gpu",
    "--no-default-browser-check",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  let client;
  try {
    const version = await waitForEndpoint(`http://127.0.0.1:${debugPort}/json/version`);
    client = new DevToolsClient(version.webSocketDebuggerUrl);
    await client.connect();
    const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
    const consoleErrors = [];
    client.on("Runtime.exceptionThrown", ({ params, sessionId: eventSession }) => {
      if (eventSession === sessionId) consoleErrors.push(params.exceptionDetails?.text || "Uncaught exception");
    });
    client.on("Runtime.consoleAPICalled", ({ params, sessionId: eventSession }) => {
      if (eventSession === sessionId && params.type === "error") {
        consoleErrors.push(params.args.map((argument) => argument.value || argument.description || "error").join(" "));
      }
    });
    await client.send("Page.enable", {}, sessionId);
    await client.send("Runtime.enable", {}, sessionId);

    async function evaluate(expression) {
      const response = await client.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      }, sessionId);
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
      }
      return response.result?.value;
    }

    async function waitFor(expression, label, timeout = 8000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await evaluate(`Boolean(${expression})`)) return;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      }
      throw new Error(`Timed out waiting for ${label}`);
    }

    const baseUrl = `http://127.0.0.1:${serverPort}/`;
    await client.send("Page.navigate", { url: baseUrl }, sessionId);
    await waitFor(
      "document.readyState === 'complete' && document.querySelectorAll('#opportunity-grid .opportunity-card').length === 9",
      "the nine opportunity cards",
    );

    assert.equal(await evaluate("document.querySelectorAll('#opportunity-grid .opportunity-card').length"), 9);
    assert.equal(await evaluate("[...document.querySelectorAll('.card__link')].every((link) => link.href.startsWith('https://'))"), true);
    assert.equal(await evaluate("document.querySelectorAll('#region-bars li').length"), 5);

    await evaluate(`(() => {
      const search = document.querySelector('#search-input');
      search.value = 'WIPO';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor("document.querySelectorAll('#opportunity-grid .opportunity-card').length === 1", "search filtering");
    assert.match(await evaluate("location.search"), /search=WIPO/);
    await evaluate("document.querySelector('#reset-filters').click()");
    await waitFor("document.querySelectorAll('#opportunity-grid .opportunity-card').length === 9", "filter reset");
    assert.equal(await evaluate("location.search"), "");

    await evaluate("document.querySelector('[data-id=\"opp-001\"] [data-save-opportunity]').click()");
    await waitFor("JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities['opp-001']", "directory save");
    let persisted = await evaluate("JSON.parse(localStorage.opportunityMapCoachState)");
    assert.equal(persisted.schemaVersion, 2);
    assert.equal(Object.keys(persisted.savedOpportunities).length, 1);
    assert.equal(persisted.savedOpportunities["opp-001"].tasks.length, 9);

    await evaluate(`(() => {
      document.querySelector('[data-create-profile]').click();
      const set = (selector, value) => {
        const element = document.querySelector(selector);
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('#citizenship-country', 'GH');
      set('#residence-country', 'GH');
      set('#education-stage', 'undergraduate');
      set('#funding-preference', 'fully_funded');
      set('#mobility-preference', 'travel_and_relocate');
      set('#experience-level', 'one_to_two_years');
      const field = document.querySelector('input[name="fieldsOfInterest"][value="engineering"]');
      field.checked = true;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      const category = document.querySelector('input[name="preferredCategories"][value="scholarships"]');
      category.checked = true;
      category.dispatchEvent(new Event('change', { bubbles: true }));
      const goal = document.querySelector('#profile-goal');
      goal.value = 'Study engineering and build research experience.';
      goal.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#student-profile-form').requestSubmit();
    })()`);
    await waitFor("!document.querySelector('#profile-summary').hidden", "profile save");
    await evaluate("document.querySelector('#find-matches').click()");
    await waitFor("document.querySelectorAll('#matching-grid .opportunity-card').length === 9", "personalized matches");
    assert.equal(
      await evaluate("document.querySelector('#matching-grid [data-id=\"opp-001\"] [data-save-opportunity]').getAttribute('aria-pressed')"),
      "true",
    );

    await evaluate("document.querySelector('#matching-grid [data-id=\"opp-002\"] [data-save-opportunity]').click()");
    await waitFor("Object.keys(JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities).length === 2", "personalized save");
    assert.equal(
      await evaluate("document.querySelector('#opportunity-grid [data-id=\"opp-002\"] [data-save-opportunity]').getAttribute('aria-pressed')"),
      "true",
    );
    assert.equal(await evaluate("document.querySelector('#applications-saved-count').textContent"), "2");

    await evaluate(`(() => {
      const card = [...document.querySelectorAll('.application-card')].find((item) => item.dataset.opportunityId === 'opp-001');
      card.querySelector('.application-card__manage').open = true;
      const status = card.querySelector('.application-card__status-select');
      status.value = 'preparing';
      status.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor("JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities['opp-001'].applicationStatus === 'preparing'", "status update");

    await evaluate(`(() => {
      const card = [...document.querySelectorAll('.application-card')].find((item) => item.dataset.opportunityId === 'opp-001');
      const task = card.querySelector('[data-task-status]');
      task.value = 'complete';
      task.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor("JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities['opp-001'].tasks[0].status === 'complete'", "task completion");

    await evaluate(`(() => {
      const card = [...document.querySelectorAll('.application-card')].find((item) => item.dataset.opportunityId === 'opp-001');
      const form = card.querySelector('[data-custom-task-form]');
      form.querySelector('[data-custom-task-input]').value = 'Ask a mentor to review my plan';
      form.requestSubmit();
    })()`);
    await waitFor("JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities['opp-001'].tasks.some((task) => task.sourceType === 'custom')", "custom task add");

    await evaluate(`(() => {
      const card = [...document.querySelectorAll('.application-card')].find((item) => item.dataset.opportunityId === 'opp-001');
      card.querySelector('[data-edit-custom-task]').click();
      const input = document.querySelector('#custom-task-input');
      input.value = 'Review the plan with a mentor';
      document.querySelector('#custom-task-form').requestSubmit();
    })()`);
    await waitFor("JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities['opp-001'].tasks.some((task) => task.title === 'Review the plan with a mentor')", "custom task edit");

    await evaluate(`(() => {
      const card = [...document.querySelectorAll('.application-card')].find((item) => item.dataset.opportunityId === 'opp-001');
      const form = card.querySelector('.application-notes-form');
      form.querySelector('.application-notes').value = '<strong>Private</strong> browser note';
      form.requestSubmit();
    })()`);
    await waitFor("JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities['opp-001'].notes.includes('<strong>')", "note save");
    assert.equal(await evaluate("document.querySelectorAll('#my-applications img').length"), 0);

    const failedDrafts = await evaluate(`(() => {
      const card = [...document.querySelectorAll('.application-card')].find((item) => item.dataset.opportunityId === 'opp-001');
      const notes = card.querySelector('.application-notes');
      const customTask = card.querySelector('[data-custom-task-input]');
      const originalSetItem = Storage.prototype.setItem;
      notes.value = 'Keep this unsaved note after a quota failure';
      customTask.value = 'Keep this unsaved task after a quota failure';
      Storage.prototype.setItem = function blockedWrite() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
      try {
        card.querySelector('.application-notes-form').requestSubmit();
        card.querySelector('[data-custom-task-form]').requestSubmit();
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
      return {
        notes: notes.value,
        customTask: customTask.value,
        message: card.querySelector('.application-card__message').textContent,
      };
    })()`);
    assert.equal(failedDrafts.notes, "Keep this unsaved note after a quota failure");
    assert.equal(failedDrafts.customTask, "Keep this unsaved task after a quota failure");
    assert.match(failedDrafts.message, /could not save/i);

    for (const width of [1280, 768, 390, 320]) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width <= 390,
      }, sessionId);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      const metrics = await evaluate("({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth })");
      assert.ok(metrics.content <= metrics.viewport, `${width}px viewport overflows: ${JSON.stringify(metrics)}`);
      if (width === 390) {
        const mobileNavigation = await evaluate(`(() => {
          const menu = document.querySelector('.mobile-nav');
          menu.open = true;
          menu.querySelector('a[href="#my-applications"]').click();
          return { open: menu.open, hash: location.hash };
        })()`);
        assert.deepEqual(mobileNavigation, { open: false, hash: "#my-applications" });
      }
      if (screenshotDirectory) {
        await evaluate(`(() => {
          document.documentElement.style.scrollBehavior = 'auto';
          const card = document.querySelector('.application-card');
          window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 80);
        })()`);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
        const screenshot = await client.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: false,
        }, sessionId);
        await writeFile(join(screenshotDirectory, `phase3-${width}.png`), screenshot.data, "base64");
      }
    }

    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);
    await client.send("Page.reload", { ignoreCache: true }, sessionId);
    await waitFor(
      "document.readyState === 'complete' && document.querySelectorAll('#opportunity-grid .opportunity-card').length === 9",
      "reload persistence",
    );
    persisted = await evaluate("JSON.parse(localStorage.opportunityMapCoachState)");
    assert.equal(persisted.savedOpportunities["opp-001"].applicationStatus, "preparing");
    assert.equal(persisted.savedOpportunities["opp-001"].notes, "<strong>Private</strong> browser note");
    assert.equal(persisted.savedOpportunities["opp-001"].tasks.some((task) => task.status === "complete"), true);
    assert.equal(Object.hasOwn(persisted.savedOpportunities["opp-001"], "profileMatch"), false);
    assert.equal(await evaluate("document.querySelector('#applications-saved-count').textContent"), "2");

    await evaluate("document.querySelector('#opportunity-grid [data-id=\"opp-001\"] [data-save-opportunity]').click()");
    await waitFor("document.querySelector('#application-confirm-dialog').open", "unsave confirmation");
    await client.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }, sessionId);
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }, sessionId);
    await waitFor("!document.querySelector('#application-confirm-dialog').open", "Escape to close confirmation");
    await waitFor(
      "document.activeElement === document.querySelector('#opportunity-grid [data-id=\"opp-001\"] [data-save-opportunity]')",
      "focus restoration after cancelling unsave",
    );
    assert.equal(await evaluate("Boolean(JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities['opp-001'])"), true);

    await evaluate("document.querySelector('#opportunity-grid [data-id=\"opp-001\"] [data-save-opportunity]').click()");
    await waitFor("document.querySelector('#application-confirm-dialog').open", "second unsave confirmation");
    await evaluate("document.querySelector('#confirm-application-action').click()");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    const confirmedUnsaveState = await evaluate(`({
      open: document.querySelector('#application-confirm-dialog').open,
      message: document.querySelector('#applications-status').textContent,
      saved: Object.keys(JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities),
    })`);
    assert.equal(confirmedUnsaveState.open, false);
    assert.equal(confirmedUnsaveState.saved.includes("opp-001"), false, confirmedUnsaveState.message);

    await evaluate("document.querySelector('#opportunity-grid [data-id=\"opp-002\"] [data-save-opportunity]').click()");
    await waitFor("Object.keys(JSON.parse(localStorage.opportunityMapCoachState).savedOpportunities).length === 0", "clean unsave");
    assert.equal(await evaluate("document.querySelector('#application-confirm-dialog').open"), false);
    assert.equal(await evaluate("!document.querySelector('#applications-empty').hidden"), true);

    await evaluate("localStorage.setItem('opportunityMapCoachState', '{corrupted-json')");
    await client.send("Page.reload", { ignoreCache: true }, sessionId);
    await waitFor(
      "document.readyState === 'complete' && document.querySelectorAll('#opportunity-grid .opportunity-card').length === 9",
      "corrupted-storage recovery view",
    );
    assert.equal(await evaluate("document.querySelector('#applications-empty').hidden"), true);
    assert.match(await evaluate("document.querySelector('#applications-status').textContent"), /corrupted/i);
    assert.equal(await evaluate("localStorage.getItem('opportunityMapCoachState')"), "{corrupted-json");
    assert.deepEqual(consoleErrors, []);

    console.log("PASS browser integration: directory, matching, saving, profile, dashboard, tasks, notes, persistence, confirmations");
    console.log("PASS responsive overflow: 1280px, 768px, 390px, 320px");
    console.log("PASS JavaScript console: no errors");
  } finally {
    client?.close();
    browser.kill();
    await new Promise((resolvePromise) => server.close(resolvePromise));
    const safeTemporaryDirectory = dirname(profileDirectory) === tmpdir()
      && profileDirectory.startsWith(join(tmpdir(), "opportunitymap-browser-"));
    if (safeTemporaryDirectory) {
      await rm(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
