# Unclutter for Safari

A Safari decluttering project for Mac, with an iPhone development build. It hides page clutter using reusable, AI-reviewed rules. You supply your own **TypeSafe AI** or **Vercel AI Gateway** key and pay that provider directly. There is no hosted backend or subscription from this project.

This is an independent Safari adaptation of [Kitze’s Unclutter](https://github.com/kitze/unclutter), under the [MIT license](LICENSE). The display name is provisional; permission/name clearance or a distinct name is required before public distribution. This fork is not affiliated with the existing Unclutter desktop utility.

**Status: beta preparation, not a published public beta.** Source checks and local Safari development builds are available. Mac public downloads must pass Developer ID signing, notarization, clean-Mac installation and the [beta release gates](docs/BETA.md). The iPhone build is a separate development target, not a TestFlight or App Store release. Do not distribute development archives as public release builds.

## What it does

- Jev classifies up to 60 bounded element descriptions; validated responses select existing selectors, never generated code.
- Saved rules are reused across matching page templates without another model request. Uncertain answers leave content visible.
- Pause / Resume restores hidden elements. Uncheck a rule to keep its elements visible, or pause an entire website to stop both cleanup and analysis.
- Manual analysis is the default. On page visit is optional and makes paid requests for new eligible templates after provider permission.
- Cookie overlays can be hidden visually; no consent choice is accepted or rejected.

This is visual decluttering, not network-level ad/tracker blocking. It does not bypass paywalls. Cross-origin iframe contents, shadow DOM and some dynamic layouts may be missed. [Privacy and limitations](PRIVACY.md).

## Install a public beta

A public beta has **not been released yet**. When the release gates are complete, obtain the versioned, notarized ZIP and SHA-256 file from [GitHub Releases](https://github.com/Griff2325/unclutter/releases), verify its checksum, move `Unclutter.app` to Applications, and open it once. Keep only one installed app copy.

1. In Safari → Settings → Extensions, enable Unclutter and allow access to a public website you want to clean. Public releases should not require unsigned extensions or Xcode.
2. Open the toolbar popup → Connection, select your provider, and save its matching API key. Saving is local; it does not verify credit or API access.
3. Read the provider disclosure and explicitly allow snippet processing. Saving a key or changing consent returns to Manual mode. Gateway requests also go to TypeSafe.
4. Click Analyze page once; provider charges apply. Revisit matching pages to reuse the cached rules. Pause restores the page if something useful disappears.

The bundled **Setup & help**, **Privacy**, and **Local demo** pages work without a project account. The demo uses fixed sample rules and makes no API request; it demonstrates reversible hiding, not AI accuracy.

## Build locally

Requires Bun, Node.js 22.12+ and, for the native Mac app, full Xcode 27+ with `safari-web-extension-packager`. The app targets macOS 13+. Direct-download notarized web extensions require Safari 18.4+; the current live development checks used Safari 26.6/macOS 26.6, so older configurations remain release-test work.

```sh
bun install --frozen-lockfile
bun run check
bun run build:safari
bun run safari:app
```

The default native app in `.output/safari-app/Unclutter.app` is an **ad-hoc development build**. To run it, enable Safari’s developer features and Allow unsigned extensions. Safari resets that switch on quit. This is not suitable for public users.

For local use with an existing valid Apple Development certificate, supply its fingerprint and team ID:

```sh
SAFARI_SIGNING_IDENTITY="CERTIFICATE_FINGERPRINT" \
SAFARI_DEVELOPMENT_TEAM="YOURTEAMID" bun run safari:app
```

That build can run with unsigned extensions off. Replace the existing app at the same path; retain its bundle IDs and developer team. Moving from ad-hoc to certificate signing changes Safari’s identity and may require one-time key/permission/template setup again. Rebuilds must keep using the signing variables to retain certificate signing.

For public release packaging, see [RELEASING](docs/RELEASING.md). `bun run safari:release` requires Developer ID credentials and an existing notarytool profile, submits to Apple, and emits a versioned, stapled ZIP/checksum only after verification. Do not run submission or publish until the release gates are cleared.

## iPhone development build

Use [the iPhone setup guide](docs/IOS.md) to build an iOS containing app with the same Safari extension and BYOK controls:

```sh
bun run ios:app     # unsigned iPhone simulator build
bun run ios:device  # unsigned physical-device compile check; not installable
```

For your own iPhone, the app and extension need Apple Development signing and provisioning for that device. Apple requires Developer Program membership for Safari extension device tests. After installation, enable Unclutter in Settings → Apps → Safari → Extensions, allow access to a website, and configure your key and consent in Safari’s extension popup. Mac settings, keys and cached rules do not sync to the phone. See the guide for the explicit signed-build command and recorded test limits. Sharing an iPhone beta later requires a separate distribution path such as TestFlight; the Mac ZIP is not an iPhone installer.

## How the fork differs

Safari macOS/iOS app packaging and signing workflows; direct TypeSafe provider support; safer candidate prioritization and active video-ad shell hiding; explicit provider consent and per-site pause; safer provider switching; bundled setup/privacy/demo; automated regression and release-validation checks. The upstream page-template architecture and original work remain credited to Kitze.

`lib/page-context.ts` groups exact origins, page kinds, normalized route families and main-shell markers. `lib/dom.ts` collects candidates and applies reversible rules. `lib/jev.ts` constructs typed requests and validates answers. The background owns keys, consent, cache and paid requests; content scripts receive cleanup state, never credentials. The popup handles permissions and controls. No telemetry or server is added.

## Testing and contributing

`bun run check` runs type, lint, format and automated tests without an API key. CI additionally compiles the Safari web extension. Synthetic background tests exercise provider consent, paused origins, credential switching, request-time revocation and sender checks. Release checks reject development signatures, absent secure timestamps and debug entitlements.

Optional live provider smoke: set **one** provider family in your local environment (`JEV_KEY` / `TYPESAFE_API_KEY` for TypeSafe, or `AI_GATEWAY_API_KEY` for Gateway) and run `bun scripts/smoke-jev.ts`. It sends synthetic inputs, uses your key and incurs a provider charge. Never commit keys or pass them as command-line arguments. Use live tests only with explicit authorization and a budget.

Please report reproducible bugs through [Issues](https://github.com/Griff2325/unclutter/issues). Include versions, public site if applicable, expected behavior and whether Pause restored it. Omit private URLs, keys and personal screenshots. See [security reporting](SECURITY.md). There are no verified user-adoption or classification-accuracy claims yet; the [test matrix](docs/TESTING.md) records the remaining work.

Upstream Chromium/Firefox development targets remain in source for compatibility. Public-beta preparation remains scoped to macOS; iPhone support is a separate development preview until its device and distribution checks are complete.
