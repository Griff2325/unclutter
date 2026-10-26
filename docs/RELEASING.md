# macOS Safari beta releases

The working display name is Unclutter for Safari; branding clearance is pending. The internal app and bundle identifiers remain unchanged. These instructions prepare a direct-download macOS release, not an App Store build. Users supply their own provider API key.

A release requires full Xcode, a valid **Developer ID Application** certificate and private key, its Apple team ID, and an existing `notarytool` keychain profile. Provision these separately; do not put credentials in the repository. The package version is the public artifact version; the Safari manifest uses its numeric base. The release builds both Intel and Apple silicon, signs both bundles, submits for notarization, staples the app, verifies Gatekeeper and the signatures, and writes a ZIP and SHA-256 file to `.output/releases/`. Existing artifacts with the same name are never overwritten.

After installing dependencies and verifying the release version, run:

```sh
SAFARI_SIGNING_IDENTITY="CERTIFICATE_SHA1_FINGERPRINT" \
SAFARI_DEVELOPMENT_TEAM="YOURTEAMID" \
SAFARI_NOTARY_PROFILE="YOUR_KEYCHAIN_PROFILE" bun run safari:release
```

This command submits the build to Apple. Run it only when ready to submit. A successful command prepares local artifacts; it does not publish them. Verify the ZIP checksum and test the downloaded app on a clean Mac with unsigned extensions disabled, including enabling the extension, website permissions, provider setup, privacy consent, and a real analysis using a test key. Confirm branding and release approval before publishing.

For local development, `bun run safari:app` remains available with ad-hoc signing or the existing Apple Development identity and team variables. It does not notarize or produce a release artifact.
