import assert from "node:assert/strict";

export function checkReleaseSignature(signature) {
  assert.match(
    signature,
    /^Authority=Developer ID Application:/m,
    "Release requires a Developer ID Application signature.",
  );
  assert.match(signature, /^Timestamp=.+/m, "Release signatures require a secure timestamp.");
}

export function checkReleaseEntitlements(entitlements) {
  assert.doesNotMatch(
    entitlements,
    /<key>com\.apple\.security\.get-task-allow<\/key>\s*<true\s*\/>/,
    "Release must not enable get-task-allow.",
  );
}
