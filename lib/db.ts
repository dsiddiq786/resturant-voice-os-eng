import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Using Node.js 22 built-in SQLite DatabaseSync
// fallback-safe and synchronous
let dbInstance: any = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'leed_pizza.db');
  
  // Dynamically import node:sqlite to support all Node environments
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);

  // Performance optimizations for real-time latency
  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA synchronous = NORMAL;`);
  db.exec(`PRAGMA foreign_keys = ON;`);

  // 1. Seating Plan Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS seating_plan (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      stage TEXT NOT NULL DEFAULT 'AVAILABLE',
      type TEXT NOT NULL DEFAULT 'TABLE',
      table_category TEXT NOT NULL DEFAULT 'Private',
      x REAL NOT NULL,
      y REAL NOT NULL,
      w REAL NOT NULL,
      h REAL NOT NULL,
      adjacent_to TEXT DEFAULT '[]',
      occupant_name TEXT,
      time_elapsed INTEGER DEFAULT 0,
      locked_until INTEGER,
      turnover_time INTEGER,
      notes TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Voice Recordings & Live Calls Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_recordings (
      id TEXT PRIMARY KEY,
      caller_name TEXT NOT NULL,
      caller_phone TEXT NOT NULL,
      venue TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      intent TEXT DEFAULT 'reservation',
      transcript TEXT DEFAULT '[]',
      audio_data TEXT,
      tool_calls TEXT DEFAULT '[]',
      reservation_summary TEXT,
      order_summary TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 3. Master System Prompt Control Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_prompt_config (
      id TEXT PRIMARY KEY,
      restaurant_name TEXT NOT NULL,
      tone TEXT NOT NULL,
      greeting TEXT NOT NULL,
      voice_name TEXT NOT NULL,
      voice_label TEXT NOT NULL,
      canadian_dialect INTEGER DEFAULT 1,
      venue TEXT NOT NULL,
      master_instructions TEXT NOT NULL,
      boundary_strictness INTEGER DEFAULT 1,
      green_light_enabled INTEGER DEFAULT 1,
      packed_house_policy TEXT DEFAULT 'Offer communal seating, bar seating, or waitlist. Pivot to sister venue if 100% full.',
      custom_rules TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
  `);

  // 4. Menu Matrix Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_matrix (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      price REAL NOT NULL,
      station TEXT NOT NULL,
      cook_time_minutes INTEGER NOT NULL,
      description TEXT NOT NULL,
      dietary_tags TEXT DEFAULT '[]',
      is_86 INTEGER DEFAULT 0,
      ai_description TEXT,
      venue TEXT NOT NULL
    );
  `);

  // 5. Kitchen Orders Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      timing TEXT NOT NULL,
      items TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Seed default data if empty
  seedDatabaseIfEmpty(db);

  dbInstance = db;
  return dbInstance;
}

function seedDatabaseIfEmpty(db: any) {
  // Check Seating Plan
  const seatingCount = db.prepare('SELECT COUNT(*) as count FROM seating_plan').get().count;
  if (seatingCount === 0) {
    const defaultTables = [
      { id: 'B1', label: 'Booth 1', capacity: 6, stage: 'AVAILABLE', type: 'BOOTH', table_category: 'Private', x: 6, y: 10, w: 16, h: 22, adjacent_to: '[]' },
      { id: 'B2', label: 'Booth 2', capacity: 6, stage: 'SEATED', type: 'BOOTH', table_category: 'Private', x: 6, y: 38, w: 16, h: 22, adjacent_to: '[]', occupant_name: 'Sarah Jenkins', time_elapsed: 1200 },
      { id: 'B3', label: 'Booth 3', capacity: 6, stage: 'AVAILABLE', type: 'BOOTH', table_category: 'Private', x: 6, y: 66, w: 16, h: 22, adjacent_to: '[]' },
      { id: 'T1', label: 'Table 1', capacity: 2, stage: 'AVAILABLE', type: 'TABLE', table_category: 'Private', x: 30, y: 14, w: 12, h: 14, adjacent_to: '["T2"]' },
      { id: 'T2', label: 'Table 2', capacity: 2, stage: 'AVAILABLE', type: 'TABLE', table_category: 'Private', x: 46, y: 14, w: 12, h: 14, adjacent_to: '["T1"]' },
      { id: 'T3', label: 'Table 3', capacity: 4, stage: 'APPS_FIRED', type: 'TABLE', table_category: 'Private', x: 30, y: 38, w: 13, h: 16, adjacent_to: '["T4"]', occupant_name: 'Johnson Party', time_elapsed: 2400 },
      { id: 'T4', label: 'Table 4', capacity: 4, stage: 'AVAILABLE', type: 'TABLE', table_category: 'Private', x: 46, y: 38, w: 13, h: 16, adjacent_to: '["T3"]' },
      { id: 'T5', label: 'Table 5', capacity: 8, stage: 'CHECK_DROPPED', type: 'TABLE', table_category: 'Communal', x: 30, y: 64, w: 28, h: 18, adjacent_to: '[]', occupant_name: 'Guest Party', time_elapsed: 4500 },
      { id: 'Bar1', label: 'Bar 1', capacity: 1, stage: 'SEATED', type: 'BAR', table_category: 'Bar', x: 76, y: 10, w: 9, h: 10, adjacent_to: '[]', occupant_name: 'Solo Guest', time_elapsed: 400 },
      { id: 'Bar2', label: 'Bar 2', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 23, w: 9, h: 10, adjacent_to: '[]' },
      { id: 'Bar3', label: 'Bar 3', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 36, w: 9, h: 10, adjacent_to: '[]' },
      { id: 'Bar4', label: 'Bar 4', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 49, w: 9, h: 10, adjacent_to: '[]' },
      { id: 'Bar5', label: 'Bar 5', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 62, w: 9, h: 10, adjacent_to: '[]' },
      { id: 'Bar6', label: 'Bar 6', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 75, w: 9, h: 10, adjacent_to: '[]' }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO seating_plan (id, label, capacity, stage, type, table_category, x, y, w, h, adjacent_to, occupant_name, time_elapsed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const t of defaultTables) {
      insertStmt.run(t.id, t.label, t.capacity, t.stage, t.type, t.table_category, t.x, t.y, t.w, t.h, t.adjacent_to, t.occupant_name || null, t.time_elapsed || 0, now);
    }
  }

  // Check Master Prompt Config
  const promptCount = db.prepare('SELECT COUNT(*) as count FROM master_prompt_config').get().count;
  if (promptCount === 0) {
    const insertPrompt = db.prepare(`
      INSERT INTO master_prompt_config (
        id, restaurant_name, tone, greeting, voice_name, voice_label, canadian_dialect, venue, master_instructions, boundary_strictness, green_light_enabled, packed_house_policy, custom_rules, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPrompt.run(
      'active',
      'leed pizza',
      'Lively & Casual',
      'Thanks for calling leed pizza, this is your virtual host, how can I help you today?',
      'Leda',
      'Leda - Warm Female',
      1,
      'leed pizza Main St',
      `// --- SECTION 1: OWNER'S CUSTOM PERSONA (DYNAMIC) ---
You are the virtual host for leed pizza.
Your tone is Lively & Casual.
When the call connects, you must greet the caller with exactly this sentence: "Thanks for calling leed pizza, this is your virtual host, how can I help you today?"

// --- SECTION 2: IMMUTABLE SYSTEM RULES (HARD-CODED) ---
UNDER NO CIRCUMSTANCES CAN YOU VIOLATE THE FOLLOWING RULES:
1. THE BOUNDARY RULE: You only collect intent and data. You NEVER process payments over the phone.
2. THE AVAILABILITY RULE: If a caller asks for a reservation, you MUST trigger the 'check_availability' tool first. You cannot say "yes" until the backend returns {"status": "available"}.
3. THE MENU TRUTH: You may only offer items currently listed as "available" in your context window. If an item is 86'd, you must apologize and offer an alternative.
4. THE FINAL HANDOFF: When the caller is finished, you MUST trigger the 'submit_reservation_data' or 'submit_food_order' tool to send the JSON payload to the backend. Do not hang up until this is executed.`,
      1,
      1,
      'Pivot to communal seating, bar seating, or sister venue if 100% full',
      JSON.stringify([
        "Always recommend the artisan hot honey drizzle with our pepperoni slice.",
        "Use friendly Canadian hospitality fillers ('Certainly', 'Right away', 'No problem at all').",
        "Keep voice latency minimal by responding briskly without long robotic speeches."
      ]),
      new Date().toISOString()
    );
  }

  // Check Menu Matrix
  const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_matrix').get().count;
  if (menuCount === 0) {
    const items = [
      { id: "LP_PEPPERONI", name: "Classic Pepperoni Pizza", price: 20.50, station: "Pizza Oven", cook_time: 4, desc: "Crispy cups, mozzarella, hot honey drizzle, fresh basil", tags: '["Popular"]', is_86: 0, ai_desc: "Our top seller with crispy curled pepperoni and a hint of sweetness", venue: "leed pizza Main St" },
      { id: "LP_MARGHERITA", name: "Margherita Pizza", price: 18.75, station: "Pizza Oven", cook_time: 3, desc: "San Marzano tomato sauce, fresh mozzarella, sweet basil, EVOO", tags: '["Vegetarian"]', is_86: 0, ai_desc: "Authentic Neapolitan style with fragrant Italian basil", venue: "leed pizza Main St" },
      { id: "LP_TRUFFLE_MUSHROOM", name: "Truffle Mushroom Pizza", price: 22.00, station: "Pizza Oven", cook_time: 4, desc: "Wild roasted mushrooms, fontina, white truffle oil, thyme", tags: '["Vegetarian"]', is_86: 0, ai_desc: "Earthy and decadent with creamy fontina and aromatic truffle", venue: "leed pizza Main St" },
      { id: "LP_HOT_HONEY_WINGS", name: "Hot Honey Garlic Wings", price: 16.50, station: "Fryer", cook_time: 10, desc: "Crispy double-dredged wings tossed in hot honey garlic glaze", tags: '["Gluten-Free Available"]', is_86: 0, ai_desc: "Crispy and juicy with the perfect balance of heat and sweet", venue: "leed pizza Main St" },
      { id: "LP_CAESAR_SALAD", name: "Tuscan Caesar Salad", price: 14.00, station: "Salad Pantry", cook_time: 2, desc: "Romaine hearts, shaved pecorino, sourdough crisps, house dressing", tags: '["Vegetarian"]', is_86: 0, ai_desc: "Crisp and refreshing starter salad", venue: "leed pizza Main St" },
      { id: "LP_CRAFT_IPA", name: "House Hazy IPA (Pint)", price: 8.50, station: "Bar", cook_time: 1, desc: "Fresh local draft with tropical citrus notes", tags: '["Alcohol"]', is_86: 0, ai_desc: "Pairs great with pepperoni or wings", venue: "leed pizza Main St" }
    ];

    const insertMenu = db.prepare(`
      INSERT INTO menu_matrix (id, item_name, price, station, cook_time_minutes, description, dietary_tags, is_86, ai_description, venue)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertMenu.run(item.id, item.name, item.price, item.station, item.cook_time, item.desc, item.tags, item.is_86, item.ai_desc, item.venue);
    }
  }

  // Check Voice Recordings / Calls
  const callCount = db.prepare('SELECT COUNT(*) as count FROM voice_recordings').get().count;
  if (callCount === 0) {
    const insertCall = db.prepare(`
      INSERT INTO voice_recordings (
        id, caller_name, caller_phone, venue, start_time, end_time, duration_seconds, status, intent, transcript, audio_data, tool_calls, reservation_summary, order_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleCalls = [
      {
        id: 'CALL-2026-0920-001',
        caller_name: 'Marcus Vance',
        caller_phone: '+1 (604) 555-0182',
        venue: 'leed pizza Main St',
        start_time: '2026-09-20T10:10:00.000Z',
        end_time: '2026-09-20T10:11:42.000Z',
        duration_seconds: 102,
        status: 'completed',
        intent: 'reservation',
        transcript: JSON.stringify([
          { role: 'agent', text: "Thanks for calling leed pizza, this is your virtual host, how can I help you today?", timestamp: "10:10:02" },
          { role: 'user', text: "Hi! Can I get a table for four tonight around 7:00 PM?", timestamp: "10:10:12" },
          { role: 'agent', text: "Hmm, let me check our floor plan for 7:00 PM for four guests real quick...", timestamp: "10:10:16" },
          { role: 'agent', text: "Great news! We have Table 3 in our main dining room available at 7:00 PM. May I have your name and phone number to hold that for you?", timestamp: "10:10:25" },
          { role: 'user', text: "Awesome, it's Marcus Vance, 604-555-0182.", timestamp: "10:10:38" },
          { role: 'agent', text: "Perfect Marcus! I've locked Table 3 for four guests at 7:00 PM tonight at leed pizza Main St. A confirmation text is on its way. See you soon!", timestamp: "10:10:50" }
        ]),
        tool_calls: JSON.stringify([
          { name: 'check_availability', args: { party_size: 4, target_time: '19:00', venue: 'leed pizza Main St' }, result: { status: 'available' } },
          { name: 'submit_reservation_data', args: { party_size: 4, confirmed_time: '19:00', customer_name: 'Marcus Vance', customer_phone: '+1 (604) 555-0182', venue: 'leed pizza Main St' }, result: { status: 'locked', confirmation_id: 'RES-892144' } }
        ]),
        reservation_summary: 'Confirmed 4 guests @ 7:00 PM (Table 3 locked). SMS dispatched.',
        order_summary: null,
        created_at: new Date().toISOString()
      },
      {
        id: 'CALL-2026-0920-002',
        caller_name: 'Elena Rostova',
        caller_phone: '+1 (604) 555-0199',
        venue: 'leed pizza Main St',
        start_time: '2026-09-20T10:14:00.000Z',
        end_time: '2026-09-20T10:15:30.000Z',
        duration_seconds: 90,
        status: 'completed',
        intent: 'takeout',
        transcript: JSON.stringify([
          { role: 'agent', text: "Thanks for calling leed pizza, this is your virtual host, how can I help you today?", timestamp: "10:14:02" },
          { role: 'user', text: "Hi, I'd like to place a takeout order for two Classic Pepperoni pizzas and wings.", timestamp: "10:14:14" },
          { role: 'agent', text: "Absolutely! Are you looking for ASAP pickup, or scheduled for a specific time?", timestamp: "10:14:20" },
          { role: 'user', text: "ASAP please!", timestamp: "10:14:25" },
          { role: 'agent', text: "Right away! Two Classic Pepperoni pizzas with hot honey drizzle and our Hot Honey Garlic Wings fired up for Elena. I am sending a secure checkout link to your phone right now.", timestamp: "10:14:40" }
        ]),
        tool_calls: JSON.stringify([
          { name: 'submit_food_order', args: { customer_name: 'Elena Rostova', customer_phone: '+1 (604) 555-0199', timing: 'ASAP', items: [{ item_name: 'Classic Pepperoni Pizza', quantity: 2 }, { item_name: 'Hot Honey Garlic Wings', quantity: 1 }] }, result: { status: 'paced_and_queued', order_id: 'TKT-541' } }
        ]),
        reservation_summary: null,
        order_summary: 'Takeout ASAP: 2x Classic Pepperoni, 1x Hot Honey Garlic Wings ($57.50). Paced in KDS.',
        created_at: new Date().toISOString()
      }
    ];

    for (const call of sampleCalls) {
      insertCall.run(
        call.id,
        call.caller_name,
        call.caller_phone,
        call.venue,
        call.start_time,
        call.end_time,
        call.duration_seconds,
        call.status,
        call.intent,
        call.transcript,
        null,
        call.tool_calls,
        call.reservation_summary,
        call.order_summary,
        call.created_at
      );
    }
  }
}

// Public Database APIs
export const db = {
  // Seating
  getSeatingPlan(): any[] {
    const rows = getDb().prepare('SELECT * FROM seating_plan ORDER BY id ASC').all();
    return rows.map((r: any) => ({
      ...r,
      adjacentTo: JSON.parse(r.adjacent_to || '[]')
    }));
  },

  updateTable(id: string, updates: { stage?: string; occupant_name?: string; locked_until?: number; time_elapsed?: number }): void {
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [new Date().toISOString()];

    if (updates.stage !== undefined) {
      fields.push('stage = ?');
      values.push(updates.stage);
    }
    if (updates.occupant_name !== undefined) {
      fields.push('occupant_name = ?');
      values.push(updates.occupant_name);
    }
    if (updates.locked_until !== undefined) {
      fields.push('locked_until = ?');
      values.push(updates.locked_until);
    }
    if (updates.time_elapsed !== undefined) {
      fields.push('time_elapsed = ?');
      values.push(updates.time_elapsed);
    }

    values.push(id);
    const sql = `UPDATE seating_plan SET ${fields.join(', ')} WHERE id = ?`;
    getDb().prepare(sql).run(...values);
  },

  saveSeatingPlan(tables: any[]): void {
    const database = getDb();
    const updateStmt = database.prepare(`
      INSERT INTO seating_plan (id, label, capacity, stage, type, table_category, x, y, w, h, adjacent_to, occupant_name, time_elapsed, locked_until, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label=excluded.label,
        capacity=excluded.capacity,
        stage=excluded.stage,
        type=excluded.type,
        table_category=excluded.table_category,
        x=excluded.x,
        y=excluded.y,
        w=excluded.w,
        h=excluded.h,
        adjacent_to=excluded.adjacent_to,
        occupant_name=excluded.occupant_name,
        time_elapsed=excluded.time_elapsed,
        locked_until=excluded.locked_until,
        updated_at=excluded.updated_at
    `);

    const now = new Date().toISOString();
    const currentTableIds: string[] = [];

    for (const t of tables) {
      if (!t.id) continue;
      currentTableIds.push(t.id);
      updateStmt.run(
        t.id,
        t.label,
        Number(t.capacity) || 4,
        t.stage || 'AVAILABLE',
        t.type || 'TABLE',
        t.table_category || 'Private',
        t.x,
        t.y,
        t.w,
        t.h,
        JSON.stringify(t.adjacentTo || t.adjacent_to || []),
        t.occupantName || t.occupant_name || null,
        t.timeElapsed || t.time_elapsed || 0,
        t.lockExpiresAt || t.locked_until || null,
        now
      );
    }

    if (currentTableIds.length > 0) {
      const placeholders = currentTableIds.map(() => '?').join(',');
      database.prepare(`DELETE FROM seating_plan WHERE id NOT IN (${placeholders})`).run(...currentTableIds);
    }
  },

  // Voice Recordings & Call Logs
  getCalls(limit = 50): any[] {
    const rows = getDb().prepare('SELECT * FROM voice_recordings ORDER BY start_time DESC LIMIT ?').all(limit);
    return rows.map((r: any) => ({
      ...r,
      transcript: JSON.parse(r.transcript || '[]'),
      tool_calls: JSON.parse(r.tool_calls || '[]')
    }));
  },

  getCallById(id: string): any {
    const r = getDb().prepare('SELECT * FROM voice_recordings WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...r,
      transcript: JSON.parse(r.transcript || '[]'),
      tool_calls: JSON.parse(r.tool_calls || '[]')
    };
  },

  createOrUpdateCall(call: {
    id: string;
    caller_name: string;
    caller_phone: string;
    venue: string;
    start_time: string;
    end_time?: string;
    duration_seconds?: number;
    status?: string;
    intent?: string;
    transcript?: any[];
    audio_data?: string | null;
    tool_calls?: any[];
    reservation_summary?: string;
    order_summary?: string;
  }): void {
    const database = getDb();
    const stmt = database.prepare(`
      INSERT INTO voice_recordings (
        id, caller_name, caller_phone, venue, start_time, end_time, duration_seconds, status, intent, transcript, audio_data, tool_calls, reservation_summary, order_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        caller_name=excluded.caller_name,
        caller_phone=excluded.caller_phone,
        venue=excluded.venue,
        end_time=excluded.end_time,
        duration_seconds=excluded.duration_seconds,
        status=excluded.status,
        intent=excluded.intent,
        transcript=excluded.transcript,
        audio_data=COALESCE(excluded.audio_data, voice_recordings.audio_data),
        tool_calls=excluded.tool_calls,
        reservation_summary=excluded.reservation_summary,
        order_summary=excluded.order_summary
    `);

    stmt.run(
      call.id,
      call.caller_name || 'Anonymous Guest',
      call.caller_phone || 'Private Number',
      call.venue || 'leed pizza Main St',
      call.start_time || new Date().toISOString(),
      call.end_time || null,
      call.duration_seconds || 0,
      call.status || 'completed',
      call.intent || 'reservation',
      JSON.stringify(call.transcript || []),
      call.audio_data || null,
      JSON.stringify(call.tool_calls || []),
      call.reservation_summary || null,
      call.order_summary || null,
      new Date().toISOString()
    );
  },

  // Master Prompt Config
  getMasterPrompt(): any {
    const r = getDb().prepare('SELECT * FROM master_prompt_config WHERE id = ?').get('active');
    if (!r) return null;
    return {
      ...r,
      canadian_dialect: Boolean(r.canadian_dialect),
      boundary_strictness: Boolean(r.boundary_strictness),
      green_light_enabled: Boolean(r.green_light_enabled),
      custom_rules: JSON.parse(r.custom_rules || '[]')
    };
  },

  saveMasterPrompt(config: any): void {
    const database = getDb();
    const stmt = database.prepare(`
      INSERT INTO master_prompt_config (
        id, restaurant_name, tone, greeting, voice_name, voice_label, canadian_dialect, venue, master_instructions, boundary_strictness, green_light_enabled, packed_house_policy, custom_rules, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        restaurant_name=excluded.restaurant_name,
        tone=excluded.tone,
        greeting=excluded.greeting,
        voice_name=excluded.voice_name,
        voice_label=excluded.voice_label,
        canadian_dialect=excluded.canadian_dialect,
        venue=excluded.venue,
        master_instructions=excluded.master_instructions,
        boundary_strictness=excluded.boundary_strictness,
        green_light_enabled=excluded.green_light_enabled,
        packed_house_policy=excluded.packed_house_policy,
        custom_rules=excluded.custom_rules,
        updated_at=excluded.updated_at
    `);

    stmt.run(
      'active',
      config.restaurant_name || 'leed pizza',
      config.tone || 'Lively & Casual',
      config.greeting || 'Thanks for calling leed pizza, this is your virtual host, how can I help you today?',
      config.voice_name || 'Leda',
      config.voice_label || 'Leda - Warm Female',
      config.canadian_dialect ? 1 : 0,
      config.venue || `${config.restaurant_name || 'leed pizza'} Main St`,
      config.master_instructions || '',
      config.boundary_strictness !== false ? 1 : 0,
      config.green_light_enabled !== false ? 1 : 0,
      config.packed_house_policy || 'Pivot to communal seating, bar seating, or sister venue if 100% full',
      JSON.stringify(config.custom_rules || []),
      new Date().toISOString()
    );
  },

  // Menu
  getMenuItems(): any[] {
    const rows = getDb().prepare('SELECT * FROM menu_matrix ORDER BY price DESC').all();
    return rows.map((r: any) => ({
      ...r,
      item_id: r.id,
      dietary_tags: JSON.parse(r.dietary_tags || '[]'),
      is_86: Boolean(r.is_86)
    }));
  },

  saveMenuItems(items: any[]): void {
    const database = getDb();
    const upsertStmt = database.prepare(`
      INSERT INTO menu_matrix (id, item_name, price, station, cook_time_minutes, description, dietary_tags, is_86, ai_description, venue)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        item_name = excluded.item_name,
        price = excluded.price,
        station = excluded.station,
        cook_time_minutes = excluded.cook_time_minutes,
        description = excluded.description,
        dietary_tags = excluded.dietary_tags,
        is_86 = excluded.is_86,
        ai_description = excluded.ai_description,
        venue = excluded.venue
    `);

    const currentIds: string[] = [];
    for (const item of items) {
      const id = item.item_id || item.id || `LP_ITEM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      currentIds.push(id);
      upsertStmt.run(
        id,
        item.item_name || 'Item',
        Number(item.price) || 0,
        item.station || 'Pizza Oven',
        Number(item.cook_time_minutes) || 5,
        item.description || '',
        JSON.stringify(Array.isArray(item.dietary_tags) ? item.dietary_tags : []),
        item.is_86 ? 1 : 0,
        item.ai_description || null,
        item.venue || 'leed pizza Main St'
      );
    }

    if (currentIds.length > 0) {
      const placeholders = currentIds.map(() => '?').join(',');
      database.prepare(`DELETE FROM menu_matrix WHERE id NOT IN (${placeholders})`).run(...currentIds);
    }
  },

  toggleMenuItem86(id: string, is_86: boolean): void {
    getDb().prepare('UPDATE menu_matrix SET is_86 = ? WHERE id = ?').run(is_86 ? 1 : 0, id);
  }
};
