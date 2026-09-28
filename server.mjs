import { createServer } from 'http';
import { parse } from 'url';
import { existsSync, readFileSync, createReadStream } from 'fs';
import { join } from 'path';
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

  return `// --- SECTION 1: OWNER'S CUSTOM PERSONA (DYNAMIC) ---
You are the virtual host for ${restaurantName} (${venue}).
Your tone is ${tone}.
When the call connects, you must greet the caller with exactly this sentence: "${greeting}"

// --- SECTION 2: IMMUTABLE SYSTEM RULES (HARD-CODED) ---
UNDER NO CIRCUMSTANCES CAN YOU VIOLATE THE FOLLOWING RULES:
1. THE BOUNDARY RULE:
You only collect intent and data. You NEVER process payments over the phone. You do not assign physical tables or check real inventory yourself. You rely strictly on system context and emit structured data for the backend.

2. THE AVAILABILITY RULE (THE "GREEN LIGHT" RULE):
If a caller asks for a reservation, you MUST trigger the 'check_availability' tool first with venue: "${venue}". You cannot say "yes" or confirm any booking until the backend returns {"status": "available"}.
- Latency masking: Use polite, natural conversational fillers while the check runs ("Hmm, let me check our floor plan for that time real quick...", "Right away, checking our availability now...").
- If unavailable: The tool will return alternatives (e.g. 7:30 PM or 8:45 PM) or suggest bar/communal options. Pivot smoothly and offer those times.

3. THE "PACKED HOUSE" RULE:
Never outright reject a customer if private tables are full. You MUST pivot and offer communal seating, bar seating, or the waitlist based on the live floor plan. If the current venue is 100% full, you MUST offer a reservation at a sister venue.

4. THE MENU TRUTH & INVENTORY "86" RULE:
You may only offer items currently listed as "available" in your context window. If an item is marked "sold out" or "86'd", you are strictly forbidden from selling it. You must apologize and immediately suggest a similar available alternative.

CURRENT AVAILABLE MENU MATRIX:
${activeMenuText}

CURRENT 86'D / SOLD OUT ITEMS:
${soldOutText}

5. THE KITCHEN PACING RULE:
For all takeout/delivery food orders, you MUST establish if it is for "ASAP" or scheduled for a specific time. Phase 3 Kitchen Pacing needs this exact timestamp to pace cooking. Trigger the 'submit_food_order' tool with items, timing, name, and phone.

6. THE PAYMENT SECURITY RULE:
You are strictly forbidden from asking for, recording, or listening to credit card numbers over the phone. For phone orders, you MUST state: "I am sending a secure checkout link to your phone right now."

7. THE FINAL HANDOFF & JSON RULE:
When the conversation naturally concludes, you MUST trigger the 'submit_reservation_data' or 'submit_food_order' tool to send the finalized payload to the backend. Do not hang up until this is executed.

8. THE LIVELY PERSONA RULE:
${canadianDialect ? 'You must use active conversational fillers ("Hmm", "Ah, I see", "Certainly", "Right away") and polite Canadian terminology (washroom, lineup, bill). Never sound robotic or read raw lists out loud.' : 'Speak with professional, warm, concise cadence.'}

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
        const filePath = existsSync(nextStaticFile) ? nextStaticFile : existsSync(distStaticFile) ? distStaticFile : null;

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

      let sqliteDb = null;
      try {
        const { DatabaseSync } = await import('node:sqlite');
        const dbPath = join(process.cwd(), 'data', 'leed_pizza.db');
        if (existsSync(dbPath)) {
          sqliteDb = new DatabaseSync(dbPath);
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
          tools: [{
            functionDeclarations: [
              {
                name: "check_availability",
                description: `Checks the backend 15-minute grid and Turn Time math for table overlaps at ${venue}.`,
                parameters: {
                  type: "object",
                  properties: {
                    party_size: { 
                      type: "integer", 
                      description: "The number of guests in the party" 
                    },
                    target_time: { 
                      type: "string", 
                      description: "Target reservation time in HH:MM format (24-hour time, e.g. 20:00 for 8:00 PM, 19:30 for 7:30 PM)" 
                    },
                    venue: { 
                      type: "string", 
                      description: `The venue name: ${venue}` 
                    }
                  },
                  required: ["party_size", "target_time", "venue"]
                }
              },
              {
                name: "submit_reservation_data",
                description: `Emits the finalized, backend-approved reservation contract to lock the table in SQLite database and trigger SMS confirmation for ${venue}.`,
                parameters: {
                  type: "object",
                  properties: {
                    party_size: { 
                      type: "integer", 
                      description: "The finalized party size (number of guests)" 
                    },
                    confirmed_time: { 
                      type: "string", 
                      description: "Confirmed reservation time in HH:MM format (e.g. 19:30 or 20:45)" 
                    },
                    customer_name: { 
                      type: "string", 
                      description: "The customer's full name" 
                    },
                    customer_phone: { 
                      type: "string", 
                      description: "The customer's contact phone number for SMS confirmation" 
                    },
                    venue: { 
                      type: "string", 
                      description: `The venue name: ${venue}` 
                    }
                  },
                  required: ["party_size", "confirmed_time", "customer_name", "customer_phone", "venue"]
                }
              },
              {
                name: "submit_food_order",
                description: `Submits a takeout or pickup food order directly to the ${ownerConfig.restaurant_name} Kitchen Pacing Engine and KDS.`,
                parameters: {
                  type: "object",
                  properties: {
                    customer_name: {
                      type: "string",
                      description: "The caller or guest's name"
                    },
                    customer_phone: {
                      type: "string",
                      description: "Customer contact phone for secure payment link and SMS status"
                    },
                    timing: {
                      type: "string",
                      description: "Pickup timing: 'ASAP' or scheduled timestamp (e.g. 19:45)"
                    },
                    items: {
                      type: "array",
                      description: `List of items ordered from the ${ownerConfig.restaurant_name} Menu Matrix`,
                      items: {
                        type: "object",
                        properties: {
                          item_name: { type: "string" },
                          quantity: { type: "integer" }
                        },
                        required: ["item_name"]
                      }
                    }
                  },
                  required: ["customer_name", "customer_phone", "timing", "items"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ audio }));
              recordedAudioChunks.push(audio);
            }
            
            if (message.serverContent?.turnComplete && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
            
            if (message.serverContent?.interrupted && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "check_availability") {
                  const targetTime = String(call.args?.target_time || '').trim();
                  const partySize = Number(call.args?.party_size) || 2;
                  const reqVenue = call.args?.venue || venue;

                  console.log(`[Tool Call: check_availability] venue=${reqVenue}, size=${partySize}, time=${targetTime}`);

                  // Re-query latest seating from SQLite if available, else session floorTables
                  let currentFloor = floorTables;
                  if (sqliteDb) {
                    try {
                      const latestTables = sqliteDb.prepare("SELECT * FROM seating_plan ORDER BY capacity ASC").all();
                      if (latestTables && latestTables.length > 0) {
                        currentFloor = latestTables;
                      }
                    } catch (e) {}
                  }

                  const isPeakHour = (targetTime === '20:00' || targetTime.includes('20:00') || targetTime === '8:00 PM' || targetTime === '8:00' || targetTime === '08:00 PM');
                  const maxFloorCapacity = Math.max(...currentFloor.map(t => Number(t.capacity) || 0), 0);

                  // Find candidate matching party size
                  const matchingCandidate = currentFloor.find(t => 
                    Number(t.capacity) >= partySize && 
                    t.stage === 'AVAILABLE'
                  );

                  let responsePayload;
                  if (partySize > maxFloorCapacity) {
                    // Party size exceeds any individual table
                    const communal = currentFloor.find(t => t.table_category === 'Communal' || t.type === 'COMMUNAL');
                    if (communal && Number(communal.capacity) >= partySize) {
                      responsePayload = {
                        status: "available",
                        table_assigned: communal.label || communal.id,
                        capacity: communal.capacity,
                        seating_type: "Communal Table",
                        note: `Party of ${partySize} can be accommodated at our long communal table.`
                      };
                    } else {
                      responsePayload = {
                        status: "unavailable",
                        reason: `Largest individual table fits ${maxFloorCapacity} guests.`,
                        alternatives: ["17:30", "21:00"],
                        packed_house_options: ["Communal seating", "Split tables", "Sister venue at Commercial Dr"]
                      };
                    }
                  } else if (isPeakHour && !matchingCandidate) {
                    const barStools = currentFloor.filter(t => (t.type === 'BAR' || t.table_category === 'Bar') && t.stage === 'AVAILABLE');
                    responsePayload = {
                      status: "unavailable",
                      alternatives: ["19:15", "20:45"],
                      packed_house_options: barStools.length >= partySize ? ["Bar seating available"] : ["Waitlist", "Sister venue at Commercial Dr"]
                    };
                  } else if (matchingCandidate) {
                    responsePayload = {
                      status: "available",
                      table_assigned: matchingCandidate.label || matchingCandidate.id,
                      capacity: matchingCandidate.capacity,
                      seating_type: matchingCandidate.type || matchingCandidate.table_category || "Table",
                      venue: reqVenue
                    };
                  } else {
                    responsePayload = {
                      status: "available",
                      venue: reqVenue
                    };
                  }

                  toolCallsLog.push({
                    name: call.name,
                    args: call.args,
                    result: responsePayload,
                    timestamp: new Date().toISOString()
                  });

                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({
                      toolEvent: 'check_availability',
                      callId: call.id,
                      arguments: call.args,
                      result: responsePayload
                    }));
                  }

                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: responsePayload
                    }]
                  });
                } else if (call.name === "submit_reservation_data") {
                  console.log(`[Tool Call: submit_reservation_data] args=`, call.args);
                  callerName = call.args?.customer_name || callerName;
                  callerPhone = call.args?.customer_phone || callerPhone;
                  const confId = "RES-" + Math.floor(100000 + Math.random() * 900000);
                  const assignedTable = call.args?.table_assigned || 'Standard Seating';
                  reservationSummary = `Locked table for ${call.args?.party_size || 2} guests at ${call.args?.confirmed_time || '7:00 PM'} for ${callerName}. Conf: ${confId}`;

                  // Persist reservation to SQLite seating table if applicable
                  if (sqliteDb && call.args?.table_assigned) {
                    try {
                      sqliteDb.prepare("UPDATE seating_plan SET stage = 'LOCKED', occupant_name = ? WHERE label = ? OR id = ?")
                        .run(callerName, call.args.table_assigned, call.args.table_assigned);
                    } catch (e) {
                      console.warn("Could not update table stage in SQLite:", e);
                    }
                  }

                  toolCallsLog.push({
                    name: call.name,
                    args: call.args,
                    result: { status: "locked", confirmation_id: confId, assigned_table: assignedTable },
                    timestamp: new Date().toISOString()
                  });
                  
                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ 
                      functionCall: {
                        name: call.name,
                        arguments: call.args
                      } 
                    }));
                  }

                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { 
                        status: "locked",
                        confirmation_id: confId,
                        sms_status: "queued" 
                      }
                    }]
                  });
                } else if (call.name === "submit_food_order") {
                  console.log(`[Tool Call: submit_food_order] args=`, call.args);
                  callerName = call.args?.customer_name || callerName;
                  callerPhone = call.args?.customer_phone || callerPhone;
                  const ticketId = "TKT-" + Math.floor(100 + Math.random() * 900);
                  const itemCount = Array.isArray(call.args?.items) ? call.args.items.length : 1;
                  orderSummary = `Takeout ${call.args?.timing || 'ASAP'} (${itemCount} items) for ${callerName}. Paced in Kitchen. Ticket: ${ticketId}`;

                  toolCallsLog.push({
                    name: call.name,
                    args: call.args,
                    result: { status: "paced_and_queued", order_id: ticketId },
                    timestamp: new Date().toISOString()
                  });
                  
                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ 
                      functionCall: {
                        name: call.name,
                        arguments: call.args
                      } 
                    }));
                  }

                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { 
                        status: "paced_and_queued",
                        order_id: ticketId,
                        kitchen_status: "hold_queue_active",
                        sms_payment_link: "sent"
                      }
                    }]
                  });
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
              reservationSummary ? 'reservation' : orderSummary ? 'takeout' : 'inquiry',
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
