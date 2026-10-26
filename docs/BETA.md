# Public-beta queue

Scope: Mac Safari only, users supply their own provider key, no hosted backend, subscription, iPhone release or App Store submission in this batch. Internal bundle IDs and signing team stay stable. Working name: Unclutter for Safari; not legally cleared.

## Ordered work

1. [x] Add provider-consent enforcement, safer credential switching and per-origin pause with mocked-provider regression tests.
2. [x] Add bundled setup/privacy guidance and a no-key, fixed-rule cleanup demo.
3. [x] Prepare versioned universal distribution tooling with Developer ID, secure timestamp, entitlement, notarization, stapling, Gatekeeper and checksum gates.
4. [x] Add CI configuration, focused README, privacy/support guidance and explicit upstream attribution.
5. [x] Complete integrated checks, rendered UI verification, independent review and local native build; record actual results below.
6. [ ] Clear the working name/icon rights or choose distinct branding. MIT code permission does not establish trademark permission; an existing Mac desktop utility also uses Unclutter.
7. [ ] Provide Developer ID Application signing identity and notarytool keychain profile. Do not export private keys or put credentials in this repo. Current personal Apple Development signing is not public distribution signing.
8. [ ] Verify provider-account retention/terms for intended use and finalize privacy wording. GitHub private vulnerability reporting is enabled; review the reporting instructions before launch.
9. [ ] Run the clean-Mac/OS/Intel test matrix and explicitly budgeted live provider cases. Gather feedback from at least five outside testers who install without live coaching. Record all results; do not present planned tests as completed.
10. [ ] Approve Apple submission, notarize/staple/verify the final artifacts, then approve publication. No binary, release tag or public beta announcement has been published by this preparation work.

## Evidence

Verified October 26, 2026:

- `bun run check`: type, lint, format and all 36 offline tests passed; no provider request was made. Tests include consent, stale-popup saves, provider/key changes and pauses during analysis, preserved rules, sender isolation and release checks.
- `bun run build:safari`: production web extension built with manifest version 0.4.0 and bundled help, privacy, demo and upstream MIT license.
- Rendered compiled UI at the actual 380-pixel popup width with synthetic state: first-run setup, saved key without consent, explicit consent, provider switch, error recovery, site pause and unsupported-page guidance. Checked bundled page navigation and the real fixed-rule demo: two elements hide, recipe remains, Restore brings both back. This was a local preview, not an installed-beta Safari integration test.
- Native package built with Xcode using the existing Apple Development identity and stable team/bundle IDs. Both app and extension are version 0.4.0 with Intel and Apple silicon architectures, valid signatures and packaged beta pages/license. Archived separately as `Unclutter-0.4.0-beta.1-development-macOS-universal.zip`; this is not notarized or suitable for public distribution. The existing installed app was preserved; the generated duplicate was unregistered and removed.
- Missing public-release credentials fail preflight before build/upload. An actual signature inspection caught and fixed insufficient `codesign` verbosity so the Developer ID and timestamp gate can read the required fields.
- GitHub private vulnerability reporting was enabled and verified through the repository API; `SECURITY.md` links to the private report form.
- Independent GPT-6-luna review found no blocking issue after the fixes. [GitHub CI passed for implementation commit ce2b070](https://github.com/Griff2325/unclutter/actions/runs/40413217552): frozen dependency installation, all checks/tests and the Safari production build.

Only an Apple Development identity was present; no Developer ID Application identity was found. No Apple submission, public binary, release tag, paid provider request or broad live website test was performed during this preparation.

Source checks are not evidence of classification accuracy across websites. Prior live development tests covered Safari restart enablement, cached cleanup/restoration, one TypeSafe Allrecipes analysis and specific ad misses; they are not broad beta validation.

## Resume/portfolio

Describe this as an independent Safari adaptation of Kitze’s MIT-licensed extension. Show your specific changes, a short demo and architectural decisions. Do not claim original authorship of upstream, unmeasured accuracy, user adoption or App Store approval. Useful later measurements: installation completion, false-positive removals, time to clean, provider cost per new template and cached revisit behavior.
