import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { collectCandidates, createCleaner, matchingElements } from "../lib/dom";
import { evaluationRequest, rulesFromAnswers } from "../lib/jev";
import { pageContext } from "../lib/page-context";

const doc = (html: string) => new JSDOM(html, { url: "https://www.bbc.com" }).window.document;
const article = () =>
  doc(
    '<meta property="og:type" content="article"><main data-testid="story-page"><article><h1>Story</h1><p>Editorial content stays.</p></article><div class="ad-banner">Advertisement</div></main>',
  );

test("article siblings share rules; homepage, section, site, and different shell stay separate", () => {
  const one = pageContext(article(), "https://www.bbc.com/news/articles/cabc123?utm_source=test");
  const two = pageContext(article(), "https://www.bbc.com/news/articles/cdef456");
  assert.equal(one.key, two.key);
  assert.notEqual(one.key, pageContext(article(), "https://www.bbc.com/").key);
  assert.notEqual(
    one.key,
    pageContext(doc("<main>Section</main>"), "https://www.bbc.com/news").key,
  );
  assert.notEqual(one.key, pageContext(article(), "https://other.com/news/articles/cabc123").key);
  assert.notEqual(
    one.key,
    pageContext(
      doc(
        '<meta property="og:type" content="article"><main data-testid="live-page"><article><h1>Live</h1></article></main>',
      ),
      "https://www.bbc.com/news/articles/cabc123",
    ).key,
  );
});

test("JSON-LD @graph article metadata and dated URLs group correctly", () => {
  const d = doc(
    '<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle"}]}</script><main></main>',
  );
  assert.equal(
    pageContext(d, "https://example.com/2026/09/17/first-story").key,
    pageContext(d, "https://example.com/2025/04/02/second-story").key,
  );
  assert.equal(pageContext(d, "https://example.com/story").kind, "article");
});

test("numeric article IDs preserve route families and homepage searches stay separate", () => {
  const d = article();
  assert.equal(
    pageContext(d, "https://example.com/news/articles/123").key,
    pageContext(d, "https://example.com/news/articles/456").key,
  );
  assert.notEqual(
    pageContext(d, "https://example.com/news/123").key,
    pageContext(d, "https://example.com/sport/456").key,
  );
  assert.notEqual(
    pageContext(d, "https://example.com/").key,
    pageContext(d, "https://example.com/?q=world").key,
  );
});

test("generic short section routes are not incorrectly merged", () => {
  const d = doc("<main></main>");
  assert.notEqual(
    pageContext(d, "https://example.com/news/world").key,
    pageContext(d, "https://example.com/news/business").key,
  );
});

test("candidates include cookie banners but protect main content, ordinary forms and paywalls", () => {
  const d = doc(
    '<main class="promo-main"><h1>Story</h1></main><div class="ad-slot">Ad contact hello@example.com</div><div class="newsletter"><form><input value="secret" /></form></div><div class="cookie-banner">Accept all cookies</div><div class="paywall-overlay">Subscribe to read</div><div class="promo-modal">Try our summer sale</div>',
  );
  const candidates = collectCandidates(d);
  assert.deepEqual(
    candidates.map((c) => c.selector),
    ["div.ad-slot", "div.cookie-banner", "div.promo-modal"],
  );
  assert.ok(!JSON.stringify(candidates).includes("hello@example.com"));
  assert.ok(!JSON.stringify(candidates).includes("secret"));
});

test("same selector matching a useful container blocks entire selector", () => {
  const d = doc('<div class="ad-slot">Ad</div><div class="ad-slot"><h1>Important</h1></div>');
  assert.deepEqual(matchingElements(d, "div.ad-slot"), []);
  assert.deepEqual(matchingElements(d, "body"), []);
  assert.deepEqual(matchingElements(d, "div.ad-slot,main"), []);
});

test("hiding is reversible, catches late inserts and refuses newly protected matches", () => {
  const d = article();
  const cleaner = createCleaner(d);
  const rules = [{ selector: "div.ad-banner", category: "ad" as const, enabled: true }];
  const ad = d.querySelector(".ad-banner")!;
  ad.setAttribute("style", "color: red");
  assert.equal(cleaner.apply(rules), 1);
  assert.match(ad.outerHTML, /data-unclutter-/);
  const late = d.createElement("div");
  late.className = "ad-banner";
  d.body.append(late);
  assert.equal(cleaner.apply(rules), 2);
  late.innerHTML = "<form><input /></form>";
  assert.equal(cleaner.apply(rules), 0);
  assert.doesNotMatch(ad.outerHTML, /data-unclutter-/);
  late.remove();
  cleaner.apply(rules);
  cleaner.restore();
  assert.equal((ad as HTMLElement).style.color, "red");
  assert.equal((ad as HTMLElement).style.display, "");
  assert.doesNotMatch(d.documentElement.outerHTML, /data-unclutter-/);
});

test("ad units survive the candidate cap without hiding recipe content", () => {
  const early = Array.from(
    { length: 65 },
    (_, i) => `<div id="social-widget-${i}">Share</div>`,
  ).join("");
  const ids = Array.from({ length: 8 }, (_, i) => `mm-ads-sc-sticky-square-ad_${i + 1}-0`);
  const slots = ids
    .map((id) => `<div id="${id}" class="comp mm-ads-gpt-adunit">Advertisement</div>`)
    .join("");
  const d = doc(
    `${early}<script id="ad-unit-settings" type="application/json">{"account":"private-user-value"}</script><style id="ad-unit-styles">body { color: red; }</style>${slots}<div id="footer-slot" class="gpt-ad-unit">Advertisement</div><main><article><h1>Lasagna</h1><p>Keep the recipe.</p></article><section id="recipe-content" class="mm-ads-gpt-adunit"><form><input /></form></section></main>`,
  );
  const candidates = collectCandidates(d);
  const selectors = candidates.map((candidate) => candidate.selector);
  assert.equal(candidates.length, 60);
  for (const id of [...ids, "footer-slot"]) assert.ok(selectors.includes(`div#${id}`), id);
  assert.ok(!selectors.some((selector) => selector.includes("recipe-content")));
  assert.ok(!candidates.some((candidate) => ["script", "style"].includes(candidate.tag)));
  assert.ok(!JSON.stringify(candidates).includes("private-user-value"));
  const rules = candidates
    .filter((candidate) => [...ids, "footer-slot"].some((id) => candidate.selector === `div#${id}`))
    .map((candidate) => ({ selector: candidate.selector, category: "ad" as const, enabled: true }));
  const cleaner = createCleaner(d);
  assert.equal(cleaner.apply(rules), 9);
  assert.equal(d.querySelector("article")?.textContent, "LasagnaKeep the recipe.");
  assert.ok(!d.querySelector("#recipe-content")?.hasAttribute("style"));
  cleaner.restore();
  for (const id of [...ids, "footer-slot"])
    assert.equal((d.getElementById(id) as HTMLElement).style.display, "");
});

test("ad bootstrap code is not mistaken for protected editorial text", () => {
  const code = "private-ad-bootstrap-value sign in to continue ".repeat(250);
  const d = doc(`<main><article><h1>Recipe</h1><p>${"real article ".repeat(200)}</p></article>
    <div id="ad-unit-lazy">Advertisement<script>${code}</script><style>/*${code}*/</style><noscript>${code}</noscript><template>${code}</template><iframe></iframe></div>
    <div id="ad-unit-paragraph"><p>Advertisement<script>${code}</script></p></div>
    <div id="ad-unit-long">${"editorial text ".repeat(200)}</div>
    <div id="ad-unit-security">Sign in to continue<script>${code}</script></div>
    <div id="ad-unit-form"><form><input /></form><script>${code}</script></div></main>`);
  const candidates = collectCandidates(d);
  assert.deepEqual(
    candidates.map((c) => c.selector),
    ["div#ad-unit-lazy", "div#ad-unit-paragraph"],
  );
  assert.ok(!JSON.stringify(candidates).includes("private-ad-bootstrap-value"));
  const cleaner = createCleaner(d);
  assert.equal(
    cleaner.apply(
      candidates.map((c) => ({ selector: c.selector, category: "ad" as const, enabled: true })),
    ),
    2,
  );
  assert.equal((d.querySelector("article") as HTMLElement).style.display, "");
  cleaner.restore();
  assert.doesNotMatch(d.documentElement.outerHTML, /data-unclutter-/);
});

test("ad-layer rules hide the active JW ad player and restore editorial playback", () => {
  const d = doc(`<main><article><h1>Recipe</h1>
    <div id="video-wrapper"><div class="jwplayer jw-flag-ads" style="display: grid">
      <div class="jw-media"><video></video></div>
      <div id="primary-video-ad" class="jw-ads-view"><iframe></iframe></div>
      <div class="jw-controls"><button>Play</button><span>This ad will end in 17</span></div>
    </div></div></article></main>`);
  const player = d.querySelector(".jwplayer") as HTMLElement;
  const ad = d.getElementById("primary-video-ad") as HTMLElement;
  const cleaner = createCleaner(d);
  const rule = { selector: "div#primary-video-ad", category: "ad" as const, enabled: true };
  assert.equal(cleaner.apply([rule]), 1);
  assert.equal(player.style.display, "none");
  player.classList.remove("jw-flag-ads");
  cleaner.apply([rule]);
  assert.equal(player.style.display, "grid");
  assert.equal(ad.style.display, "none");
  player.classList.add("jw-flag-ads");
  cleaner.apply([{ ...rule, category: "social" }]);
  assert.equal(player.style.display, "grid");
  cleaner.apply([{ ...rule, enabled: false }]);
  assert.equal(ad.style.display, "");
  const form = d.createElement("form");
  form.innerHTML = "<input />";
  player.append(form);
  cleaner.apply([rule]);
  assert.equal(player.style.display, "grid");
  form.remove();
  cleaner.apply([rule]);
  assert.equal(player.style.display, "none");
  cleaner.restore();
  assert.equal(player.style.display, "grid");
  assert.equal(ad.style.display, "");
  assert.doesNotMatch(d.documentElement.outerHTML, /data-unclutter-/);
});

test("Jev requests use bounded typed choices, no full URL or selector instructions", () => {
  const d = article();
  const candidates = collectCandidates(d);
  const request = evaluationRequest({
    context: pageContext(d, "https://www.bbc.com/news/article"),
    url: "https://www.bbc.com/news/article?token=private",
    candidates,
  });
  assert.ok(!JSON.stringify(request).includes("token=private"));
  assert.ok(!JSON.stringify(request).includes("Editorial content stays"));
  assert.equal(Object.keys(request.questions).length, candidates.length);
});

test("Jev validation rejects incomplete, invalid and nonfinite results; uncertain keeps content", () => {
  const candidates = collectCandidates(article());
  assert.throws(() => rulesFromAnswers({ answers: {} }, candidates));
  assert.throws(() =>
    rulesFromAnswers({ answers: { e0: { type: "choice", choice: "erase" } } }, candidates),
  );
  assert.throws(() =>
    rulesFromAnswers(
      { answers: { e0: { type: "choice", choice: "ad", probabilities: { ad: Infinity } } } },
      candidates,
    ),
  );
  assert.deepEqual(
    rulesFromAnswers({ answers: { e0: { type: "choice", choice: "uncertain" } } }, candidates),
    [],
  );
  assert.deepEqual(
    rulesFromAnswers(
      { answers: { e0: { type: "choice", choice: "ad", probabilities: { ad: 0.7 } } } },
      candidates,
    ),
    [],
  );
  assert.equal(
    rulesFromAnswers(
      {
        answers: { e0: { type: "choice", choice: "ad", probabilities: { ad: 0.99, keep: 0.01 } } },
      },
      candidates,
    ).length,
    1,
  );
});
