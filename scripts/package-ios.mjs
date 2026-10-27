import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "darwin", "iOS packaging requires macOS and full Xcode.");
const root = fileURLToPath(new URL("../", import.meta.url));
const extension = join(root, ".output/safari-mv3");
const output = resolve(process.env.IOS_OUTPUT_ROOT || join(root, ".output"));
const project = join(output, "ios-xcode/Unclutter");
const device = process.env.IOS_DEVICE_BUILD === "1";
const signed = process.env.IOS_SIGN === "1";
const team = process.env.SAFARI_DEVELOPMENT_TEAM?.trim() || "";
assert.ok(
  !signed || (device && /^[A-Z0-9]{10}$/.test(team)),
  "IOS_SIGN=1 requires IOS_DEVICE_BUILD=1 and a 10-character SAFARI_DEVELOPMENT_TEAM.",
);
const products = join(output, device ? "ios-device-app" : "ios-simulator-app");
// Resolve existing ancestors so an output symlink cannot overwrite the Mac project.
function canonical(path) {
  return existsSync(path)
    ? realpathSync(path)
    : join(canonical(resolve(path, "..")), path.split("/").at(-1));
}
for (const path of [project, products, join(output, "ios-derived-data")]) {
  assert.ok(
    canonical(path) !== canonical(extension) &&
      !canonical(path).startsWith(`${canonical(extension)}/`),
    "iOS outputs must not overlap the compiled extension input.",
  );
  assert.ok(
    !canonical(path)
      .split("/")
      .some((part) => /^safari-(?:xcode|app|derived-data)$/.test(part)),
    "iOS outputs must not overlap the Mac Safari outputs.",
  );
}
const manifest = JSON.parse(readFileSync(join(extension, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3, "Run bun run build:safari first.");
assert.ok(manifest.background?.service_worker, "Missing background worker.");
const resources = [
  "manifest.json",
  "LICENSE",
  "help.html",
  "privacy.html",
  "demo.html",
  manifest.action?.default_popup,
  manifest.background.service_worker,
];
for (const resource of resources)
  assert.ok(
    resource && existsSync(join(extension, resource)),
    `Missing extension resource: ${resource}`,
  );
assert.equal(
  readFileSync(join(extension, "LICENSE"), "utf8"),
  readFileSync(join(root, "LICENSE"), "utf8"),
);
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    ...(capture ? { encoding: "utf8" } : { stdio: "inherit" }),
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed${capture ? `: ${result.stderr}` : "."}`);
  return result.stdout;
}
run("xcrun", [
  "safari-web-extension-packager",
  extension,
  "--project-location",
  join(output, "ios-xcode"),
  "--app-name",
  "Unclutter",
  "--bundle-identifier",
  "io.github.Griff2325.Unclutter",
  "--ios-only",
  "--swift",
  "--copy-resources",
  "--no-open",
  "--no-prompt",
  "--force",
]);
const main = join(project, "Unclutter/Resources/Base.lproj/Main.html");
const html = readFileSync(main, "utf8");
assert.ok(html.includes("</body>"), "Unexpected iOS template.");
writeFileSync(
  main,
  html.replace('width="128" height="128"', 'width="64" height="64"').replace(
    "</body>",
    `<p>In Safari, open the Page Menu → Manage Extensions and enable Unclutter. You can also use Settings → Apps → Safari → Extensions.</p>
<p>Allow access to a website, then open Unclutter from Safari’s Page Menu. Under Connection, choose your provider and save your own API key. Keys are configured in the Safari popup, not this app.</p>
<p>Review the popup’s privacy information and allow snippet processing before Analyze page. Your provider may charge for analysis. Setup &amp; help, Privacy and Local demo are available in the popup; the demo makes no API request.</p>
</body>`,
  ),
);
const style = join(project, "Unclutter/Resources/Style.css");
writeFileSync(
  style,
  `${readFileSync(style, "utf8")}\nbody { box-sizing: border-box; height: auto; min-height: 100%; padding: 24px 0; gap: 16px; }\np { margin: 0; }\n`,
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
  device ? "generic/platform=iOS" : "generic/platform=iOS Simulator",
  "-derivedDataPath",
  join(output, "ios-derived-data"),
  `CONFIGURATION_BUILD_DIR=${products}`,
  "IPHONEOS_DEPLOYMENT_TARGET=18.0",
  `MARKETING_VERSION=${manifest.version}`,
  "CURRENT_PROJECT_VERSION=1",
  ...(signed
    ? [
        "CODE_SIGN_STYLE=Automatic",
        `DEVELOPMENT_TEAM=${team}`,
        "CODE_SIGN_IDENTITY=Apple Development",
      ]
    : ["CODE_SIGNING_ALLOWED=NO"]),
  "build",
]);
const app = join(products, "Unclutter.app");
const appex = join(app, "PlugIns/Unclutter Extension.appex");
function plist(bundle, key) {
  return run(
    "plutil",
    ["-extract", key, "raw", "-o", "-", join(bundle, "Info.plist")],
    true,
  ).trim();
}
for (const [bundle, id] of [
  [app, "io.github.Griff2325.Unclutter"],
  [appex, "io.github.Griff2325.Unclutter.Extension"],
]) {
  assert.equal(plist(bundle, "CFBundleIdentifier"), id);
  assert.equal(plist(bundle, "CFBundleShortVersionString"), manifest.version);
  assert.equal(plist(bundle, "CFBundleVersion"), "1");
  assert.equal(plist(bundle, "MinimumOSVersion"), "18.0");
  assert.equal(plist(bundle, "DTPlatformName"), device ? "iphoneos" : "iphonesimulator");
}
assert.equal(
  plist(appex, "NSExtension.NSExtensionPointIdentifier"),
  "com.apple.Safari.web-extension",
);
for (const resource of resources)
  assert.equal(
    readFileSync(join(appex, resource), "utf8"),
    readFileSync(join(extension, resource), "utf8"),
    `Packaged resource mismatch: ${resource}`,
  );
if (signed) {
  run("codesign", ["--verify", "--deep", "--strict", app]);
  for (const bundle of [app, appex]) {
    const signature = spawnSync("codesign", ["-dvvv", bundle], { encoding: "utf8" });
    assert.equal(signature.status, 0, "Cannot inspect iOS signature.");
    assert.ok(signature.stderr.split("\n").includes(`TeamIdentifier=${team}`));
    assert.match(signature.stderr, /^Authority=Apple Development:/m);
  }
}
console.log(
  `\nBuilt ${app}\n${signed ? "Signed device build; installation is a separate step." : device ? "Unsigned physical-device compile only; cannot install on an iPhone." : "Unsigned simulator build."} No app was installed, launched or uploaded.`,
);
