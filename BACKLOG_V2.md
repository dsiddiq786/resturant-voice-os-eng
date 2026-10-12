# Backlog V2

Items deliberately deferred from the premium demo sprint. None of these are implemented on `feature/leed-pizza-premium-demo`.

## Security
- Authentication for `/owner`, `/operations`, `/api/db/*`, and `/api/owner/config` (owner accounts, sessions, roles).
- Advanced security audit, including a rate limit and Origin check on `/api/live`, request size limits on write routes, and PII-safe logging.
- Signature verification for `/api/webhooks/delivery` and enforcement of the platform PAUSED state on the server.
- Upgrade of production dependencies flagged by `npm audit` (postcss, source-map-js, @modelcontextprotocol/sdk, next).
- Regenerate `package-lock.json` so it matches `package.json`, and remove one of the two lockfiles (`bun.lock` or `package-lock.json`).

## Product and platform
- Multi-tenant SaaS model and restaurant owner signup.
- Billing and subscriptions.
- Advanced analytics. The demo shows no statistics on purpose.
- Live transfer to a staff phone line (today the agent only records a callback request).
- SMS confirmations and payment links. The agent is instructed never to claim these were sent.
- Server-side KDS and order persistence (the `orders` table is still unused).
- Unifying the menu source of truth (`menu_matrix.json`, `lib/menuMatrix.ts`, and the database).

## Booking platform integrations (require partner access or credentials)
- OpenTable: partner-gated API. Requires approval as an integration partner and a commercial agreement.
- TouchBistro: partner-only API. Requires applying to the partner program and commercial terms.
- Lightspeed: K-Series reservations API is for approved partners. Requires a Developer Portal account approved by Lightspeed, and a Reservations for Platforms client.
- POS KING: no public API information found during the sprint. Needs vendor documentation or a contact.

## Voice agent
- Harden the confirmation gate (today it keys on the agent's turn ending with a question mark) with an explicit two-step confirm token.
- Live call test with a real human microphone in Chrome and Safari, including noisy rooms and speaker echo.
- Slow tools are handled with a 1.5 s "still checking" reply plus a follow-up turn. Re-evaluate Gemini Live NON_BLOCKING function calls when external booking APIs are added.
- Owner-editable opening hours, phone and policies in Restaurant profile (the prompt already reads `opening_hours`, `phone`, `policies` and `delivery_info` if present).
- Clean up seeded sample calls from the original app.

## Back office
- Rebuild the inner layouts of the floor, kitchen, delivery and owner editor screens natively in the new design system. They are re-themed today, not re-laid-out.
- Responsive audit of the floor plan and kitchen screens below 960 px.
## Technical debt
- Split `server.mjs` into modules (prompt compiler, WebSocket session, tool handlers).
- Replace `ScriptProcessorNode` with an `AudioWorklet` in the voice clients.
- Add automated browser tests for the voice flows, which need a Gemini key and microphone access in CI.
- Remove the duplicated `promptCompiler.ts` logic that the owner preview uses, so it matches the server prompt.
- Remove `ownerConfig` / `owner_config.json` dual-source behaviour.
