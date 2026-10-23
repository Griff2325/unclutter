import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "darwin", "Safari app packaging requires macOS and full Xcode.");
const root = fileURLToPath(new URL("../", import.meta.url));
const extension = join(root, ".output/safari-mv3");
const project = join(root, ".output/safari-xcode/Unclutter");
const products = join(root, ".output/safari-app");
const manifest = JSON.parse(readFileSync(join(extension, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3, "Run bun run build:safari first.");
assert.ok(manifest.background?.service_worker, "Safari requires the background worker.");
assert.ok(existsSync(join(extension, manifest.action.default_popup)), "Missing popup build.");
assert.equal(
  readFileSync(join(extension, "LICENSE"), "utf8"),
  readFileSync(join(root, "LICENSE"), "utf8"),
  "The packaged extension must include the upstream MIT license.",
);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Regenerate only ignored build output; keep Apple's native Settings integration.
run("xcrun", [
  "safari-web-extension-packager",
  extension,
  "--project-location",
  join(root, ".output/safari-xcode"),
  "--app-name",
  "Unclutter",
  "--bundle-identifier",
  "io.github.Griff2325.Unclutter",
  "--macos-only",
  "--swift",
  "--copy-resources",
  "--no-open",
  "--no-prompt",
  "--force",
]);
const main = join(project, "Unclutter/Resources/Base.lproj/Main.html");
const html = readFileSync(main, "utf8");
assert.ok(
  html.includes("</body>"),
  "Unexpected Xcode app template; installation guidance was not added.",
);
writeFileSync(
  main,
  html.replace('width="128" height="128"', 'width="48" height="48"').replace(
    "</body>",
    `<p>Local development build: in Safari Settings → Advanced, enable “Show features for web developers”.
Then enable Safari Settings → Developer → Allow unsigned extensions. Enable Unclutter in Safari Settings → Extensions and allow website access.</p>
<p>Safari resets the unsigned-extension setting when it quits. Refresh website tabs after enabling Unclutter.</p>
</body>`,
  ),
);

const style = join(project, "Unclutter/Resources/Style.css");
writeFileSync(
  style,
  `${readFileSync(style, "utf8")}\nbody { box-sizing: border-box; height: auto; min-height: 100%; padding: 16px 0; gap: 10px; }\np { margin: 0; }\n`,
);

run("xcodebuild", [
  "-quiet",
  "-project",
  join(project, "Unclutter.xcodeproj"),
  "-scheme",
  "Unclutter",
  "-configuration",
  "Release",
  "-destination",
  "generic/platform=macOS",
  "-derivedDataPath",
  join(root, ".output/safari-derived-data"),
  `CONFIGURATION_BUILD_DIR=${products}`,
  "MACOSX_DEPLOYMENT_TARGET=13.0",
  "CODE_SIGN_STYLE=Manual",
  "CODE_SIGN_IDENTITY=-",
  "DEVELOPMENT_TEAM=",
  "ENABLE_OUTGOING_NETWORK_CONNECTIONS=YES",
  "build",
]);
const app = join(products, "Unclutter.app");
const appex = join(app, "Contents/PlugIns/Unclutter Extension.appex");
assert.ok(existsSync(appex), "Build did not produce the Safari extension app.");
run("codesign", ["--verify", "--deep", "--strict", app]);
const entitlements = spawnSync("codesign", ["-d", "--entitlements", "-", "--xml", appex], {
  encoding: "utf8",
});
assert.equal(entitlements.status, 0, "Cannot inspect extension signing entitlements.");
assert.match(
  entitlements.stdout,
  /<key>com\.apple\.security\.network\.client<\/key>\s*<true\s*\/>/,
  "Extension requires outgoing network access.",
);
console.log(
  `\nBuilt ${app}\nOpen the app for Safari setup instructions. This is a locally signed development build, not a notarized release.`,
);
