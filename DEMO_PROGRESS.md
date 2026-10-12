# Demo progress: Leed Pizza premium demo

Branch: `feature/leed-pizza-premium-demo` (created from `resturant_light_os`). `main` was not touched.

## Completed

**Reservation engine (new)**
- `lib/reservations.mjs`: availability, duplicate prevention, create, find, modify, cancel. Persists to the existing `data/leed_pizza.db` in a new `reservations` table.
- Availability checks the requested date and time against existing bookings. Each table holds a 90-minute seating. Bar stools are reserved for solo guests.
- Duplicates: one confirmed booking per phone number per date.
- Changes and cancellations need the confirmation code plus the phone number on the booking. Find accepts phone plus name.
- Confirmation codes are random and unique. Phone numbers are masked in tool results.

**Voice agent (`server.mjs`, `lib/voiceTools.mjs`)**
- Gemini tools: `check_availability`, `submit_reservation_data`, `find_reservation`, `modify_reservation`, `cancel_reservation`, `request_staff_callback`, `submit_food_order`.
- Unknown tool names get an explicit error response, so the model is never left waiting.
- The `SMS sent` and `payment link sent` claims were removed. The agent is told it cannot send them.
- The system prompt now covers scenarios: missing details, opening hours and policies (only what is configured), allergens, complaints, supplier calls, wrong numbers, silence, interruptions, and tool errors.
- Opening hours are not configured anywhere in this project, so the agent says it does not have them.
- Session cleanup: the Gemini session and the SQLite handle are closed when a call ends.
- Security: the static-file traversal in the custom server is fixed (`/_next/static/../../.env.local` now returns 404).

**Homepage (new)**
- `app/page.tsx` is now the AI concierge call screen. The back office moved to `/owner` (it was already there). The owner panel is no longer the homepage.
- `components/concierge/ConciergeHome.tsx`: header (Leed Pizza, AI Concierge, Owner Portal), restaurant identity, avatar, call timer, connection status, speaking and listening states, mute and end controls, booking confirmation chip, error messages.
- `components/concierge/useVoiceCall.ts`: connects to the existing `/api/live` WebSocket with the same PCM protocol as the back-office client. No calls are simulated.
- `components/concierge/concierge.css`: motion, with `prefers-reduced-motion` respected.
- Page title and metadata changed to "Leed Pizza · AI Concierge".

**Hygiene**
- `.gitignore` now excludes `dist/`, `data/`, `*.db*`, and `tsconfig.tsbuildinfo`. The customer database can no longer be committed by accident.

## Tests and results

| Check | Result |
|---|---|
| `node --test tests/reservations.test.mjs` (12 cases: time parsing, booking, invalid input, duplicates, fully booked with alternatives, bar stools, find, modify, ownership, cancel, persistence across reopened DB file, past times) | **12 pass, 0 fail** |
| `npx tsc --noEmit` | Pass |
| `npx eslint` on changed TS files | Pass |
| `node --check server.mjs` | Pass |
| `npm run build` (production) | **Pass** |
| Production server: `/` and `/owner` | 200 |
| Static traversal `/_next/static/../../.env.local` and `../../data/leed_pizza.db` | 404 (before the fix, the file contents were served) |
| Legitimate static chunk | 200 |
| WebSocket `/api/live` with no Gemini key | Returns the configured-key error message and closes |
| Browser, desktop 1280px: homepage layout | Checked visually, renders correctly |
| Browser, mobile 375px: header and call screen | Checked visually; header fixed (wordmark hides, nav does not wrap) |
| Browser, Owner Portal link to `/owner` | Loads |
| Browser, Start call | Shows "Microphone access was blocked" message (the browser pane blocks the mic) |

## Not tested (and why)

- **Live Gemini voice conversation: not tested.** No `GEMINI_API_KEY` is configured in this environment, and the browser pane cannot grant microphone access. Tool calls and voice behaviour are unverified against the live model.
- **Mute/unmute, end-call audio, interruptions, silence, and the wrong-number, supplier, human-handoff, and API-failure scenarios: not tested live.** The logic is in place and the prompt covers them. The server-side booking logic is covered by unit tests.
- **Reservation tools end to end through the model: not tested.** Only the underlying logic is tested.

## Integration readiness (booking platforms)

No integration code for any of these four exists in the repository. Findings are from public web search on the day of the sprint. Not verified against live partner documentation.

- **OpenTable**: partner-gated. Requires approval as an integration partner and a formal agreement for production. Sandbox available only after approval. **Not ready.** Needs a partner application and credentials.
- **TouchBistro**: partner-only API. Access requires applying to the partner program and commercial terms; contact via the integrations team. **Not ready.**
- **Lightspeed**: the Reservations for Platforms API is restricted to approved partners. Requires a Developer Portal account approved by Lightspeed and an API client. **Not ready.**
- **POS KING**: no public API or integration documentation could be found in the search. **Unknown, needs vendor contact.**

Local bookings are **not** synchronized with any external platform. The UI and agent do not claim that they are.

## Remaining limitations

- Restaurant name in the current data is **"Standford Pizza"** (`owner_config.json`), with a greeting that says "errica" and master instructions that say "leed pizza". The call screen shows "Standford Pizza". **Needs the owner to correct this before the client demo.** This was not changed because it is the owner's configuration data.
- Opening hours, parking, and policies are not configured. The agent will say it does not have them.
- Call transcripts are not shown on the call screen. The Gemini stream sends audio only, and text transcription was not added without a way to test it.
- The call record stores only the model's audio output, not the caller's, and only the first 50 chunks.
- Food orders are still acknowledged in memory. The KDS and `orders` table are not wired to a server-side record.
- Floor-plan and kitchen data still come from a mix of hardcoded examples and the database.
- Back-office screens received only the header and metadata update. The sidebar, dashboard, settings, and menu screens are not redesigned.
- `npm ci` fails because the lockfile is out of sync with `package.json`. Dependencies were installed with `npm install --no-save`, which leaves the lockfile unchanged.

## Remaining work (priority order)

1. Correct the restaurant name, greeting, and master instructions in `owner_config.json` (or via the owner portal), then redeploy and check the homepage.
2. Run one live voice call with a real key: connect, greeting, check availability, book, modify, cancel, and the end call. Record results here.
3. Provide opening hours and policy text to the owner config so the agent can answer those questions.
4. Back-office visual pass, if time allows.
5. Booking provider decisions: contact each provider, starting with the platforms the client is most likely to use.
