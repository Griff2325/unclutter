# Beta validation matrix

No keys, private pages or paid provider calls are required for `bun run check`. Fixtures cover reversible hiding, protected content, scripts inside ad slots, late inserts, cookie controls, API validation, provider routing, consent and signing gates. The demo is synthetic and does not evaluate AI accuracy.

## Clean-install checks — pending

Use the final downloaded/notarized ZIP on a Mac without the source checkout. Keep unsigned extensions off. Verify checksum, Gatekeeper, app discovery, one installed copy, enablement, per-site access, key setup, provider permission, manual analysis, pause/restore, cached revisit, browser restart, same-team upgrade and uninstall/data removal. Test Apple silicon and Intel; record OS and Safari versions. Direct-download web extensions require Safari 18.4+; the project targets macOS 13+ but only current 26.6 development behavior has been observed so far.

## Website cases — pending live beta testing

Use 15–20 public pages spanning recipes, news, reference material, shopping, forums and SPA navigation, including uncluttered negative cases. Suggested starting cases: Allrecipes recipe, BBC article, Wikipedia article, an Apple product page, a GitHub issue and a forum discussion. Do not use account/banking/medical pages.

For every case record URL without private query values, versions, first-load candidate count, missed clutter, useful content hidden, consent/form/video behavior, analysis duration, provider usage/cost from the provider dashboard, cached revisit behavior and whether Pause restores the page. Report zero-rule results and provider errors too. Do not fabricate aggregate accuracy from a few demonstrations.

## Live request authorization

Obtain the key owner’s explicit permission and a spending limit before agent-run requests. State what synthetic/public data goes to which provider. Never read a user’s browser key, commit it or print it. Existing user API keys and credit balances are not authorization for new tests. Test both successful and failure paths without repeatedly billing retries.

## Independent tester feedback — pending

Aim for five people outside the development session. Ask each to install using only the README, try the local demo, configure their own provider, clean a public page, recover from an incorrect removal and restart Safari. Record assistance needed and issues before deciding whether to publish.
