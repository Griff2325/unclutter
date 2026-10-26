import { createCleaner } from "../../lib/dom";
import type { Rule } from "../../lib/model";
const cleaner = createCleaner(document);
const rules: Rule[] = [
  { selector: "aside.demo-ad", category: "ad", enabled: true },
  { selector: "div.demo-newsletter", category: "newsletter", enabled: true },
];
const clean = document.querySelector<HTMLButtonElement>("#clean")!;
const restore = document.querySelector<HTMLButtonElement>("#restore")!;
const result = document.querySelector<HTMLParagraphElement>("#result")!;
clean.addEventListener("click", () => {
  const count = cleaner.apply(rules);
  result.textContent = `${count} sample elements hidden. Recipe content stays visible.`;
  clean.disabled = true;
  restore.disabled = false;
});
restore.addEventListener("click", () => {
  cleaner.restore();
  result.textContent = "Sample content restored.";
  clean.disabled = false;
  restore.disabled = true;
});
