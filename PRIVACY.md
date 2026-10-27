# Privacy — Unclutter for Safari beta

Effective October 26, 2026. This independent client-only fork has no project-operated backend, analytics or telemetry. The bundled Privacy page is the in-app version of this policy.

## Local storage

Safari extension storage holds the selected provider, API key, permission state, paused exact website origins, cached page-template rules and attempt/error metadata. It is local, not synced between Mac and iPhone. The extension does not separately encrypt the key or store it in Keychain. Protect access to your device; revoke compromised credentials through the provider.

## Requests and costs

Saving a key is not consent to send page data. An explicit permission box is required for the selected provider; changing that permission returns to Manual mode. Manual sends only on Analyze/Re-analyze. On page visit additionally authorizes paid requests for new eligible visible templates. Cached templates apply locally. Provider spending controls are recommended for automatic mode.

The request contains page kind and up to 60 short element descriptions (tag, structural signals, text, position, count). Main-content containers and form controls are skipped. Email-like and long numeric strings are redacted. Full page URLs, titles, cookies and raw HTML are not included in the model request. Snippets may still contain names or private page text: redaction is not guaranteed anonymization. Avoid sensitive pages.

TypeSafe mode sends directly to `api.typesafe.ai`. Gateway mode sends to `ai-gateway.vercel.sh`, which routes Jev evaluation to TypeSafe. Your selected service receives its API credential and normal connection metadata, including your IP address. The project developer receives neither these requests nor the key.

Provider retention, processing and deletion depend on your provider account and agreements. Review [TypeSafe’s privacy policy](https://typesafe.ai/legal/privacy-policy), [Vercel’s privacy policy](https://vercel.com/legal/privacy-policy), and your service terms. This project does not promise provider-side zero retention or control their records.

## Stop requests or remove data

- Uncheck provider permission to stop future requests and return to Manual. Previously sent or in-flight data cannot be recalled.
- Pause this website to stop both analysis and cached cleanup on its exact origin; Safari website access controls can also revoke access.
- Remove saved key deletes the local key and returns to Manual, retaining cached rules. Revoke the actual credential through your provider if needed.
- Forget this page type deletes that template’s rules. Local records persist until removed; uninstalling the app alone may not clear Safari extension/website data. Use Safari’s data-management controls to remove remaining stored extension data.
- Request provider-side deletion from the relevant provider; local deletion cannot erase their records.

GitHub issues are public and governed by GitHub’s policy. Do not include private URLs, keys or personal screenshots. Follow [SECURITY](SECURITY.md) for sensitive reports. Material changes to sharing destinations or purpose require updated disclosure and permission before requests are allowed.
