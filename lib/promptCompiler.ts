export interface OwnerPersonaConfig {
  restaurant_name: string;
  tone: string;
  greeting: string;
  voice_name?: string;
  voice_label?: string;
  canadian_dialect?: boolean;
  venue?: string;
  last_deployed_at?: string;
  master_instructions?: string;
  custom_rules?: string[];
  boundary_strictness?: boolean;
  green_light_enabled?: boolean;
  packed_house_policy?: string;
}

export interface MenuItemPromptData {
  item_name: string;
  price: number;
  station: string;
  cook_time_minutes: number;
  description: string;
  dietary_tags?: string[];
  is_86?: boolean;
  ai_description?: string;
}

export interface FloorTablePromptData {
  id: string;
  label: string;
  capacity: number;
  stage?: string;
  type?: string;
  table_category?: string;
  adjacent_to?: string[] | string;
  adjacentTo?: string[];
}

/**
 * Master Prompt Compiler: Dynamically compiles the final SYSTEM_INSTRUCTION sent
 * to the Gemini Live API by merging the owner's custom persona, master system prompt rules,
 * live floor plan layout & seating capacities, live menu state, and hardcoded operational safety guardrails.
 */
export function compilePrompt(
  owner: OwnerPersonaConfig,
  menuItems: MenuItemPromptData[] = [],
  floorTables: FloorTablePromptData[] = []
): string {
  const restaurantName = owner.restaurant_name || "leed pizza";
  const venue = owner.venue || `${restaurantName} Main St`;
  const tone = owner.tone || "Lively & Casual";
  const greeting = owner.greeting || `Thanks for calling ${restaurantName}, this is your virtual host, how can I help you today?`;
  const canadianDialect = owner.canadian_dialect !== false;

  // Build active menu inventory vs 86'd items
  const activeItems = (menuItems || []).filter(i => !i.is_86);
  const soldOutItems = (menuItems || []).filter(i => i.is_86);

  const activeMenuText = activeItems.length > 0
    ? activeItems.map(i => {
        const dietary = i.dietary_tags && i.dietary_tags.length > 0 ? ` (${Array.isArray(i.dietary_tags) ? i.dietary_tags.join(', ') : i.dietary_tags})` : '';
        const aiPitch = i.ai_description ? ` [Recommendation Guide: ${i.ai_description}]` : '';
        return `- ${i.item_name} ($${Number(i.price).toFixed(2)}, ${i.station}, ${i.cook_time_minutes} mins) - ${i.description}${dietary}${aiPitch}`;
      }).join('\n')
    : `- Classic Pepperoni Pizza ($20.50, Pizza Oven, 4 mins) - Crispy cups, mozzarella, hot honey drizzle, fresh basil (Popular)
- Margherita Pizza ($18.75, Pizza Oven, 3 mins) - San Marzano tomato sauce, fresh mozzarella, sweet basil (Vegetarian)
- Truffle Mushroom Pizza ($22.00, Pizza Oven, 4 mins) - Wild roasted mushrooms, fontina, white truffle oil, thyme (Vegetarian)
- Hot Honey Garlic Wings ($16.50, Fryer, 10 mins) - Crispy double-dredged wings tossed in hot honey garlic glaze
- Tuscan Caesar Salad ($14.00, Salad Pantry, 2 mins) - Romaine hearts, shaved pecorino, sourdough crisps (Vegetarian)
- House Hazy IPA Pint ($8.50, Bar, 1 min) - Fresh local draft with tropical citrus notes`;

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

    const categoryLines: string[] = [];
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
- Latency masking: Use polite, natural conversational fillers while the check runs ("Hmm, let me check our floor plan for that time real quick...", "Right away, checking our table layout now...").
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
