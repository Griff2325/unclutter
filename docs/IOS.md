# iPhone Safari development

The iOS containing app embeds the same compiled `.output/safari-mv3` extension as the Mac package. The native app provides setup guidance; API keys and provider consent belong in the Safari extension popup. There is no native API-key form.

Requires macOS, full Xcode 27+ with its iOS SDK and simulator runtime, Bun and Node.js 22.12+. The deployment target is iOS 18; current compile checks use Xcode 27.1 and the iOS 27 SDK. Earlier supported iOS versions still need runtime testing.

## Build for the simulator

```sh
bun install --frozen-lockfile
bun run ios:app
```

This generates `.output/ios-xcode/Unclutter/Unclutter.xcodeproj` and builds `.output/ios-simulator-app/Unclutter.app` for a generic iOS Simulator. It does not install or launch anything. To run locally, open that project in Xcode, select an available iPhone simulator and choose Product → Run. Alternatively, after booting your chosen simulator:

```sh
xcrun simctl install booted .output/ios-simulator-app/Unclutter.app
xcrun simctl launch booted io.github.Griff2325.Unclutter
```

Use `IOS_OUTPUT_ROOT=/absolute/scratch/path bun run ios:app` to isolate generated products. All generated names begin with `ios-`; Mac packaging outputs remain separate. The script rejects paths that resolve into the existing Mac output directories, including symlink aliases.

## Physical-device compile and signing

```sh
bun run ios:device
```

This is an **unsigned compile check** for generic iOS, producing `.output/ios-device-app/Unclutter.app`. That artifact cannot be installed on an iPhone.

For an explicitly signed build with an existing Apple Development certificate and installed provisioning profiles:

```sh
IOS_SIGN=1 \
SAFARI_DEVELOPMENT_TEAM="YOURTEAMID" \
SAFARI_SIGNING_IDENTITY="CERTIFICATE_FINGERPRINT" \
bun run ios:device
```

The script does not request provisioning updates, register devices, install, launch, archive or upload. Missing profiles cause the build to fail. Configure both app and extension signing in Xcode as needed. Stable bundle IDs are `io.github.Griff2325.Unclutter` and `io.github.Griff2325.Unclutter.Extension`; keep them and the same developer team for updates.

Apple’s [device testing instructions](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension) require Apple Developer Program membership for Safari web extension device tests; simulators can be used before joining. A signed physical-device app also needs suitable provisioning for both targets and the test device. Device installation and paid provider calls require their own authorization. TestFlight/App Store distribution is separate work with signing, App Store Connect setup, review and release approval still pending. A simulator build or unsigned device compile is not a distributable beta.

## Enable and use

1. Install and run the containing app on your selected simulator or authorized device.
2. In Safari, use Page Menu → Manage Extensions to enable Unclutter. Alternatively use Settings → Apps → Safari → Extensions. Menu names can vary by iOS release.
3. Allow website access for the site you want to clean. Open Unclutter from Safari’s Page Menu.
4. Under Connection, choose TypeSafe AI or Vercel AI Gateway and save your matching key. Review Privacy and explicitly allow snippet processing before Analyze page; provider charges apply. Saving a key alone does not verify credit or API access.
5. Use Setup & help, Privacy and Local demo from the popup. The demo makes no API call. Pause restores hidden content.

Compile validation checks the embedded manifest, popup, background worker, upstream LICENSE and bundled help/privacy/demo files; both bundle IDs, versions, minimum iOS and platform; and the Safari extension point. Runtime testing must still confirm Safari enablement, website permissions, popup usability, consent, reversible cleanup and updates on a real iPhone. No device or provider behavior is claimed from a compile check.

Apple reference: [Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).
