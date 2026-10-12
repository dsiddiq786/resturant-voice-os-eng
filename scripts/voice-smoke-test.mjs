// End-to-end voice test against the running server and the real Gemini Live model.
// Synthesises caller speech with macOS `say`, converts it to 16 kHz PCM with `afconvert`,
// and streams it through /api/live exactly like the browser does (2048-sample chunks, real time).
//
// Usage: node scripts/voice-smoke-test.mjs [booking|calls|info] [ws://localhost:3000/api/live]
// Requires macOS (say, afconvert) and GEMINI_API_KEY configured for the server.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const SCENARIOS = {
  booking: [
    "Hi, I'd like to book a table for two people tomorrow at 7 PM.",
    'My name is Jordan Lee, and my phone number is 6 0 4, 5 5 5, 0 1 7 7.',
    "Yes, that's all correct. Please book it.",
    'Actually, could you move that reservation to 8 PM instead?',
    'Yes, please go ahead.',
    'Could you also book a second table for tomorrow at 9 PM, same name and number?',
    'Okay, never mind. Please cancel my reservation instead.',
    "Yes, I'm sure. Please cancel it.",
  ],
  calls: [
    'Hi, is this the dental clinic? I need to book a teeth cleaning.',
    "Sorry, wrong place. Actually, I'm calling from Fresh Valley Produce. I'd like to talk to whoever buys your vegetables.",
    'Sure, my name is Sam Ortiz and my number is 6 0 4, 5 5 5, 0 1 9 0.',
    'Also, what time do you close tonight?',
    'Can I speak to a manager please? I had a problem with my last order.',
  ],
  info: [
    'How much is the margherita pizza?',
    'Do you have anything vegetarian?',
    'Is the truffle mushroom pizza gluten free?',
  ],
};

const scenario = process.argv[2] || 'booking';
const url = process.argv[3] || 'ws://localhost:3000/api/live?venue=&voice=';
const lines = SCENARIOS[scenario];
if (!lines) {
  console.error(`Unknown scenario "${scenario}". Use one of: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

const CHUNK = 2048;
const CHUNK_MS = (CHUNK / 16000) * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function synthesize(text, dir, i) {
  const aiff = join(dir, `u${i}.aiff`);
  const wav = join(dir, `u${i}.wav`);
  execFileSync('say', ['-o', aiff, text]);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav]);
  const buf = readFileSync(wav);
  // Walk RIFF chunks to the PCM "data" chunk.
  let off = 12;
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') return buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  throw new Error('No PCM data chunk in synthesized audio');
}

const dir = mkdtempSync(join(tmpdir(), 'voice-smoke-'));
const utterances = lines.map((text, i) => ({ text, pcm: synthesize(text, dir, i) }));
rmSync(dir, { recursive: true, force: true });

const t0 = Date.now();
const rel = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
let lastMessageAt = Date.now();
let turnCompletes = 0;
let agentText = '';
let callerText = '';
let firstAudioAt = 0;
let firstToolAt = 0;
let audioChunks = 0;
const turnLog = [];

const ws = new WebSocket(url);

ws.on('message', raw => {
  const msg = JSON.parse(String(raw));
  lastMessageAt = Date.now();
  if (msg.audio) {
    audioChunks++;
    if (!firstAudioAt) firstAudioAt = Date.now();
  }
  if (msg.transcript?.role === 'agent') agentText += msg.transcript.text;
  if (msg.transcript?.role === 'caller') callerText += msg.transcript.text;
  if (msg.activity) {
    if (msg.activity.phase === 'started' && !firstToolAt) firstToolAt = Date.now();
    turnLog.push(`  [${rel()}] activity ${msg.activity.tool} ${msg.activity.phase}${msg.activity.status ? ` -> ${msg.activity.status}` : ''}${msg.activity.detail ? ` ${JSON.stringify(msg.activity.detail)}` : ''}`);
  }
  if (msg.turnComplete) turnCompletes++;
  if (msg.interrupted) turnLog.push(`  [${rel()}] interrupted`);
  if (msg.error) turnLog.push(`  [${rel()}] ERROR ${msg.error}`);
});

function flushTurn(label, speechEndedAt) {
  console.log(`\n=== ${label}`);
  if (callerText.trim()) console.log(`  caller (as heard by Gemini): ${callerText.trim()}`);
  turnLog.forEach(l => console.log(l));
  console.log(`  agent: ${agentText.trim() || '(no transcript)'}`);
  if (firstAudioAt && speechEndedAt) console.log(`  first agent audio ${firstAudioAt - speechEndedAt} ms after caller stopped`);
  if (firstToolAt) {
    console.log(firstAudioAt && firstAudioAt < firstToolAt
      ? `  agent spoke ${firstToolAt - firstAudioAt} ms before the first tool call (acknowledgment)`
      : '  agent did NOT speak before the first tool call');
  }
  console.log(`  audio chunks: ${audioChunks}`);
  agentText = ''; callerText = ''; firstAudioAt = 0; firstToolAt = 0; audioChunks = 0; turnLog.length = 0;
}

async function waitForSettle(minTurns, timeoutMs) {
  const start = Date.now();
  const startTurns = turnCompletes;
  while (Date.now() - start < timeoutMs) {
    if (turnCompletes - startTurns >= minTurns && Date.now() - lastMessageAt > 3000) return true;
    await sleep(200);
  }
  return false;
}

// Like an open microphone: when the caller is not speaking, keep sending silence continuously.
let speaking = false;
const ZERO = Buffer.alloc(CHUNK * 2).toString('base64');
let pump = null;
function startSilencePump() {
  pump = setInterval(() => {
    if (!speaking && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ audio: ZERO }));
  }, CHUNK_MS);
}

async function stream(pcm) {
  speaking = true;
  for (let off = 0; off < pcm.length; off += CHUNK * 2) {
    const slice = Buffer.alloc(CHUNK * 2);
    pcm.copy(slice, 0, off, Math.min(off + CHUNK * 2, pcm.length));
    ws.send(JSON.stringify({ audio: slice.toString('base64') }));
    await sleep(CHUNK_MS);
  }
  speaking = false;
}

async function silence(ms) {
  await sleep(ms); // the pump is already sending silence
}

ws.on('open', async () => {
  console.log(`Connected (${scenario}) at ${rel()}`);
  startSilencePump();
  // Keep a trickle of silence flowing while the greeting plays, like an open microphone.
  const greeted = waitForSettle(1, 20000);
  await silence(1500);
  if (!(await greeted)) console.log('  (no greeting turnComplete within 20s)');
  flushTurn('Greeting');

  for (const u of utterances) {
    console.log(`\n>>> caller says: "${u.text}"`);
    await stream(u.pcm);
    const ended = Date.now();
    const settled = waitForSettle(1, 45000);
    await silence(1500);
    const ok = await settled;
    flushTurn(ok ? 'Agent reply' : 'Agent reply (timed out waiting)', ended);
  }
  ws.close();
});

ws.on('close', () => {
  if (pump) clearInterval(pump);
  console.log(`\nClosed at ${rel()}`);
  process.exit(0);
});
ws.on('error', e => {
  console.error('WebSocket error:', e.message);
  process.exit(1);
});
