import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReleaseEntitlements, checkReleaseSignature } from "./safari-release-checks.mjs";

test("release requires a timestamped Developer ID signature", () => {
  assert.doesNotThrow(() =>
    checkReleaseSignature("Authority=Developer ID Application: Example\nTimestamp=Oct 26, 2026"),
  );
  assert.throws(() =>
    checkReleaseSignature("Authority=Apple Development: Example\nTimestamp=Oct 26, 2026"),
  );
  assert.throws(() =>
    checkReleaseSignature("Authority=Developer ID Application: Example\nSigned Time=Oct 26, 2026"),
  );
});

test("release rejects debugging entitlement", () => {
  assert.doesNotThrow(() =>
    checkReleaseEntitlements("<dict><key>com.apple.security.get-task-allow</key><false/></dict>"),
  );
  assert.throws(() =>
    checkReleaseEntitlements("<dict><key>com.apple.security.get-task-allow</key><true /></dict>"),
  );
});
