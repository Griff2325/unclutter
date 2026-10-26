import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkReleaseSignature, checkReleaseEntitlements } from "./safari-release-checks.mjs";

assert.equal(process.platform, "darwin", "Safari app packaging requires macOS and full Xcode.");
const root = fileURLToPath(new URL("../", import.meta.url));
const extension = join(root, ".output/safari-mv3");
const output = process.env.SAFARI_OUTPUT_ROOT || join(root, ".output");
const project = join(output, "safari-xcode/Unclutter");
const products = join(output, "safari-app");
const release = process.env.SAFARI_RELEASE === "1";
const signingIdentity = process.env.SAFARI_SIGNING_IDENTITY?.trim() || "-";
const team = process.env.SAFARI_DEVELOPMENT_TEAM?.trim() || "";
const signed = signingIdentity !== "-";
if (release)
  assert.match(
    signingIdentity,
    /^[A-Fa-f0-9]{40}$/,
    "Release requires a Developer ID Application certificate fingerprint.",
  );
assert.ok(
  signed ? /^[A-Z0-9]{10}$/.test(team) : !team,
  "Set both SAFARI_SIGNING_IDENTITY and a 10-character SAFARI_DEVELOPMENT_TEAM, or neither.",
);
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
  join(output, "safari-xcode"),
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
    signed
      ? `<p>Enable Unclutter in Safari Settings → Extensions and allow access to the websites you want to clean. Refresh open tabs.</p>
<p>Open the extension popup and add your own Vercel AI Gateway or TypeSafe AI API key under Connection. Analysis sends page snippets to your chosen provider and may incur charges; review the privacy information in the popup before proceeding.</p>
</body>`
      : `<p>Local development build: in Safari Settings → Advanced, enable “Show features for web developers”.
Then enable Safari Settings → Developer → Allow unsigned extensions. Enable Unclutter in Safari Settings → Extensions and allow website access.</p>
<p>Safari resets the unsigned-extension setting when it quits. Refresh website tabs after enabling Unclutter.</p>
<p>Open the extension popup and add your own Vercel AI Gateway or TypeSafe AI API key under Connection. Analysis sends page snippets to your chosen provider and may incur charges; review the privacy information in the popup before proceeding.</p>
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
  join(output, "safari-derived-data"),
  `CONFIGURATION_BUILD_DIR=${products}`,
  "MACOSX_DEPLOYMENT_TARGET=13.0",
  "CODE_SIGN_STYLE=Manual",
  `CODE_SIGN_IDENTITY=${signingIdentity}`,
  `DEVELOPMENT_TEAM=${team}`,
  "ENABLE_OUTGOING_NETWORK_CONNECTIONS=YES",
  `MARKETING_VERSION=${manifest.version}`,
  ...(release
    ? [
        "ARCHS=arm64 x86_64",
        "ONLY_ACTIVE_ARCH=NO",
        "ENABLE_HARDENED_RUNTIME=YES",
        "OTHER_CODE_SIGN_FLAGS=--timestamp",
      ]
    : []),
  "build",
]);
const app = join(products, "Unclutter.app");
const appex = join(app, "Contents/PlugIns/Unclutter Extension.appex");
assert.ok(existsSync(appex), "Build did not produce the Safari extension app.");
run("codesign", ["--verify", "--deep", "--strict", app]);
if (signed) {
  for (const bundle of [app, appex]) {
    const signature = spawnSync("codesign", ["-dvvv", bundle], { encoding: "utf8" });
    assert.equal(signature.status, 0, "Cannot inspect signing identity.");
    assert.ok(
      signature.stderr.split("\n").includes(`TeamIdentifier=${team}`),
      "The app and extension must both be signed by the requested developer team.",
    );
    assert.ok(!signature.stderr.includes("Signature=adhoc"), "Expected certificate signing.");
    if (release) {
      checkReleaseSignature(signature.stderr);
      const bundleEntitlements = spawnSync(
        "codesign",
        ["-d", "--entitlements", "-", "--xml", bundle],
        { encoding: "utf8" },
      );
      assert.equal(bundleEntitlements.status, 0, "Cannot inspect signing entitlements.");
      checkReleaseEntitlements(bundleEntitlements.stdout);
    }
  }
}

const entitlements = spawnSync("codesign", ["-d", "--entitlements", "-", "--xml", appex], {
  encoding: "utf8",
});
assert.equal(entitlements.status, 0, "Cannot inspect extension signing entitlements.");
assert.match(
  entitlements.stdout,
  /<key>com\.apple\.security\.network\.client<\/key>\s*<true\s*\/>/,
  "Extension requires outgoing network access.",
);
if (release) {
  for (const bundle of [app, appex]) {
    const executable = spawnSync(
      "plutil",
      ["-extract", "CFBundleExecutable", "raw", "-o", "-", join(bundle, "Contents/Info.plist")],
      { encoding: "utf8" },
    );
    assert.equal(executable.status, 0, "Cannot inspect bundle executable.");
    const architectures = spawnSync(
      "lipo",
      ["-archs", join(bundle, "Contents/MacOS", executable.stdout.trim())],
      { encoding: "utf8" },
    );
    assert.equal(architectures.status, 0, "Cannot inspect binary architectures.");
    assert.deepEqual(
      new Set(architectures.stdout.trim().split(/\s+/)),
      new Set(["arm64", "x86_64"]),
      "Release must be universal.",
    );
  }
}
console.log(
  `\nBuilt ${app}\n${signed ? "Signed with your developer identity." : "Ad-hoc signed: Safari's unsigned-extension setting resets when it quits."} Open the app for Safari setup instructions. This is not a notarized release.`,
);
