import { browser } from "wxt/browser";
import { ANALYSIS_VERSION, unwrap, type PageState, type Reply } from "../../lib/model";
import {
  providerLabel,
  providerKeyLabel,
  resolveProvider,
  type Provider,
} from "../../lib/providers";
import "./style.css";

const get = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: ${id}`);
  return element as T;
};
const analyze = get<HTMLButtonElement>("analyze");
const toggle = get<HTMLButtonElement>("toggle");
const global = get<HTMLInputElement>("global");
const mode = get<HTMLSelectElement>("analysis-mode");
const provider = get<HTMLSelectElement>("provider");
const errorBox = get("error");
let tabId: number | undefined;
let hasKey = false;
let consented = false;
let working = false;
let savedProvider: Provider = "vercel";
let current: (PageState & { busy: boolean; error: string | null; sitePaused: boolean }) | null =
  null;
let poll: ReturnType<typeof setTimeout> | undefined;

async function request<T>(message: object): Promise<T> {
  return unwrap((await browser.runtime.sendMessage(message)) as Reply<T>);
}
function error(error: unknown) {
  errorBox.textContent =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unexpected error.";
  errorBox.hidden = false;
}
function render() {
  const busy = working || current?.busy;
  analyze.disabled =
    !current || !hasKey || !consented || !global.checked || !!current.sitePaused || !!busy;
  get<HTMLInputElement>("provider-consent").checked = consented;
  get<HTMLInputElement>("provider-consent").disabled = working || !!current?.busy;
  get("consent-provider").textContent = providerLabel(resolveProvider(provider.value));
  get<HTMLSelectElement>("analysis-mode").disabled = working || !!current?.busy;
  get("site-control").hidden = !current;
  get<HTMLInputElement>("site-paused").checked = !!current?.sitePaused;
  get<HTMLInputElement>("site-paused").disabled = working;
  get("setup").hidden = hasKey && consented;
  analyze.textContent = busy ? "Analyzing…" : current?.profile ? "Re-analyze" : "Analyze page";
  toggle.hidden = !current?.profile;
  toggle.disabled = !!busy || !global.checked || !!current?.sitePaused;
  toggle.textContent = current?.profile?.enabled ? "Pause" : "Resume";
  const selectedProvider = resolveProvider(provider.value);
  provider.disabled = working || !!current?.busy;
  get<HTMLInputElement>("api-key").disabled = working;
  get<HTMLButtonElement>("save-key").disabled = working;
  get<HTMLInputElement>("api-key").placeholder = `Paste ${providerKeyLabel(selectedProvider)} key`;
  get("key-status").textContent = hasKey
    ? `${selectedProvider === "typesafe" ? "TypeSafe" : "Vercel"} · Key saved`
    : "API key required";
  get("disclosure").textContent =
    `Analyze sends up to 60 element descriptions to ${providerLabel(selectedProvider)}. Main content containers and form controls are skipped; snippets may still contain personal data.`;
  get("auto-disclosure").textContent =
    `On page visit automatically sends element snippets to ${providerLabel(selectedProvider)} for new templates. Snippets may contain personal data. API charges apply. Cached templates are reused.`;
  get("remove-key").hidden = !hasKey;
  get("disclosure").hidden = !current || mode.value === "auto";
  get("auto-disclosure").hidden = mode.value !== "auto";
  get("mode-hint").textContent =
    mode.value === "auto"
      ? "On page visit · Cached templates reused"
      : "Manual analysis · Cached rules apply automatically";
  if (!current) return;
  const { profile, context, hiddenCount } = current;
  get("host").textContent = new URL(context.origin).hostname;
  get("template").textContent = context.label;
  get("hidden").textContent = String(hiddenCount);
  get("saved").textContent = profile
    ? `Saved ${new Date(profile.analyzedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";
  const status = get("status");
  const paused = !global.checked || current.sitePaused || profile?.enabled === false;
  status.textContent = busy
    ? "Analyzing"
    : paused
      ? "Paused"
      : profile
        ? profile.analysisVersion < ANALYSIS_VERSION
          ? "Update available"
          : "Saved template"
        : "Not analyzed";
  status.className = `badge ${busy ? "busy" : profile && !paused ? "active" : ""}`;
  get("rules-section").hidden = !profile;
  get("rule-count").textContent =
    `${profile?.rules.filter((rule) => rule.enabled).length ?? 0} rules`;
  const rules = get("rules");
  rules.replaceChildren();
  if (profile && !profile.rules.length) {
    const empty = document.createElement("p");
    empty.className = "disclosure";
    empty.textContent = profile.candidateCount
      ? "No clearly removable elements found."
      : "No safely targetable elements found.";
    rules.append(empty);
  }
  for (const rule of profile?.rules ?? []) {
    const label = document.createElement("label");
    label.className = "rule";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = rule.enabled;
    checkbox.disabled = !!busy;
    checkbox.setAttribute("aria-label", `Hide ${rule.selector}`);
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = rule.category;
    const selector = document.createElement("code");
    selector.textContent = rule.selector;
    info.append(title, selector);
    label.append(checkbox, info);
    rules.append(label);
    checkbox.addEventListener(
      "change",
      () => void act({ type: "rule", tabId, selector: rule.selector, enabled: checkbox.checked }),
    );
  }
}
async function load() {
  const config = await request<{
    enabled: boolean;
    hasKey: boolean;
    mode: "manual" | "auto";
    provider: Provider;
    consented: boolean;
  }>({
    type: "settings",
  });
  hasKey = config.hasKey;
  consented = config.consented;
  global.checked = config.enabled;
  mode.value = config.mode;
  savedProvider = resolveProvider(config.provider);
  provider.value = savedProvider;
  if (tabId !== undefined) {
    try {
      current = await request({ type: "status", tabId });
      if (current?.error) error(current.error);
    } catch (err) {
      current = null;
      get("status").textContent = "Open a website";
      get("host").textContent = "Ready to set up";
      get("template").textContent =
        "Open a normal website, allow access in Safari, then reopen this popup.";
      if (!(err instanceof Error) || !err.message.startsWith("Page unavailable.")) error(err);
    }
  }
  render();
  clearTimeout(poll);
  if (
    current?.busy ||
    (current &&
      !current.error &&
      config.mode === "auto" &&
      config.enabled &&
      hasKey &&
      consented &&
      !current.sitePaused &&
      current.profile?.enabled !== false &&
      (!current.profile || current.profile.analysisVersion < ANALYSIS_VERSION))
  )
    poll = setTimeout(() => void load().catch(error), 900);
}
async function act(message: object) {
  if (working) return;
  working = true;
  errorBox.hidden = true;
  get("notice").hidden = true;
  render();
  try {
    await request(message);
    await load();
  } catch (err) {
    try {
      await load();
    } catch {
      provider.value = savedProvider;
    }
    error(err);
  } finally {
    working = false;
    render();
  }
}

analyze.addEventListener("click", () => void act({ type: "analyze", tabId }));
toggle.addEventListener(
  "click",
  () => void act({ type: "toggle", tabId, enabled: !current?.profile?.enabled }),
);
global.addEventListener("change", () => void act({ type: "global", enabled: global.checked }));
mode.addEventListener("change", () => void act({ type: "mode", mode: mode.value }));
provider.addEventListener("change", () => {
  get<HTMLInputElement>("api-key").value = "";
  void act({ type: "provider", provider: resolveProvider(provider.value) });
});
get("provider-consent").addEventListener(
  "change",
  () =>
    void act({
      type: "consent",
      provider: resolveProvider(provider.value),
      allowed: get<HTMLInputElement>("provider-consent").checked,
    }),
);
get("site-paused").addEventListener(
  "change",
  () => void act({ type: "site", tabId, paused: get<HTMLInputElement>("site-paused").checked }),
);
get("forget").addEventListener("click", () => void act({ type: "forget", tabId }));
get("remove-key").addEventListener("click", () => void act({ type: "removeKey" }));
get("key-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = get<HTMLInputElement>("api-key");
  const key = input.value.trim();
  if (!key) {
    error(new Error(`Enter a ${providerKeyLabel(resolveProvider(provider.value))} API key.`));
    return;
  }
  void (async () => {
    await act({ type: "saveKey", key, provider: resolveProvider(provider.value) });
    input.value = "";
    if (errorBox.hidden) {
      get<HTMLDetailsElement>("connection").open = !consented;
      get("notice").textContent =
        "Key saved locally. Review provider permission, then Analyze page to verify access; provider charges apply.";
      get("notice").hidden = false;
    }
  })();
});
void (async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  await load();
  get<HTMLDetailsElement>("connection").open = !hasKey || !consented;
})().catch(error);
