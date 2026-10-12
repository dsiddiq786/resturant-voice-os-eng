import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureReservationSchema,
  parseTimeToMinutes,
  checkAvailability,
  createReservation,
  findReservations,
  modifyReservation,
  cancelReservation,
  todayISO,
} from '../lib/reservations.mjs';

const VENUE = 'Test Venue';
const TABLES = [
  { id: 'T1', label: 'Table 1', capacity: 2, type: 'TABLE', table_category: 'Private' },
  { id: 'B1', label: 'Booth 1', capacity: 6, type: 'BOOTH', table_category: 'Private' },
  { id: 'BAR1', label: 'Bar 1', capacity: 1, type: 'BAR', table_category: 'Bar' },
];

// A fixed "now" well before the bookings, so today-specific rules don't interfere.
const NOW = new Date(2030, 0, 10, 12, 0, 0);
const DATE = '2030-01-15';

function ctxFor(db, now = NOW) {
  return { db, venue: VENUE, tables: TABLES, now };
}

function freshDb() {
  const db = new DatabaseSync(':memory:');
  ensureReservationSchema(db);
  return db;
}

const guest = (overrides = {}) => ({
  customer_name: 'Ava Chen',
  customer_phone: '604-555-0142',
  party_size: 2,
  date: DATE,
  time: '19:00',
  ...overrides,
});

test('parses 24h, 12h and rejects ambiguous bare hours', () => {
  assert.equal(parseTimeToMinutes('19:30'), 19 * 60 + 30);
  assert.equal(parseTimeToMinutes('7:30 PM'), 19 * 60 + 30);
  assert.equal(parseTimeToMinutes('12am'), 0);
  assert.equal(parseTimeToMinutes('7'), null);
  assert.equal(parseTimeToMinutes('25:00'), null);
  assert.equal(parseTimeToMinutes('soon'), null);
});

test('creates a confirmed reservation and persists it to the database', () => {
  const db = freshDb();
  const result = createReservation(ctxFor(db), guest());
  assert.equal(result.status, 'confirmed');
  assert.match(result.reservation.confirmation_code, /^[A-Z2-9]{6}$/);
  assert.equal(result.reservation.phone_on_file, '***-0142');
  const rows = db.prepare('SELECT * FROM reservations').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].table_id, 'T1');
});

test('rejects invalid input without writing anything', () => {
  const db = freshDb();
  assert.equal(createReservation(ctxFor(db), guest({ party_size: 0 })).status, 'invalid');
  assert.equal(createReservation(ctxFor(db), guest({ customer_phone: '12' })).status, 'invalid');
  assert.equal(createReservation(ctxFor(db), guest({ time: '7' })).status, 'invalid');
  assert.equal(createReservation(ctxFor(db), guest({ date: '2029-12-31' })).status, 'invalid');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reservations').get().n, 0);
});

test('blocks a second booking for the same phone on the same date', () => {
  const db = freshDb();
  createReservation(ctxFor(db), guest());
  const second = createReservation(ctxFor(db), guest({ time: '20:00' }));
  assert.equal(second.status, 'duplicate');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reservations').get().n, 1);
});

test('reports fully booked times with alternatives and never overbooks', () => {
  const db = freshDb();
  createReservation(ctxFor(db), guest({ customer_phone: '6045550001', party_size: 6, time: '19:00' }));
  const blocked = checkAvailability(ctxFor(db), { party_size: 6, date: DATE, time: '19:30' });
  assert.equal(blocked.status, 'unavailable');
  assert.equal(blocked.reason, 'fully_booked_at_time');
  assert.ok(blocked.alternatives.length > 0);
  assert.ok(!blocked.alternatives.includes('19:30'));

  const impossible = checkAvailability(ctxFor(db), { party_size: 9, date: DATE, time: '19:00' });
  assert.equal(impossible.reason, 'no_table_fits_party');
});

test('keeps bar stools for solo guests only', () => {
  const db = freshDb();
  const solo = checkAvailability(ctxFor(db), { party_size: 1, date: DATE, time: '19:00' });
  assert.equal(solo.table_id, 'BAR1');
  const pair = checkAvailability(ctxFor(db), { party_size: 2, date: DATE, time: '19:00' });
  assert.notEqual(pair.table_id, 'BAR1');
});

test('finds a reservation by code plus phone, and by phone plus name', () => {
  const db = freshDb();
  const { reservation } = createReservation(ctxFor(db), guest());
  const byCode = findReservations(ctxFor(db), {
    confirmation_code: reservation.confirmation_code,
    customer_phone: '604-555-0142',
  });
  assert.equal(byCode.status, 'found');
  const byName = findReservations(ctxFor(db), { customer_phone: '6045550142', customer_name: 'ava chen' });
  assert.equal(byName.reservations.length, 1);
  const wrongPhone = findReservations(ctxFor(db), {
    confirmation_code: reservation.confirmation_code,
    customer_phone: '604-555-9999',
  });
  assert.equal(wrongPhone.status, 'not_found');
});

test('modifies a booking, excluding itself from the availability check', () => {
  const db = freshDb();
  const { reservation } = createReservation(ctxFor(db), guest({ party_size: 2, time: '19:00' }));
  const moved = modifyReservation(ctxFor(db), {
    confirmation_code: reservation.confirmation_code,
    customer_phone: '604-555-0142',
    time: '19:30',
    party_size: 3,
  });
  assert.equal(moved.status, 'modified');
  assert.equal(moved.reservation.time, '19:30');
  assert.equal(moved.reservation.party_size, 3);
  assert.equal(db.prepare('SELECT reservation_time FROM reservations').get().reservation_time, '19:30');
});

test('refuses to modify or cancel without the matching phone number', () => {
  const db = freshDb();
  const { reservation } = createReservation(ctxFor(db), guest());
  const code = reservation.confirmation_code;
  assert.equal(modifyReservation(ctxFor(db), { confirmation_code: code, customer_phone: '6045559999', time: '20:00' }).status, 'not_found');
  assert.equal(cancelReservation(ctxFor(db), { confirmation_code: code, customer_phone: '6045559999' }).status, 'not_found');
  assert.equal(db.prepare('SELECT status FROM reservations').get().status, 'CONFIRMED');
});

test('cancels a booking, frees the table, and does not cancel twice', () => {
  const db = freshDb();
  const { reservation } = createReservation(ctxFor(db), guest({ party_size: 6 }));
  const code = reservation.confirmation_code;
  assert.equal(cancelReservation(ctxFor(db), { confirmation_code: code, customer_phone: '604-555-0142' }).status, 'cancelled');
  assert.equal(cancelReservation(ctxFor(db), { confirmation_code: code, customer_phone: '604-555-0142' }).status, 'not_active');
  const reused = checkAvailability(ctxFor(db), { party_size: 6, date: DATE, time: '19:00' });
  assert.equal(reused.status, 'available');
});

test('persists bookings across a reopened database file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'resv-'));
  try {
    const path = join(dir, 'leed_pizza.db');
    const first = new DatabaseSync(path);
    ensureReservationSchema(first);
    const { reservation } = createReservation(ctxFor(first), guest());
    first.close();

    const second = new DatabaseSync(path);
    const found = findReservations(ctxFor(second), {
      confirmation_code: reservation.confirmation_code,
      customer_phone: '604-555-0142',
    });
    assert.equal(found.status, 'found');
    assert.equal(found.reservations[0].time, '19:00');
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects dates and times that have already passed today', () => {
  const db = freshDb();
  const today = todayISO(NOW);
  const result = checkAvailability(ctxFor(db, new Date(2030, 0, 10, 12, 0)), { party_size: 2, date: today, time: '11:00' });
  assert.equal(result.status, 'invalid');
});
