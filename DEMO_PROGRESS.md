# Demo progress: Leed Pizza premium demo

Branch: `feature/leed-pizza-premium-demo`. `main` was not touched.
Run locally: `npm run build && npm start`, then open http://localhost:3000.
Needs `GEMINI_API_KEY` in `.env` for voice.

## Round 2: luxury redesign (current)

### Design system
- `app/lux.css`: near-black surfaces, ivory type, champagne and gold accents.
  - Fonts: Cormorant Garamond (editorial serif) and Manrope via `next/font`, self-hosted at build.
  - Component classes sit in `@layer components`, so Tailwind utilities still win.
  - A scoped `.lux-legacy` theme re-skins the existing floor, kitchen, delivery and owner editor screens without touching their logic.
- `components/lux/SiteNav.tsx`: glass navigation that condenses on scroll, with animated underline links. Links: AI Concierge `/`, Operations `/operations`, Owner Portal `/owner`. Full-screen sheet on mobile.

### Homepage and live call
- `components/lux/ConciergeExperience.tsx`: editorial hero with "Talk to AI Concierge", a capabilities strip, and an in-place call stage.
- Call stage (WhatsApp-style):
  - Identity, connection indicator and timer.
  - Large sphere and a live status line.
  - Mute, end, and (on mobile) conversation controls.
  - Agent activity timeline, live transcript, booking confirmation card.
- `components/lux/NeuralSphere.tsx`: Canvas 2D particle sphere.
  - 480 particles on desktop, 220 on mobile, in a 3D Fibonacci sphere, with 3 nearest-neighbour links each.
  - Perspective projection, depth-bucketed lines, gold accent particles, cursor tilt.
  - States: idle, connecting, listening (driven by mic level), thinking (reorganises into latitude rings), waiting (scan band and faster spin), speaking (pulses with the real output audio level), ended.
  - Pauses when hidden or off-screen. Static under `prefers-reduced-motion`.
- `components/concierge/useVoiceCall.ts`: every UI state comes from a real event.
  - Speaking: agent audio sources are playing, measured by an AnalyserNode on the output.
  - Waiting: a server `activity: started` event has no matching `completed` yet.
  - Thinking: the microphone's speech-to-silence transition, until the reply starts.
  - Listening: the default state.
  - Transcript and activity come straight from server messages.

### Server (`server.mjs`)
- Gemini Live input and output transcription is enabled. Fragments are merged per turn, sent to the UI, and stored in the call record, so stored transcripts are now real.
- Every tool call emits `activity` started and completed events with a safe result summary.
- A tool that throws still returns an error response to the model, so the agent never goes silent waiting.
- In-call booking memory: a booking made or found during the call can be changed or cancelled without repeating the code and phone.
- Call summaries now update on modify and cancel.
- Prompt changes:
  - Acknowledge before slow tools.
  - Grounding rule: never claim availability, a booking, a change or a cancellation without a tool result.
  - Explicit "NOT PROVIDED" restaurant facts (hours, phone, policies). Owner config values are used if present.
  - Never promise callback timing.
  - The agent cannot hang up and must keep answering.

### Operations (`/operations`)
- `components/lux/OperationsWorkspace.tsx`: sidebar workspace with Overview, Floor & tables, Reservations, Kitchen, Delivery & takeout, and Calls.
- The overview uses only real data:
  - Reservations today and covers (`/api/db/reservations`).
  - Free tables (`/api/db/seating`).
  - Open kitchen tickets and deliveries (live contexts).
  - Calls needing attention (callback requests or tool errors).
- Reservations list with staff cancel (`POST /api/db/reservations`).

### Owner Portal (`/owner`, also `/admin`)
- `components/owner/OwnerControlPanel.tsx` (rewritten shell) has these sections:
  - Overview: the greeting guests hear, voice, tone, publish state, and real counts.
  - Agent voice and Instructions: existing editors, re-themed.
  - Restaurant profile: new name, location, greeting and dialect editor, with publish.
  - Menu, Floor plan, Reservations, Call history.
  - Integrations: honest provider status.
  - Publish.

## Tests actually run

| Check | Result |
|---|---|
| `node --test tests/reservations.test.mjs` | 12 pass |
| `tsc --noEmit`, ESLint on all new and changed files | Pass (after fixing 3 React-hooks lint errors) |
| `npm run build` | Pass |
| **Live Gemini, scripted calls** (`scripts/voice-smoke-test.mjs`: macOS `say` speech streamed through `/api/live` in real time) | See below |
| Booking: check, create, modify, duplicate, cancel | Pass on the final run. Code Z4KCWH created, moved 7 to 8 PM, a second same-day booking correctly refused as duplicate, then cancelled. All saved to SQLite. |
| Acknowledgment before tools | Final booking run: agent spoke 1.5–2.9 s before all 5 tool calls |
| Menu and info: price, vegetarian, gluten-free | Correct, answered only from menu data |
| Wrong number, supplier, closing hours, manager | Pass after fixes. Hours: "I don't have the hours on hand". Callbacks recorded. |
| **Live Gemini in the browser UI** (in-app browser; synthetic microphone injected for testing only) | Connected, Speaking, Listening, Thinking, activity timeline, transcript, booking card (KAGZP8), mute, end call, ended state. Desktop and mobile. |
| Call disconnection | Server logged the call record on close (Alex Morgan, 77 s, real transcript) |
| Navigation: AI Concierge, Operations, Owner Portal | Each opens its own screen. Mobile menu sheet works. |
| Hydration and console errors on `/`, `/operations`, `/owner`, `/admin`, `/host` | No errors (fixed a #418 mismatch on `/owner`) |
| Responsive: 375 px, ~800 px and 1440 px | Checked visually: homepage, call stage and sheet, Operations, Owner |

### Bugs found by live testing and fixed
1. The agent asked for the confirmation code again for a booking made in the same call. Fixed with in-call booking memory.
2. The agent said "we have availability" before calling the tool. Fixed with a grounding rule and a stronger tool description; verified on rerun.
3. The agent invented closing hours ("10 PM"). Fixed with an explicit NOT PROVIDED facts block; verified on rerun.
4. The agent went permanently silent after saying goodbye to a wrong-number caller. Fixed with a "you cannot hang up" rule; verified on rerun.
5. Call summary still said "Confirmed" after a modify or cancel. Fixed.

## Not tested
- A real human microphone in a regular browser tab. The in-app browser blocks the microphone, so browser tests used synthetic caller speech. The audio path after `getUserMedia` is the same code.
- Kitchen, delivery and floor internal actions beyond rendering. Their logic was not changed.

## Known limitations
- **Restaurant identity data:** `owner_config.json` says "Standford Pizza", and the greeting says "this is your errica". The agent and screens use this as configured. Fix it in Owner Portal > Restaurant profile > Publish.
- The agent sometimes asks "Shall I book that?" and then books in the same breath, without waiting for an answer. The details are always read back first, but confirmation isn't strictly enforced. Server-side enforcement is in the backlog.
- When the agent goes straight to a tool call without speaking first, the first audio arrives about 2.3–2.5 s after the caller stops. The tools themselves take about 1 ms.
- Opening hours, phone and policies are not configured, so the agent says it doesn't have them.
- Seeded sample calls from the original app (for example Marcus Vance) still appear in call history.
- Test bookings made during QA: Alex Morgan (KAGZP8, tomorrow 7 PM) is still confirmed; the others were cancelled. Cancel it from Operations > Reservations if not wanted.
- Booking platforms: only the local reservation book is connected. OpenTable, TouchBistro and Lightspeed need partner approval; POS KING has no public API documentation.
