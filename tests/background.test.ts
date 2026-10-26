import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import type { Reply } from "../lib/model";

type Sender = { id: string; url: string; tab?: { id: number }; frameId?: number };
let listener: (message: unknown, sender: Sender, respond: (reply: Reply<unknown>) => void) => void;
const data: Record<string, unknown> = {};
const origin = "https://example.com";
const context = { key: `${origin}|v1|fixture`, origin, label: "article", kind: "article" };
const profileKey = `profile:${context.key}`;
const snapshot = {
  context,
  url: `${origin}/article`,
  candidates: [
    {
      id: "e0",
      selector: "div.ad-slot",
      tag: "div",
      signals: "advertisement",
      text: "Ad",
      position: "static",
      count: 1,
    },
  ],
};
const uiSender = { id: "unclutter-test", url: "safari-web-extension://fixture/popup.html" };
const pageSender = { id: "unclutter-test", url: snapshot.url, tab: { id: 1 }, frameId: 0 };
const action = {
  setBadgeText: async () => {},
  setBadgeBackgroundColor: async () => {},
  setTitle: async () => {},
};
Object.assign(globalThis, {
  browser: {
    runtime: {
      id: uiSender.id,
      getURL: () => uiSender.url,
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    },
    storage: {
      local: {
        get: async (keys: string | string[]) =>
          Object.fromEntries(
            (typeof keys === "string" ? [keys] : keys).map((key) => [
              key,
              structuredClone(data[key]),
            ]),
          ),
        set: async (values: Record<string, unknown>) => {
          Object.assign(data, structuredClone(values));
        },
        remove: async (keys: string | string[]) => {
          for (const key of typeof keys === "string" ? [keys] : keys) delete data[key];
        },
      },
    },
    action,
    tabs: {
      query: async () => [{ id: 1 }],
      sendMessage: async (_id: number, message: { type: string }) => ({
        ok: true,
        data:
          message.type === "snapshot"
            ? snapshot
            : {
                context,
                enabled: data.enabled !== false,
                profile: data[profileKey] ?? null,
                hiddenCount: 0,
              },
      }),
      onRemoved: { addListener: () => {} },
      onUpdated: { addListener: () => {} },
    },
  },
  defineBackground: (main: () => void) => main(),
});
await import("../entrypoints/background");
const ui = (message: object, sender = uiSender) =>
  new Promise<Reply<unknown>>((resolve) => listener(message, sender, resolve));
const visit = () =>
  new Promise<Reply<unknown>>((resolve) =>
    listener({ type: "visit", context }, pageSender, resolve),
  );
const originalFetch = globalThis.fetch;
let calls: string[] = [];
let hold: (() => Promise<void>) | undefined;
const response = () =>
  new Response(
    JSON.stringify({
      answers: {
        e0: { type: "choice", choice: "ad", probabilities: { ad: 0.99 }, confidence: 0.99 },
      },
    }),
    { status: 200 },
  );
globalThis.fetch = async (input) => {
  calls.push(String(input));
  if (hold) await hold();
  return response();
};
after(() => {
  globalThis.fetch = originalFetch;
});
beforeEach(() => {
  for (const key of Object.keys(data)) delete data[key];
  Object.assign(data, {
    enabled: true,
    mode: "manual",
    provider: "typesafe",
    apiKey: "synthetic-test-key",
  });
  calls = [];
  hold = undefined;
});

test("saved credentials do not imply consent; manual and automatic requests fail closed", async () => {
  const manual = await ui({ type: "analyze", tabId: 1 });
  assert.equal(manual.ok, false);
  if (!manual.ok) assert.match(manual.error, /Allow analysis/);
  data.mode = "auto";
  assert.equal((await visit()).ok, true);
  assert.equal(calls.length, 0);
  assert.equal((await ui({ type: "mode", mode: "auto" })).ok, false);
  assert.equal((await ui({ type: "consent", provider: "typesafe", allowed: true })).ok, true);
  assert.equal(data.mode, "manual");
  assert.equal(calls.length, 0, "Saving consent returns to Manual without a provider request");
  assert.equal((await ui({ type: "analyze", tabId: 1 })).ok, true);
  assert.equal(calls.length, 1);
  assert.ok(data[profileKey]);
});

test("switching provider removes its predecessor's key and returns to manual mode", async () => {
  data.consentedProviders = ["typesafe"];
  data.mode = "auto";
  assert.equal((await ui({ type: "provider", provider: "vercel" })).ok, true);
  assert.equal(data.apiKey, undefined);
  assert.equal(data.mode, "manual");
  const status = await ui({ type: "settings" });
  assert.ok(status.ok);
  assert.deepEqual(status.data, {
    enabled: true,
    hasKey: false,
    provider: "vercel",
    mode: "manual",
    consented: false,
  });
  assert.equal((await ui({ type: "analyze", tabId: 1 })).ok, false);
  assert.equal(calls.length, 0);
});

test("saving a key is manual-only and rejects a stale provider selection", async () => {
  data.consentedProviders = ["typesafe"];
  data.mode = "auto";
  assert.equal(
    (await ui({ type: "saveKey", provider: "vercel", key: "stale-test-key" })).ok,
    false,
  );
  assert.equal(data.provider, "typesafe");
  assert.equal(data.apiKey, "synthetic-test-key");
  assert.equal((await ui({ type: "saveKey", provider: "typesafe", key: "new-test-key" })).ok, true);
  assert.equal(data.mode, "manual");
  assert.equal(data.apiKey, "new-test-key");
  assert.equal(calls.length, 0);
});

test("a paused origin blocks both provider paths and disables cached cleanup", async () => {
  data.consentedProviders = ["typesafe"];
  data.mode = "auto";
  assert.equal((await ui({ type: "site", tabId: 1, paused: true })).ok, true);
  assert.equal((await ui({ type: "analyze", tabId: 1 })).ok, false);
  assert.equal((await visit()).ok, true);
  const sync = await new Promise<Reply<unknown>>((resolve) =>
    listener({ type: "sync", context, hiddenCount: 0 }, pageSender, resolve),
  );
  assert.ok(sync.ok);
  assert.deepEqual(sync.data, { profile: null, enabled: false, autoEnabled: false });
  assert.equal(calls.length, 0);
  assert.equal((await ui({ type: "site", tabId: 1, paused: false })).ok, true);
  assert.deepEqual(data.excludedOrigins, []);
});

test("revoking consent during a request preserves existing rules and prevents automatic retries", async () => {
  data.consentedProviders = ["typesafe"];
  const old = {
    ...context,
    enabled: true,
    version: 1,
    analysisVersion: 2,
    analyzedAt: 1,
    candidateCount: 0,
    rules: [],
  };
  data[profileKey] = structuredClone(old);
  let finish!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  hold = async () => {
    started();
    await waiting;
  };
  const analysis = ui({ type: "analyze", tabId: 1 });
  await requested;
  await ui({ type: "consent", provider: "typesafe", allowed: false });
  finish();
  assert.equal((await analysis).ok, false);
  assert.deepEqual(data[profileKey], old);
  assert.equal(data.mode, "manual");
  data.mode = "auto";
  await visit();
  assert.equal(calls.length, 1);
});

for (const [label, change] of [
  ["provider switch", { type: "provider", provider: "vercel" }],
  ["key replacement", { type: "saveKey", provider: "typesafe", key: "replacement-test-key" }],
  ["site pause", { type: "site", tabId: 1, paused: true }],
  ["global pause", { type: "global", enabled: false }],
] as const) {
  test(`${label} during analysis discards the result without overwriting saved rules`, async () => {
    data.consentedProviders = ["typesafe"];
    const old = {
      ...context,
      enabled: true,
      version: 1,
      analysisVersion: 2,
      analyzedAt: 1,
      candidateCount: 0,
      rules: [],
    };
    data[profileKey] = structuredClone(old);
    let finish!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      started = resolve;
    });
    hold = async () => {
      started();
      await waiting;
    };
    const analysis = ui({ type: "analyze", tabId: 1 });
    await requested;
    assert.equal((await ui(change)).ok, true);
    finish();
    assert.equal((await analysis).ok, false);
    assert.deepEqual(data[profileKey], old);
    assert.equal(calls.length, 1);
  });
}

test("page and foreign senders cannot read settings or grant provider consent", async () => {
  const page = await ui({ type: "settings" }, pageSender);
  const foreign = await ui(
    { type: "consent", provider: "typesafe", allowed: true },
    { ...uiSender, id: "foreign-extension" },
  );
  assert.equal(page.ok, false);
  assert.equal(foreign.ok, false);
  assert.equal(data.consentedProviders, undefined);
  assert.equal(calls.length, 0);
});
