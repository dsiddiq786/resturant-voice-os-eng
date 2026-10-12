import { createServer } from 'http';
import { parse } from 'url';
import { existsSync, readFileSync, createReadStream, mkdirSync } from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { ensureReservationSchema, checkAvailability, createReservation, findReservations, modifyReservation, cancelReservation, todayISO } from './lib/reservations.mjs';
import { voiceToolDeclarations } from './lib/voiceTools.mjs';

// Minimal, non-sensitive summary of a tool result for the live activity timeline.
function activityDetail(result) {
  if (!result) return null;
  if (result.reservation) {
    const r = result.reservation;
    return { code: r.confirmation_code, party_size: r.party_size, date: r.date, time: r.time };
  }
  if (result.status === 'available' || result.status === 'unavailable') {
    return { party_size: result.party_size, date: result.date, time: result.time, alternatives: result.alternatives || [] };
  }
  if (Array.isArray(result.reservations)) return { count: result.reservations.length };
  if (result.message) return { message: result.message };
  return null;
}

// Opens the shared demo database and guarantees the reservations table exists.
// Returns null (not throws) so the voice call still works without bookings.
function openSqlite() {
  try {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    const db = new DatabaseSync(join(process.cwd(), 'data', 'leed_pizza.db'));
    ensureReservationSchema(db);
    return db;
  } catch (e) {
    console.warn('SQLite unavailable for voice bookings', e);
    return null;
  }
}
import { join, resolve, sep } from 'path';
import next from 'next';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

// In production mode (dev: false), Next.js strictly requires .next/BUILD_ID,
// .next/routes-manifest.json, .next/prerender-manifest.json, and .next/server/app-paths-manifest.json.
const buildIdFile = join(process.cwd(), '.next', 'BUILD_ID');
const routesManifest = join(process.cwd(), '.next', 'routes-manifest.json');
const appPathsManifest = join(process.cwd(), '.next', 'server', 'app-paths-manifest.json');
const prerenderManifest = join(process.cwd(), '.next', 'prerender-manifest.json');

const hasCompleteBuild = existsSync(buildIdFile) &&
                         existsSync(routesManifest) && 
                         existsSync(appPathsManifest) && 
                         existsSync(prerenderManifest);

// When a production build exists, serve with dev: false. This prevents CPU pegging,
// on-demand compilation stalls, and 500 Internal Server Errors in containers.
const dev = process.env.FORCE_DEV === 'true' ? true : !hasCompleteBuild;

const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Prompt Compiler for Gemini Live System Instructions
function compileSystemPrompt(owner, menuItems, floorTables) {
  const restaurantName = owner.restaurant_name || "leed pizza";
  const venue = owner.venue || `${restaurantName} Main St`;
  const tone = owner.tone || "Lively & Casual";
  const greeting = owner.greeting || `Thanks for calling ${restaurantName}, this is your virtual host, how can I help you today?`;
  const canadianDialect = owner.canadian_dialect !== false;

  const activeItems = (menuItems || []).filter(i => !i.is_86);
  const soldOutItems = (menuItems || []).filter(i => i.is_86);

  const activeMenuText = activeItems.length > 0
    ? activeItems.map(i => {
        const dietary = i.dietary_tags && i.dietary_tags.length > 0 ? ` (${Array.isArray(i.dietary_tags) ? i.dietary_tags.join(', ') : i.dietary_tags})` : '';
        const aiPitch = i.ai_description ? ` [Recommendation Guide: ${i.ai_description}]` : '';
        return `- ${i.item_name} ($${Number(i.price).toFixed(2)}, ${i.station}, ${i.cook_time_minutes} mins) - ${i.description}${dietary}${aiPitch}`;
      }).join('\n')
    : `- Classic Pepperoni Pizza ($20.50, Pizza Oven, 4 mins) - Crispy cups, mozzarella, hot honey drizzle, fresh basil on sourdough crust (Popular)
- Margherita Pizza ($18.75, Pizza Oven, 3 mins) - San Marzano DOP tomato sauce, fresh fior di latte mozzarella, sweet basil (Vegetarian)
- Truffle Wild Mushroom Pizza ($22.00, Pizza Oven, 4 mins) - Roasted cremini & oyster mushrooms, fontina, white truffle oil (Vegetarian)
- Hot Honey Garlic Wings ($16.50, Fryer, 10 mins) - Crispy double-dredged chicken wings tossed in garlic hot honey reduction
- Tuscan Caesar Salad ($14.00, Salad Pantry, 2 mins) - Crisp romaine hearts, shaved 24-month pecorino romano, sourdough crisps (Vegetarian)
- House Hazy IPA Pint ($8.50, Bar, 1 min) - Fresh local draft IPA with tropical citrus notes (Alcohol)`;

  const soldOutText = soldOutItems.length > 0
    ? soldOutItems.map(i => `- 86'd / SOLD OUT: ${i.item_name}`).join('\n')
    : "None currently 86'd.";

  // Compile live floor plan & capacity matrix
  let floorPlanText = "";
  if (floorTables && floorTables.length > 0) {
    const totalTables = floorTables.length;
    const totalCapacity = floorTables.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0);
    const booths = floorTables.filter(t => t.type === 'BOOTH');
    const barSeats = floorTables.filter(t => t.type === 'BAR' || t.table_category === 'Bar');
    const communal = floorTables.filter(t => t.table_category === 'Communal');
    const privateTables = floorTables.filter(t => (t.type === 'TABLE' || !t.type) && t.table_category !== 'Communal');
    const otherTables = floorTables.filter(t => !booths.includes(t) && !barSeats.includes(t) && !communal.includes(t) && !privateTables.includes(t));

    const categoryLines = [];
    if (booths.length > 0) {
      categoryLines.push(`- Booths (${booths.length}): ${booths.map(b => `${b.label || b.id} (seats ${b.capacity})`).join(', ')}`);
    }
    if (privateTables.length > 0) {
      categoryLines.push(`- Dining Tables (${privateTables.length}): ${privateTables.map(t => `${t.label || t.id} (seats ${t.capacity})`).join(', ')}`);
    }
    if (barSeats.length > 0) {
      categoryLines.push(`- Bar Seating (${barSeats.length} stools): ${barSeats.map(b => b.label || b.id).join(', ')} (1 seat each, walk-in / singles / pairs)`);
    }
    if (communal.length > 0) {
      categoryLines.push(`- Communal Tables (${communal.length}): ${communal.map(c => `${c.label || c.id} (seats ${c.capacity})`).join(', ')}`);
    }
    if (otherTables.length > 0) {
      categoryLines.push(`- Additional Seating (${otherTables.length}): ${otherTables.map(o => `${o.label || o.id} (${o.type || 'Custom'}, seats ${o.capacity})`).join(', ')}`);
    }

    const maxSingleParty = Math.max(...floorTables.map(t => Number(t.capacity) || 0), 1);

    floorPlanText = `VENUE LIVE FLOOR PLAN & SEATING MATRIX:
- Total Floor Capacity: ${totalTables} tables / ${totalCapacity} total guest seats
- Largest Single Table Capacity: Up to ${maxSingleParty} guests
${categoryLines.join('\n')}
- SEATING & TABLE PROTOCOL:
  * You know every table, booth, and bar seat currently configured in the restaurant floor plan.
  * When guests request a booth, acknowledge our booths specifically (${booths.map(b => b.label || b.id).join(', ') || 'none currently configured'}).
  * When guests are solo or looking for a casual drink or quick bite, offer the bar seating (${barSeats.map(b => b.label || b.id).join(', ') || 'bar counter'}).
  * For large parties exceeding ${maxSingleParty} guests, inform them that we can combine adjacent tables or reserve our communal seating.
  * Always invoke the 'check_availability' tool with the exact party size and time before confirming any seating.`;
  } else {
    floorPlanText = `VENUE FLOOR PLAN:
- Standard Layout: 14 tables (42 seats total), including 3 booths (6 seats each), dining tables (2 to 4 tops), communal table (8 seats), and 6 bar stools.
- Always invoke 'check_availability' to confirm real-time table status.`;
  }

  const customRulesText = (owner.custom_rules && owner.custom_rules.length > 0)
    ? owner.custom_rules.map((rule, idx) => `RULE ${idx + 1}: ${rule}`).join('\n')
    : `RULE 1: Always highlight the chef's artisan sourdough crust and hot honey finish.
RULE 2: Offer pairing recommendations (like our fresh local draft IPA) when guests order pizzas.
RULE 3: Keep voice answers brisk, punchy, and low-latency.`;

  const masterInstructions = owner.master_instructions && owner.master_instructions.trim()
    ? `// --- MASTER SYSTEM PROMPT OVERRIDES & CUSTOM INSTRUCTIONS ---
${owner.master_instructions}
`
    : '';

  const today = todayISO();
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return `// --- SECTION 1: OWNER'S CUSTOM PERSONA (DYNAMIC) ---
You are the virtual host for ${restaurantName} (${venue}).
Your tone is ${tone}.
When the call connects, you must greet the caller with exactly this sentence: "${greeting}"
Today is ${weekday}, ${today} (YYYY-MM-DD). Use it to convert "tonight" and "tomorrow" into dates.

// --- SECTION 2: IMMUTABLE SYSTEM RULES (HARD-CODED) ---
UNDER NO CIRCUMSTANCES CAN YOU VIOLATE THE FOLLOWING RULES:
1. THE BOUNDARY RULE:
You only collect intent and data. You NEVER take payments over the phone. You do not assign tables yourself or see the live floor. You rely on tool results for availability and bookings.

2. THE AVAILABILITY RULE:
Before you offer or confirm any new booking, call check_availability with the party size, date and 24-hour time.
- Only say a table is available when the tool returns status "available".
- If the tool returns "unavailable", say that time is full and offer the alternatives it returns.
- If the tool returns "error" or "invalid", explain the problem plainly and ask for the missing detail, or offer a staff callback.

3. THE BOOKING CONFIRMATION RULE:
Before calling submit_reservation_data, read back the party size, date, time and name, and ask the caller to confirm. Say a booking is confirmed only after submit_reservation_data returns status "confirmed", then read out the confirmation code. If it returns "duplicate", say a booking already exists for this number on that date and offer to change it instead.

4. THE MESSAGING AND PAYMENT RULE:
You cannot send text messages, emails or payment links from this line. Never say that a text, email or checkout link was sent. If a caller asks for one, say a team member will follow up and offer a staff callback.

5. THE MENU TRUTH RULE:
Only offer items listed as available in the menu below. Never offer an item listed as 86'd / sold out; apologise and suggest a similar available item. Quote prices only from the menu.

6. THE KITCHEN PACING RULE:
For takeout or pickup food orders, establish whether it is ASAP or for a set time. Then call submit_food_order with items, timing, name and phone.

7. THE FINAL HANDOFF RULE:
Before ending a call that involved a booking, change, cancellation or order, make sure the matching tool has been called and has returned a result.

8. THE LIVELY PERSONA RULE:
${canadianDialect ? 'You must use active conversational fillers ("Hmm", "Ah, I see", "Certainly", "Right away") and polite Canadian terminology (washroom, lineup, bill). Never sound robotic or read raw lists out loud.' : 'Speak with professional, warm, concise cadence.'}

CURRENT AVAILABLE MENU MATRIX:
${activeMenuText}

CURRENT 86'D / SOLD OUT ITEMS:
${soldOutText}

// --- SECTION 2A: RESTAURANT FACTS (the only facts you may state) ---
- Name: ${restaurantName}
- Location: ${owner.address || venue}
- Opening hours: ${owner.opening_hours || 'NOT PROVIDED. You do not know the opening or closing times. Never state or estimate them; say you do not have the hours on hand and offer a staff callback.'}
- Restaurant phone number: ${owner.phone || 'NOT PROVIDED. Do not state one.'}
- Parking, patio, private events, corkage and other policies: ${owner.policies || 'NOT PROVIDED. Do not describe them; offer a staff callback.'}
- Delivery: ${owner.delivery_info || 'Phone takeout orders are taken on this line. Delivery areas, fees and third-party apps are NOT PROVIDED.'}
- Allergens: only the dietary tags on the menu below are known. Ingredient-level allergen safety is NOT PROVIDED.

// --- SECTION 2B: CALL HANDLING ---
- Changes and cancellations: if the booking was made or looked up earlier in this call, do not ask for the code or phone again; call modify_reservation or cancel_reservation without them and the system uses that booking. For any other booking, ask for the confirmation code and the phone number on it (or use find_reservation). Use modify_reservation or cancel_reservation only after the caller confirms the change.
- Missing details: ask for one missing detail at a time (party size, date, time, name, phone). If a time is unclear, ask a clarifying question. Never guess an hour.
- Restaurant information: state only opening hours, location, prices, policies and allergen information that appear in this prompt. If it is not listed, say you do not have that information and offer a staff callback. Never invent information.
- Allergens and dietary needs: never guarantee an item is allergen-free. Say the team will confirm, and offer a staff callback for anything serious.
- Requests for a person, complaints, supplier or business calls: call request_staff_callback with a short reason and any details the caller gives. Say a team member will follow up. You cannot transfer the call, and you must not promise when they will call (never say "immediately" or "in a few minutes").
- Wrong number or irrelevant call: politely say they have reached ${restaurantName} and ask whether there is anything else you can help with.
- You cannot hang up; only the caller ends the call. Saying goodbye never ends the conversation: if the caller speaks again, always answer. Never go silent while the caller is talking to you.
- Unclear speech or silence: ask the caller to repeat, briefly. After two unclear attempts, offer a staff callback.
- Interruptions: stop speaking, listen, and answer the new point.
- Unsupported requests (large private events, catering quotes, refunds): say this line cannot handle that, and offer a staff callback.
- Tool errors: if a tool returns an error or is unavailable, say so plainly. Do not guess the result.
- Grounding: never say "we have availability", "that's available", "you're booked", "it's moved" or "it's cancelled" unless a tool result in this conversation says exactly that. If you have not called the tool yet, call it now instead of guessing.
- Confirmation: if you ask the caller "shall I…?", stop and wait for their answer before calling the tool. If the caller has already clearly asked for a change or cancellation of a booking you just read back, you may go ahead without asking again.
- No silence while working: before you call check_availability, submit_reservation_data, find_reservation, modify_reservation or cancel_reservation, first say one short, natural acknowledgment (for example "Of course, let me check that for you." or "One moment, I'll look that up."), then call the tool in the same turn. Say it once. Do not repeat "please wait". Do not describe or hint at the result until the tool has returned. For answers you already have from this prompt, such as menu prices, answer directly with no filler.
- Keep replies to one or two short sentences unless the caller asks for more.

// --- SECTION 3: LIVE VENUE FLOOR PLAN & SEATING MATRIX ---
${floorPlanText}

// --- SECTION 4: OWNER MASTER DIRECTIVES & SPECIFIC POLICIES ---
${customRulesText}

${masterInstructions}`.trim();
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // Fast-path & fallback for static chunks to guarantee 100% availability
      if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/_next/static/')) {
        const relativePath = parsedUrl.pathname.replace(/^\/_next\/static\//, '');
        const nextStaticFile = join(process.cwd(), '.next', 'static', relativePath);
        const distStaticFile = join(process.cwd(), 'dist', '_next', 'static', relativePath);
        // Stay inside the static roots: url.parse keeps "../" segments, so a raw request could escape them.
        const insideRoot = (root, file) => resolve(file).startsWith(resolve(root) + sep);
        const nextRoot = join(process.cwd(), '.next', 'static');
        const distRoot = join(process.cwd(), 'dist', '_next', 'static');
        const filePath =
          insideRoot(nextRoot, nextStaticFile) && existsSync(nextStaticFile) ? nextStaticFile :
          insideRoot(distRoot, distStaticFile) && existsSync(distStaticFile) ? distStaticFile : null;

        if (filePath) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
          } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
          }
          createReadStream(filePath).pipe(res);
          return;
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('internal server error');
      }
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    if (pathname === '/api/live') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', async (clientWs, req) => {
    const callStartTime = new Date();
    const callId = 'CALL-' + Date.now();
    const transcriptLog = [];
    // Gemini streams transcription in fragments; merge them into one entry per speaker turn.
    let transcriptTurnOpen = false;
    const appendTranscript = (role, text) => {
      const last = transcriptLog[transcriptLog.length - 1];
      if (transcriptTurnOpen && last && last.role === role) {
        last.text += text;
      } else {
        transcriptLog.push({ role, text, timestamp: new Date().toLocaleTimeString() });
        transcriptTurnOpen = true;
      }
    };
    const closeTranscriptTurn = () => { transcriptTurnOpen = false; };
    const toolCallsLog = [];
    let recordedAudioChunks = [];
    let reservationSummary = null;
    let orderSummary = null;
    let callerName = 'Guest Caller';
    let callerPhone = 'Caller ID Private';

    // Heartbeat Keep-Alive to prevent any intermediate proxy or browser disconnects
    const pingInterval = setInterval(() => {
      if (clientWs.readyState === 1) {
        clientWs.ping();
      }
    }, 15000);

    clientWs.on('pong', () => {
      // client alive
    });

    try {
      const parsedUrl = parse(req.url, true);

      // Dynamically load owner config and menu matrix from SQLite and disk
      let ownerConfig = {
        voice_name: "Leda",
        restaurant_name: "leed pizza",
        greeting: "Thanks for calling leed pizza, this is your virtual host, how can I help you today?",
        tone: "Lively & Casual",
        venue: "leed pizza Main St",
        canadian_dialect: true
      };

      const sqliteDb = openSqlite();
      let handoffSummary = null;
      // The booking this caller made or looked up during this call. Lets them change or cancel it
      // without repeating the code; ownership was already established earlier in the same call.
      let sessionBooking = null;
      const currentFloorTables = () => {
        if (sqliteDb) {
          try {
            const rows = sqliteDb.prepare("SELECT * FROM seating_plan ORDER BY capacity ASC").all();
            if (rows.length > 0) return rows;
          } catch (e) {}
        }
        return floorTables;
      };

      try {
        if (sqliteDb) {
          const masterRow = sqliteDb.prepare("SELECT * FROM master_prompt_config WHERE id = 'active'").get();
          if (masterRow) {
            ownerConfig = {
              ...ownerConfig,
              ...masterRow,
              canadian_dialect: Boolean(masterRow.canadian_dialect),
              custom_rules: JSON.parse(masterRow.custom_rules || '[]')
            };
          }
        }
      } catch (e) {
        // Fallback to owner_config.json
      }

      try {
        const cfgPath = join(process.cwd(), 'owner_config.json');
        if (existsSync(cfgPath)) {
          const fileConfig = JSON.parse(readFileSync(cfgPath, 'utf8'));
          ownerConfig = {
            ...ownerConfig,
            ...fileConfig,
            restaurant_name: fileConfig.restaurant_name || ownerConfig.restaurant_name,
            venue: fileConfig.venue || `${fileConfig.restaurant_name || 'leed pizza'} Main St`
          };
        }
      } catch (e) {
        console.warn("Could not read owner_config.json", e);
      }

      const venue = parsedUrl.query.venue || (ownerConfig.venue || `${ownerConfig.restaurant_name} Main St`);

      // Load Dynamic Menu Matrix (SQLite -> JSON fallback)
      let menuItems = [];
      if (sqliteDb) {
        try {
          const menuRows = sqliteDb.prepare("SELECT * FROM menu_matrix ORDER BY price DESC").all();
          if (menuRows && menuRows.length > 0) {
            menuItems = menuRows.map(r => ({
              ...r,
              item_id: r.id,
              dietary_tags: JSON.parse(r.dietary_tags || '[]'),
              is_86: Boolean(r.is_86)
            }));
          }
        } catch (e) {
          console.warn("Could not read menu_matrix from SQLite", e);
        }
      }
      if (menuItems.length === 0) {
        try {
          const menuPath = join(process.cwd(), 'menu_matrix.json');
          if (existsSync(menuPath)) {
            menuItems = JSON.parse(readFileSync(menuPath, 'utf8'));
          }
        } catch (e) {
          console.warn("Could not read menu_matrix.json", e);
        }
      }

      // Load Dynamic Floor Plan & Seating Matrix (SQLite -> JSON fallback)
      let floorTables = [];
      if (sqliteDb) {
        try {
          const tableRows = sqliteDb.prepare("SELECT * FROM seating_plan ORDER BY capacity ASC").all();
          if (tableRows && tableRows.length > 0) {
            floorTables = tableRows.map(r => ({
              ...r,
              adjacent_to: JSON.parse(r.adjacent_to || '[]')
            }));
          }
        } catch (e) {
          console.warn("Could not read seating_plan from SQLite", e);
        }
      }
      if (floorTables.length === 0) {
        try {
          const floorPath = join(process.cwd(), 'floor_graph.json');
          if (existsSync(floorPath)) {
            floorTables = JSON.parse(readFileSync(floorPath, 'utf8'));
          }
        } catch (e) {
          console.warn("Could not read floor_graph.json", e);
        }
      }

      const selectedVoice = parsedUrl.query.voice || ownerConfig.voice_name || 'Leda';
      const systemInstruction = compileSystemPrompt({ ...ownerConfig, venue }, menuItems, floorTables);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'MY_GEMINI_API_KEY') {
        console.warn('⚠️ [Voice Concierge] GEMINI_API_KEY is missing or unset in your .env.local file.');
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({ 
            error: "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your .env.local file to enable the live voice concierge." 
          }));
        }
        clearInterval(pingInterval);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      let session = null;

      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: [{ functionDeclarations: voiceToolDeclarations() }],
          // Text transcripts of both sides, used for the live transcript and the stored call record.
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ audio }));
              recordedAudioChunks.push(audio);
            }

            const callerText = message.serverContent?.inputTranscription?.text;
            if (callerText) {
              appendTranscript('user', callerText);
              if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ transcript: { role: 'caller', text: callerText } }));
            }
            const agentText = message.serverContent?.outputTranscription?.text;
            if (agentText) {
              appendTranscript('agent', agentText);
              if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ transcript: { role: 'agent', text: agentText } }));
            }

            if (message.serverContent?.turnComplete) {
              closeTranscriptTurn();
              if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ turnComplete: true }));
            }
            
            if (message.serverContent?.interrupted && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                const args = call.args || {};
                const sendToClient = (payload) => {
                  if (clientWs.readyState === 1) clientWs.send(JSON.stringify(payload));
                };
                let responded = false;
                const respond = (response) => {
                  responded = true;
                  sendToClient({
                    activity: {
                      id: call.id,
                      tool: call.name,
                      phase: 'completed',
                      status: response?.status || 'ok',
                      detail: activityDetail(response),
                    }
                  });
                  try {
                    session.sendToolResponse({
                      functionResponses: [{ id: call.id, name: call.name, response }]
                    });
                  } catch (err) {
                    console.warn("Could not return tool response", err);
                  }
                };
                const logTool = (result) => {
                  toolCallsLog.push({ name: call.name, args, result, timestamp: new Date().toISOString() });
                };
                const reservationCtx = () => ({ db: sqliteDb, venue, tables: currentFloorTables(), now: new Date() });
                const RESERVATION_UNAVAILABLE = { status: 'error', message: 'The booking system is unavailable right now. Offer a staff callback.' };

                // Real start event; the UI shows it until the matching 'completed' event arrives.
                sendToClient({ activity: { id: call.id, tool: call.name, phase: 'started' } });
                try {
                if (call.name === "check_availability") {
                  const date = args.date || todayISO();
                  const result = sqliteDb
                    ? checkAvailability(reservationCtx(), { party_size: args.party_size, date, time: args.target_time })
                    : RESERVATION_UNAVAILABLE;
                  console.log(`[Tool Call: check_availability] status=${result.status}`);
                  logTool(result);
                  sendToClient({ toolEvent: 'check_availability', callId: call.id, arguments: { ...args, date, venue }, result });
                  respond(result);
                } else if (call.name === "submit_reservation_data") {
                  const result = sqliteDb
                    ? createReservation(reservationCtx(), {
                        customer_name: args.customer_name,
                        customer_phone: args.customer_phone,
                        party_size: args.party_size,
                        date: args.date,
                        time: args.confirmed_time,
                        special_requests: args.special_requests,
                      })
                    : RESERVATION_UNAVAILABLE;
                  console.log(`[Tool Call: submit_reservation_data] status=${result.status}`);
                  logTool(result);
                  if (result.status === 'confirmed') {
                    sessionBooking = { code: result.reservation.confirmation_code, phone: String(args.customer_phone) };
                    callerName = result.reservation.customer_name;
                    callerPhone = args.customer_phone;
                    reservationSummary = `Confirmed ${result.reservation.party_size} guests at ${result.reservation.time} on ${result.reservation.date}. Code ${result.reservation.confirmation_code}.`;
                    sendToClient({
                      functionCall: {
                        name: call.name,
                        arguments: {
                          ...args,
                          customer_name: result.reservation.customer_name,
                          party_size: result.reservation.party_size,
                          confirmed_time: result.reservation.time,
                          date: result.reservation.date,
                          venue,
                        }
                      }
                    });
                  }
                  sendToClient({ toolResult: { name: call.name, result } });
                  respond(result);
                } else if (call.name === "find_reservation") {
                  const result = sqliteDb
                    ? findReservations(reservationCtx(), {
                        confirmation_code: args.confirmation_code,
                        customer_phone: args.customer_phone,
                        customer_name: args.customer_name,
                      })
                    : RESERVATION_UNAVAILABLE;
                  console.log(`[Tool Call: find_reservation] status=${result.status}`);
                  if (result.status === 'found' && result.reservations.length === 1) {
                    sessionBooking = { code: result.reservations[0].confirmation_code, phone: String(args.customer_phone) };
                  }
                  logTool({ status: result.status, count: result.reservations?.length ?? 0 });
                  respond(result);
                } else if (call.name === "modify_reservation") {
                  const result = sqliteDb
                    ? modifyReservation(reservationCtx(), {
                        confirmation_code: args.confirmation_code || sessionBooking?.code,
                        customer_phone: args.customer_phone || sessionBooking?.phone,
                        party_size: args.new_party_size,
                        date: args.new_date,
                        time: args.new_time,
                        special_requests: args.special_requests ?? undefined,
                      })
                    : RESERVATION_UNAVAILABLE;
                  if (result.status === 'modified') {
                    reservationSummary = `Changed to ${result.reservation.party_size} guests at ${result.reservation.time} on ${result.reservation.date}. Code ${result.reservation.confirmation_code}.`;
                  }
                  console.log(`[Tool Call: modify_reservation] status=${result.status}`);
                  logTool(result);
                  sendToClient({ toolResult: { name: call.name, result } });
                  respond(result);
                } else if (call.name === "cancel_reservation") {
                  const result = sqliteDb
                    ? cancelReservation(reservationCtx(), {
                        confirmation_code: args.confirmation_code || sessionBooking?.code,
                        customer_phone: args.customer_phone || sessionBooking?.phone,
                      })
                    : RESERVATION_UNAVAILABLE;
                  if (result.status === 'cancelled') {
                    sessionBooking = null;
                    reservationSummary = `Cancelled reservation ${result.reservation.confirmation_code} (${result.reservation.party_size} guests, ${result.reservation.time} on ${result.reservation.date}).`;
                  }
                  console.log(`[Tool Call: cancel_reservation] status=${result.status}`);
                  logTool(result);
                  sendToClient({ toolResult: { name: call.name, result } });
                  respond(result);
                } else if (call.name === "request_staff_callback") {
                  if (args.customer_name && callerName === 'Guest Caller') callerName = String(args.customer_name).slice(0, 80);
                  if (args.customer_phone) callerPhone = String(args.customer_phone).slice(0, 40);
                  handoffSummary = `Callback requested: ${String(args.reason || 'not specified').slice(0, 200)}`;
                  const result = {
                    status: 'callback_requested',
                    message: 'Recorded for staff follow-up. A live transfer is not available on this line.'
                  };
                  console.log(`[Tool Call: request_staff_callback] recorded`);
                  logTool(result);
                  sendToClient({ toolResult: { name: call.name, result } });
                  respond(result);
                } else if (call.name === "submit_food_order") {
                  callerName = args.customer_name || callerName;
                  callerPhone = args.customer_phone || callerPhone;
                  const ticketId = "TKT-" + Math.floor(100 + Math.random() * 900);
                  const itemCount = Array.isArray(args.items) ? args.items.length : 1;
                  orderSummary = `Takeout ${args.timing || 'ASAP'} (${itemCount} items) for ${callerName}. Ticket: ${ticketId}`;
                  const result = {
                    status: 'received',
                    order_id: ticketId,
                    payment_link: 'not_sent',
                    message: 'Order sent to the kitchen. No payment link was sent.'
                  };
                  logTool(result);
                  sendToClient({ functionCall: { name: call.name, arguments: args } });
                  respond(result);
                } else {
                  respond({ status: 'error', message: `Unknown tool ${call.name}` });
                }
                } catch (err) {
                  // Never leave the model waiting on a tool that threw; it would go silent.
                  console.error(`[Tool Call: ${call.name}] failed`, err);
                  if (!responded) {
                    respond({ status: 'error', message: 'The system hit an error. Apologise briefly and offer a staff callback.' });
                  }
                }
              }
            }
          },
          onclose: () => {
            if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ status: "disconnected" }));
          },
          onerror: (err) => {
            console.error("Gemini connection error", err);
            if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ error: err.message }));
          }
        },
      });

      // Send initial context about the venue
      session.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text: `[System Context: The caller is calling ${ownerConfig.restaurant_name} (${venue}). Greet them enthusiastically with: "${ownerConfig.greeting}"]` }]
          }
        ],
        turnComplete: true
      });

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (parsed.userSpeech) {
            transcriptLog.push({
              role: 'user',
              text: parsed.userSpeech,
              timestamp: new Date().toLocaleTimeString()
            });
          }
          if (parsed.end) {
            if (session) {
              session.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: 'Goodbye' }]
                  }
                ],
                turnComplete: true
              });
            }
          }
        } catch (err) {
          console.error("Error parsing message", err);
        }
      });
      
      const finalizeCallSession = async () => {
        clearInterval(pingInterval);
        // Close the Gemini Live session and our DB handle; both used to leak on every call.
        try { session?.close(); } catch (e) { /* already closed */ }
        try { sqliteDb?.close(); } catch (e) { /* already closed */ }
        const callEndTime = new Date();
        const durationSecs = Math.max(1, Math.round((callEndTime.getTime() - callStartTime.getTime()) / 1000));

        // Save call into SQLite database
        try {
          const { DatabaseSync } = await import('node:sqlite');
          const dbPath = join(process.cwd(), 'data', 'leed_pizza.db');
          if (existsSync(dbPath)) {
            const sqliteDb = new DatabaseSync(dbPath);
            const insertStmt = sqliteDb.prepare(`
              INSERT INTO voice_recordings (
                id, caller_name, caller_phone, venue, start_time, end_time, duration_seconds, status, intent, transcript, audio_data, tool_calls, reservation_summary, order_summary, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            // Sample simulated transcript if live speech recognition was local
            const finalTranscript = transcriptLog.length > 0 ? transcriptLog : [
              { role: 'agent', text: ownerConfig.greeting, timestamp: callStartTime.toLocaleTimeString() },
              { role: 'user', text: "Inbound voice audio session", timestamp: callEndTime.toLocaleTimeString() }
            ];

            insertStmt.run(
              callId,
              callerName,
              callerPhone,
              venue,
              callStartTime.toISOString(),
              callEndTime.toISOString(),
              durationSecs,
              'completed',
              reservationSummary ? 'reservation' : orderSummary ? 'takeout' : handoffSummary ? 'handoff' : 'inquiry',
              JSON.stringify(finalTranscript),
              recordedAudioChunks.length > 0 ? recordedAudioChunks.slice(0, 50).join('') : null,
              JSON.stringify(toolCallsLog),
              reservationSummary,
              orderSummary,
              new Date().toISOString()
            );
            console.log(`[SQLite Database] Call ${callId} recorded (${durationSecs}s) for ${callerName}`);
          }
        } catch (dbErr) {
          console.warn("Could not record call in SQLite:", dbErr);
        }
      };

      clientWs.on('close', finalizeCallSession);

      clientWs.on('error', (err) => {
        console.error("Client WebSocket error:", err);
        clearInterval(pingInterval);
      });

    } catch (err) {
      console.error("Error connecting to Gemini", err);
      clearInterval(pingInterval);
      try {
        clientWs.send(JSON.stringify({ error: "Failed to connect to AI" }));
        clientWs.close();
      } catch (closeErr) {
        console.error("Error closing client ws", closeErr);
      }
    }
  });

  wss.on('error', (err) => {
    console.error("WebSocket server error:", err);
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} (mode: ${dev ? 'development' : 'production'})`);
  });
}).catch((err) => {
  console.error('Failed to initialize Next.js server:', err);
  process.exit(1);
});
