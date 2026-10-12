// Local reservation engine for the Leed Pizza demo.
// Plain ES module so server.mjs and node:test can both import it.
// All reads and writes go through the caller's node:sqlite DatabaseSync handle.

import { randomInt } from 'crypto';

export const MAX_PARTY_SIZE = 20;
export const SEATING_MINUTES = 90;
export const MAX_DAYS_AHEAD = 90;
const SEARCH_STEP_MINUTES = 15;
const SEARCH_WINDOW_MINUTES = 120;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function ensureReservationSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      confirmation_code TEXT NOT NULL UNIQUE,
      venue TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      reservation_date TEXT NOT NULL,
      reservation_time TEXT NOT NULL,
      table_id TEXT,
      special_requests TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reservations_slot
      ON reservations (venue, reservation_date, status);
  `);
}

// Accepts "19:30", "7:30 pm", "7pm". A bare hour without am/pm or minutes is
// rejected so the agent asks the caller to clarify instead of guessing.
export function parseTimeToMinutes(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase().replace(/\./g, '');
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const meridiem = m[3];
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else {
    if (!m[2]) return null;
    if (hour > 23) return null;
  }
  return hour * 60 + minute;
}

export function minutesToTime(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

function maskPhone(digits) {
  return `***-${digits.slice(-4)}`;
}

function normalizeRequest({ party_size, partySize, date, time }, now) {
  const size = Number(party_size ?? partySize);
  if (!Number.isInteger(size) || size < 1 || size > MAX_PARTY_SIZE) {
    return { error: `Party size must be a whole number from 1 to ${MAX_PARTY_SIZE}.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    return { error: 'The reservation date is required.' };
  }
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) {
    return { error: 'The reservation time is required, for example 19:30 or 7:30 PM.' };
  }
  const today = todayISO(now);
  if (date < today) return { error: 'That date has already passed.' };
  if (date > addDays(today, MAX_DAYS_AHEAD)) {
    return { error: `Reservations can be made up to ${MAX_DAYS_AHEAD} days ahead.` };
  }
  if (date === today && minutes < now.getHours() * 60 + now.getMinutes()) {
    return { error: 'That time has already passed today.' };
  }
  return { size, date, minutes, time: minutesToTime(minutes) };
}

// Tables that can seat the party, smallest fit first. Bar stools only seat solo guests.
function eligibleTables(tables, partySize) {
  return (tables || [])
    .filter(t => Number(t.capacity) >= partySize)
    .filter(t => partySize === 1 || !(t.type === 'BAR' || t.table_category === 'Bar'))
    .sort((a, b) => Number(a.capacity) - Number(b.capacity));
}

function pickTable(ctx, { partySize, date, minutes, excludeId }) {
  const booked = ctx.db.prepare(
    `SELECT id, table_id, reservation_time FROM reservations
     WHERE venue = ? AND reservation_date = ? AND status = 'CONFIRMED' AND id <> ?`
  ).all(ctx.venue, date, excludeId || '');

  for (const table of eligibleTables(ctx.tables, partySize)) {
    const clash = booked.some(b =>
      b.table_id === table.id &&
      Math.abs(parseTimeToMinutes(b.reservation_time) - minutes) < SEATING_MINUTES
    );
    if (!clash) return table;
  }
  return null;
}

function findAlternatives(ctx, req) {
  const today = todayISO(ctx.now);
  const nowMinutes = ctx.now.getHours() * 60 + ctx.now.getMinutes();
  const found = [];
  for (let offset = SEARCH_STEP_MINUTES; offset <= SEARCH_WINDOW_MINUTES && found.length < 3; offset += SEARCH_STEP_MINUTES) {
    for (const minutes of [req.minutes - offset, req.minutes + offset]) {
      if (found.length >= 3) break;
      if (minutes < 0 || minutes >= 24 * 60) continue;
      if (req.date === today && minutes < nowMinutes) continue;
      if (pickTable(ctx, { partySize: req.size, date: req.date, minutes, excludeId: ctx.excludeId })) {
        found.push(minutesToTime(minutes));
      }
    }
  }
  return found;
}

function summarize(row) {
  return {
    confirmation_code: row.confirmation_code,
    customer_name: row.customer_name,
    phone_on_file: maskPhone(row.customer_phone),
    party_size: row.party_size,
    date: row.reservation_date,
    time: row.reservation_time,
    special_requests: row.special_requests || '',
    status: row.status,
  };
}

function uniqueCode(db) {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    const clash = db.prepare('SELECT 1 FROM reservations WHERE confirmation_code = ?').get(code);
    if (!clash) return code;
  }
  throw new Error('Could not allocate a confirmation code');
}

function loadByCode(db, code) {
  return db.prepare('SELECT * FROM reservations WHERE confirmation_code = ?')
    .get(String(code || '').trim().toUpperCase()) || null;
}

// Returns a result object for every input. Never throws for bad caller input.
export function checkAvailability(ctx, input) {
  const req = normalizeRequest(input, ctx.now);
  if (req.error) return { status: 'invalid', message: req.error };

  const table = pickTable(ctx, { partySize: req.size, date: req.date, minutes: req.minutes, excludeId: ctx.excludeId });
  if (table) {
    return {
      status: 'available',
      date: req.date,
      time: req.time,
      party_size: req.size,
      table_id: table.id,
      table_label: table.label || table.id,
    };
  }
  const largest = Math.max(0, ...eligibleTables(ctx.tables, 1).map(t => Number(t.capacity) || 0));
  return {
    status: 'unavailable',
    date: req.date,
    time: req.time,
    party_size: req.size,
    reason: req.size > largest ? 'no_table_fits_party' : 'fully_booked_at_time',
    alternatives: findAlternatives(ctx, req),
  };
}

export function createReservation(ctx, input) {
  const name = String(input.customer_name || '').trim();
  if (name.length < 2 || name.length > 80) return { status: 'invalid', message: 'The customer name is required.' };
  const phone = normalizePhone(input.customer_phone);
  if (!phone) return { status: 'invalid', message: 'A valid phone number is required.' };
  const req = normalizeRequest(input, ctx.now);
  if (req.error) return { status: 'invalid', message: req.error };

  const duplicate = ctx.db.prepare(
    `SELECT * FROM reservations WHERE venue = ? AND customer_phone = ? AND reservation_date = ? AND status = 'CONFIRMED' LIMIT 1`
  ).get(ctx.venue, phone, req.date);
  if (duplicate) {
    return {
      status: 'duplicate',
      message: 'This phone number already has a confirmed booking on that date. Offer to modify it instead.',
      reservation: summarize(duplicate),
    };
  }

  const availability = checkAvailability(ctx, input);
  if (availability.status !== 'available') return availability;

  const now = new Date().toISOString();
  const row = {
    id: `RES-${Date.now()}-${randomInt(1000)}`,
    confirmation_code: uniqueCode(ctx.db),
    venue: ctx.venue,
    customer_name: name,
    customer_phone: phone,
    party_size: req.size,
    reservation_date: req.date,
    reservation_time: req.time,
    table_id: availability.table_id,
    special_requests: String(input.special_requests || '').trim().slice(0, 300),
    status: 'CONFIRMED',
    created_at: now,
    updated_at: now,
  };
  ctx.db.prepare(`
    INSERT INTO reservations (id, confirmation_code, venue, customer_name, customer_phone, party_size,
      reservation_date, reservation_time, table_id, special_requests, status, created_at, updated_at)
    VALUES (@id, @confirmation_code, @venue, @customer_name, @customer_phone, @party_size,
      @reservation_date, @reservation_time, @table_id, @special_requests, @status, @created_at, @updated_at)
  `).run(row);

  return { status: 'confirmed', reservation: summarize(row), table_label: availability.table_label };
}

// Caller must prove ownership: a confirmation code plus the phone it was booked under,
// or a phone plus name lookup. Results never include another guest's details.
export function findReservations(ctx, input) {
  const phone = normalizePhone(input.customer_phone);
  if (input.confirmation_code) {
    const row = loadByCode(ctx.db, input.confirmation_code);
    if (!row || !phone || row.customer_phone !== phone) {
      return { status: 'not_found', message: 'No reservation matches that code and phone number.' };
    }
    return { status: 'found', reservations: [summarize(row)] };
  }
  const name = String(input.customer_name || '').trim().toLowerCase();
  if (!phone || name.length < 2) {
    return { status: 'invalid', message: 'Ask for the confirmation code, or for the phone number and name on the booking.' };
  }
  const rows = ctx.db.prepare(
    `SELECT * FROM reservations WHERE venue = ? AND customer_phone = ? AND LOWER(customer_name) = ?
     AND status = 'CONFIRMED' AND reservation_date >= ? ORDER BY reservation_date, reservation_time LIMIT 5`
  ).all(ctx.venue, phone, name, todayISO(ctx.now));
  if (rows.length === 0) return { status: 'not_found', message: 'No upcoming reservation matches those details.' };
  return { status: 'found', reservations: rows.map(summarize) };
}

function ownedActiveRow(ctx, input) {
  const phone = normalizePhone(input.customer_phone);
  const row = loadByCode(ctx.db, input.confirmation_code);
  if (!row || !phone || row.customer_phone !== phone) {
    return { error: { status: 'not_found', message: 'No reservation matches that code and phone number.' } };
  }
  if (row.status !== 'CONFIRMED') {
    return { error: { status: 'not_active', message: `That reservation is already ${row.status.toLowerCase()}.` } };
  }
  return { row };
}

export function modifyReservation(ctx, input) {
  const owned = ownedActiveRow(ctx, input);
  if (owned.error) return owned.error;
  const { row } = owned;

  const merged = {
    party_size: input.party_size ?? row.party_size,
    date: input.date ?? row.reservation_date,
    time: input.time ?? row.reservation_time,
  };
  const availability = checkAvailability({ ...ctx, excludeId: row.id }, merged);
  if (availability.status !== 'available') return availability;

  const updatedAt = new Date().toISOString();
  const specialRequests = input.special_requests !== undefined
    ? String(input.special_requests).trim().slice(0, 300)
    : row.special_requests;
  ctx.db.prepare(`
    UPDATE reservations SET party_size = ?, reservation_date = ?, reservation_time = ?, table_id = ?,
      special_requests = ?, updated_at = ? WHERE id = ?
  `).run(availability.party_size, availability.date, availability.time, availability.table_id,
    specialRequests, updatedAt, row.id);

  const updated = loadByCode(ctx.db, row.confirmation_code);
  return { status: 'modified', reservation: summarize(updated), table_label: availability.table_label };
}

export function cancelReservation(ctx, input) {
  const owned = ownedActiveRow(ctx, input);
  if (owned.error) return owned.error;
  ctx.db.prepare(`UPDATE reservations SET status = 'CANCELLED', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), owned.row.id);
  return { status: 'cancelled', reservation: summarize({ ...owned.row, status: 'CANCELLED' }) };
}
