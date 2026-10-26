import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
assert.equal(process.platform, "darwin", "Safari release requires macOS and full Xcode.");
const identity = process.env.SAFARI_SIGNING_IDENTITY?.trim() || "";
const team = process.env.SAFARI_DEVELOPMENT_TEAM?.trim() || "";
const profile = process.env.SAFARI_NOTARY_PROFILE?.trim() || "";
assert.match(identity, /^[A-Fa-f0-9]{40}$/, "Set SAFARI_SIGNING_IDENTITY to a Developer ID Application certificate fingerprint.");
assert.match(team, /^[A-Z0-9]{10}$/, "Set SAFARI_DEVELOPMENT_TEAM to the certificate's 10-character team ID.");
assert.ok(profile && !profile.startsWith("-"), "Set SAFARI_NOTARY_PROFILE to an existing notarytool keychain profile.");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.match(version, /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/, "Expected a numeric or beta package version.");
const manifest = JSON.parse(readFileSync(join(root, ".output/safari-mv3/manifest.json"), "utf8"));
assert.equal(manifest.version, version.split("-")[0], "Safari manifest version must match the numeric package version.");
const directory = join(root, ".output/releases");
const name = `Unclutter-${version}-macOS-universal.zip`;
const destination = join(directory, name);
const checksum = `${destination}.sha256`;
assert.ok(!existsSync(destination) && !existsSync(checksum), "Release artifacts already exist; move them before building again.");

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed.`);
}

const staging = mkdtempSync(join(tmpdir(), "unclutter-release-"));
try {
  run(process.execPath, [join(root, "scripts/package-safari.mjs")], {
    ...process.env,
    SAFARI_OUTPUT_ROOT: staging,
    SAFARI_RELEASE: "1",
  });
  const app = join(staging, "safari-app/Unclutter.app");
  const submission = join(staging, "submission.zip");
  run("ditto", ["-c", "-k", "--keepParent", app, submission]);
  const notarization = spawnSync("xcrun", ["notarytool", "submit", submission, "--keychain-profile", profile, "--wait", "--output-format", "json"], { cwd: root, encoding: "utf8" });
  if (notarization.error) throw notarization.error;
  assert.equal(notarization.status, 0, `Notarization failed: ${notarization.stderr}`);
  assert.equal(JSON.parse(notarization.stdout).status, "Accepted", "Apple did not accept the notarization submission.");
  run("xcrun", ["stapler", "staple", app]);
  run("xcrun", ["stapler", "validate", app]);
  run("codesign", ["--verify", "--deep", "--strict", app]);
  run("spctl", ["--assess", "--type", "execute", "--verbose", app]);
  const archive = join(staging, name);
  run("ditto", ["-c", "-k", "--keepParent", app, archive]);
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  mkdirSync(directory, { recursive: true });
  copyFileSync(archive, destination, 1);
  writeFileSync(checksum, `${digest}  ${name}\n`, { flag: "wx" });
  console.log(`Release ready: ${destination}\nSHA-256: ${checksum}`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
