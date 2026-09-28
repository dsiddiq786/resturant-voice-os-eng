# Restaurant OS — white & teal refresh

The updated project uses white surfaces, a muted teal accent, pale mint gradients, softer shadows, readable dark text, keyboard focus indicators and a compact phone navigation layout. Styling covers owner settings, floor planning, menus, kitchen tickets, delivery dispatch, voice panels and error screens. Existing React/TypeScript interactions and backend integrations are retained.

## Run

Use Node.js 22.13+ (the server uses built-in SQLite). Install dependencies with `npm ci`, copy your original `.env` into this project, then run `npm run build` and `npm start`. The default address is http://localhost:3000. For this session the preview runs on port 3100.

Open `/` or `/owner` for settings, `/operations` for floor/kitchen/delivery, and `/host` for the standalone floor screen.

Your original Downloads project is unchanged. This copy includes your JSON configuration; credentials and the original live database are excluded. The local preview creates its own database. If replacing the original project, apply the updated `app/` and `components/` folders while keeping the original `.env`, database, and configuration files.

## Verification

- Production build and TypeScript validation.
- ESLint.
- Browser checks: owner workspace, floor-plan screen, menu search, operations navigation, kitchen simulated-order creation, delivery board.
- Phone-sized owner workspace at 390px; no horizontal page overflow.

Live Gemini calls, microphone audio, external delivery-provider traffic, and every possible end-to-end workflow were not verified. Voice previews use the existing browser speech-synthesis implementation. These integrations still require their original credentials and services.
