'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Phone, PhoneOff, Mic, MicOff, MessageSquareText, CalendarCheck } from 'lucide-react';
import SiteNav, { ArrowChip, BrandMark } from '@/components/brand/SiteNav';
import { PRODUCT_NAME } from '@/components/brand/product';
import VoiceOrb, { type OrbMode } from '@/components/brand/VoiceOrb';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { useVoiceCall, type ActivityEntry, type CallPhase, type TranscriptEntry, type ConfirmedBooking } from '@/components/concierge/useVoiceCall';

// ---------- formatting ----------
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
function time12(hhmm?: string) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
const dateShort = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : '');

// ---------- what the agent is doing, from real tool events ----------
const WORKING: Record<string, string> = {
  check_availability: 'Checking tables',
  submit_reservation_data: 'Booking your table',
  find_reservation: 'Finding your booking',
  modify_reservation: 'Updating booking',
  cancel_reservation: 'Cancelling booking',
  request_staff_callback: 'Requesting a callback',
  submit_food_order: 'Sending order to kitchen',
};

type Tone = 'ok' | 'warn' | 'bad';
function outcome(e: ActivityEntry): { text: string; tone: Tone } {
  const s = e.status, d = e.detail || {};
  if (s === 'error') return { text: 'System unavailable', tone: 'bad' };
  if (s === 'awaiting_confirmation') return { text: 'Waiting for your yes', tone: 'warn' };
  if (s === 'pending') return { text: 'Still checking', tone: 'warn' };
  switch (e.tool) {
    case 'check_availability':
      if (s === 'available') return { text: `Free at ${time12(d.time)}`, tone: 'ok' };
      if (s === 'unavailable') return { text: `Full at ${time12(d.time)}`, tone: 'warn' };
      return { text: 'Needs details', tone: 'warn' };
    case 'submit_reservation_data':
      if (s === 'confirmed') return { text: `Confirmed · ${d.code}`, tone: 'ok' };
      if (s === 'duplicate') return { text: 'Already booked', tone: 'warn' };
      if (s === 'unavailable') return { text: 'Time taken', tone: 'warn' };
      return { text: 'Needs details', tone: 'warn' };
    case 'find_reservation':
      return s === 'found' ? { text: `Found ${d.count}`, tone: 'ok' } : { text: 'Not found', tone: 'warn' };
    case 'modify_reservation':
      return s === 'modified' ? { text: `Moved to ${time12(d.time)}`, tone: 'ok' } : { text: 'Not changed', tone: 'warn' };
    case 'cancel_reservation':
      return s === 'cancelled' ? { text: 'Cancelled', tone: 'ok' } : { text: 'Not cancelled', tone: 'warn' };
    case 'request_staff_callback':
      return { text: 'Recorded', tone: 'ok' };
    case 'submit_food_order':
      return { text: 'Sent', tone: 'ok' };
    default:
      return { text: 'Done', tone: 'ok' };
  }
}

function statusLine(state: string, phase: CallPhase, pending?: ActivityEntry) {
  if (state === 'connecting') return 'Connecting';
  if (state === 'ended') return 'Call ended';
  if (phase === 'waiting' && pending) return pending.phase === 'slow' ? 'Still checking with the booking system' : `${WORKING[pending.tool] || 'Working on it'}`;
  if (phase === 'thinking') return 'Thinking';
  if (phase === 'speaking') return 'Speaking';
  return 'Listening';
}

// ---------- live waveform driven by the real mic and speaker levels ----------
function LiveWave({ active, inputLevelRef, outputLevelRef }: {
  active: 'agent' | 'caller' | 'none';
  inputLevelRef: React.MutableRefObject<number>;
  outputLevelRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = Array.from(el.children) as HTMLSpanElement[];
    const t0 = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      const a = activeRef.current;
      const level = a === 'agent' ? Math.min(1, outputLevelRef.current * 5) : a === 'caller' ? Math.min(1, inputLevelRef.current * 10) : 0;
      bars.forEach((b, i) => {
        const shape = Math.abs(Math.sin(t * 8 + i * 0.55) * Math.sin(t * 2.3 + i * 0.21));
        b.style.transform = `scaleY(${(0.06 + shape * level * 0.94).toFixed(3)})`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inputLevelRef, outputLevelRef]);
  return (
    <div ref={ref} className="lp-wave" data-active={active} aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => <span key={i} />)}
    </div>
  );
}

function Steps({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-[var(--ink-line)] pt-5">
      {items.map(item => {
        if (item.phase !== 'completed') {
          return (
            <span key={item.id} className="lp-step" data-s={item.phase === 'slow' ? 'slow' : 'working'}>
              {WORKING[item.tool] || item.tool}
              <b>{item.phase === 'slow' ? 'Still checking' : 'Working'}</b>
            </span>
          );
        }
        const r = outcome(item);
        return (
          <span key={item.id} className="lp-step" data-s={r.tone}>
            {WORKING[item.tool] || item.tool}
            <b>{r.text}</b>
          </span>
        );
      })}
    </div>
  );
}

function Transcript({ items, agentName }: { items: TranscriptEntry[]; agentName: string }) {
  if (items.length === 0) {
    return <p className="pt-2 text-[15px] text-[var(--on-ink-muted)]">The conversation appears here as you talk. {agentName}&rsquo;s turns are on the left, yours on the right.</p>;
  }
  return (
    <>
      {items.map(e => (
        <div key={e.id} className={`lp-msg ${e.role === 'agent' ? 'agent' : 'caller'}`}>
          <span className="who">{e.role === 'agent' ? agentName : 'You'}</span>
          <p>{e.text.trim()}</p>
        </div>
      ))}
    </>
  );
}

function BookingCard({ booking }: { booking: ConfirmedBooking }) {
  return (
    <div className="lp-enter flex items-center gap-4 rounded-2xl border border-[rgba(127,216,255,0.45)] bg-[rgba(127,216,255,0.07)] px-4 py-3.5">
      <span className="lp-round h-10 w-10 bg-[var(--ion)] text-[var(--ink)]"><CalendarCheck size={18} /></span>
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'} · {dateShort(booking.date)} · {time12(booking.time)}</p>
        <p className="lp-label text-[var(--on-ink-muted)]">Confirmation <span className="text-[var(--ion)]">{booking.confirmation_code}</span></p>
      </div>
    </div>
  );
}

// ---------- page ----------
export default function Concierge() {
  const { ownerConfig } = useOwnerConfig();
  const restaurant = ownerConfig.restaurant_name || 'Leed Pizza';
  const agent = PRODUCT_NAME;
  const venue = ownerConfig.venue || `${restaurant} Main St`;
  const voice = ownerConfig.voice_name || 'Leda';
  const call = useVoiceCall({ venue, voice });
  const inCall = call.state !== 'idle';
  const panelRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const pending = useMemo(() => [...call.activity].reverse().find(a => a.phase !== 'completed'), [call.activity]);
  const orbMode: OrbMode =
    call.state === 'idle' ? 'idle' : call.state === 'connecting' ? 'connecting' : call.state === 'ended' ? 'ended' : call.phase;
  const status = statusLine(call.state, call.phase, pending);
  const waveActive = call.state !== 'active' ? 'none' : call.phase === 'speaking' ? 'agent' : call.phase === 'listening' ? 'caller' : 'none';

  // Scroll reveals for the landing page.
  useEffect(() => {
    if (inCall) return;
    const els = Array.from(document.querySelectorAll('.lp-reveal'));
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [inCall]);

  useEffect(() => {
    if (inCall) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [inCall]);

  // Keep the transcript pinned to the newest line inside its own scroll area.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [call.transcript]);

  const talkButton = (
    <button type="button" onClick={call.start} className="lp-btn lp-btn-primary lp-btn-sm">
      Talk now<ArrowChip />
    </button>
  );

  return (
    <div className="lp-dark relative min-h-dvh overflow-x-clip">
      <VoiceOrb mode={orbMode} layout={inCall ? 'call' : 'hero'} inputLevelRef={call.inputLevelRef} outputLevelRef={call.outputLevelRef} />
      <div className="lp-grain" aria-hidden="true" />
      <SiteNav action={inCall ? null : talkButton} />

      {!inCall ? (
        <main className="relative z-[1]">
          {/* ---------------- Hero ---------------- */}
          <section className="relative flex min-h-[100svh] items-center overflow-x-clip pb-[72px] pt-[120px] max-[1000px]:items-end">
            <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(8,11,18,0)_25%,rgba(8,11,18,.9)_62%)] max-[1000px]:block" aria-hidden="true" />
            <div className="lp-wrap relative grid w-full grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center gap-8 max-[1000px]:grid-cols-1">
              <div>
                <div className="lp-pill-tag lp-fade-up mb-7"><b><i className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--ion)]" />Live</b>{agent} · AI host for {restaurant}</div>
                <h1 className="lp-display mb-7 text-[clamp(3.4rem,7.4vw,7rem)]">
                  <span className="lp-line"><span>Every call,</span></span>
                  <span className="lp-line"><span><span className="lp-grad">answered.</span></span></span>
                </h1>
                <p className="lp-fade-up lp-d1 mb-10 max-w-[36ch] text-[clamp(1.08rem,1.35vw,1.22rem)] leading-[1.55] text-[var(--on-ink-2)]">
                  Meet {agent}, our AI host. Talk like you would to a person: {agent} books, moves and cancels tables, answers menu questions, and hands anything tricky to the team.
                </p>
                <div className="lp-fade-up lp-d2 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={call.start} className="lp-btn lp-btn-primary">
                    Talk to {agent}
                    <span className="lp-chip" aria-hidden="true"><Phone size={16} /><Phone size={16} /></span>
                  </button>
                  <a href="#how" className="lp-btn lp-btn-ghost">
                    <span className="lp-bars" aria-hidden="true"><i /><i /><i /><i /></span>
                    How it works
                  </a>
                </div>
                <p className="lp-fade-up lp-d3 mt-6 text-[13.5px] text-[var(--on-ink-muted)]">Uses your microphone. Calls are logged for the restaurant team.</p>
                {call.error && <p role="alert" className="mt-4 max-w-md text-[14.5px] text-[#ff9c8a]">{call.error}</p>}
              </div>
              <div className="h-[min(64vh,580px)] max-[1000px]:hidden" aria-hidden="true" />
            </div>
          </section>

          {/* ---------------- What it handles ---------------- */}
          <div className="lp-sheet" id="how">
            <section className="lp-wrap pb-24 pt-28 max-[700px]:pt-20">
              <div className="lp-reveal mb-12 flex flex-wrap items-end justify-between gap-8">
                <h2 className="lp-h2 max-w-[15ch]">Everything a great host does on the phone.</h2>
                <p className="lp-muted max-w-[34ch] text-[17px]">One natural conversation. No hold music, no menus to press through, and nothing it can&rsquo;t back up.</p>
              </div>
              <div className="lp-bento">
                <article className="lp-cell lp-cell-a lp-reveal">
                  <div className="art" aria-hidden="true">
                    <svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice">
                      <defs><linearGradient id="lpTrace" x1="0" x2="1"><stop offset="0" stopColor="#3B63FF" stopOpacity=".2" /><stop offset="1" stopColor="#7FD8FF" stopOpacity=".75" /></linearGradient></defs>
                      <g fill="none" stroke="url(#lpTrace)" strokeWidth="1.4">
                        <rect x="430" y="70" width="110" height="70" rx="14" /><rect x="580" y="70" width="70" height="70" rx="35" />
                        <rect x="430" y="180" width="70" height="70" rx="35" /><rect x="540" y="180" width="200" height="70" rx="14" />
                        <rect x="430" y="290" width="150" height="70" rx="14" /><rect x="620" y="290" width="70" height="70" rx="35" />
                        <path d="M485 140v40M615 140v40M640 250v40M505 250v40" strokeDasharray="4 6" />
                      </g>
                      <g fill="#7FD8FF"><circle cx="485" cy="105" r="5" /><circle cx="640" cy="215" r="5" /><circle cx="505" cy="325" r="5" /></g>
                    </svg>
                  </div>
                  <span className="lp-label">Reservations</span>
                  <h3 className="lp-h3 max-w-[16ch] !text-[clamp(1.8rem,2.6vw,2.4rem)]">Checks the floor, then books, moves or cancels.</h3>
                  <p>It looks at real availability for your party and time, saves the booking and reads you a confirmation code. Changes and cancellations take one sentence.</p>
                </article>
                <article className="lp-cell lp-cell-b lp-reveal">
                  <div className="art" aria-hidden="true">
                    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#3B63FF"><circle cx="320" cy="60" r="28" strokeOpacity=".55" /><circle cx="320" cy="60" r="56" strokeOpacity=".32" /><circle cx="320" cy="60" r="84" strokeOpacity=".18" /><circle cx="320" cy="60" r="112" strokeOpacity=".09" /></g><circle cx="320" cy="60" r="7" fill="#3B63FF" /></svg>
                  </div>
                  <h3 className="lp-h3">Knows the menu</h3>
                  <p>Prices, dietary tags and today&rsquo;s sold-out dishes, straight from the owner portal.</p>
                </article>
                <article className="lp-cell lp-cell-c lp-reveal">
                  <div className="art" aria-hidden="true">
                    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice"><g fill="#3B63FF">{[44, 76, 32, 96, 60, 24, 72, 40, 20, 52].map((h, i) => <rect key={i} x={226 + i * 15} y={74 - h / 2} width="7" height={h} rx="3.5" opacity={0.35 + (h / 96) * 0.5} />)}</g></svg>
                  </div>
                  <h3 className="lp-h3">Hands off gracefully</h3>
                  <p>Complaints, suppliers and anything unusual become a callback request for the team.</p>
                </article>
                <article className="lp-cell lp-cell-d lp-reveal">
                  <div className="art" aria-hidden="true" />
                  <h3 className="lp-h3 !text-[clamp(1.6rem,2.4vw,2.2rem)]">It never makes things up.</h3>
                  <p>No invented hours and no fake confirmations. If it doesn&rsquo;t know, it says so and offers a callback.</p>
                </article>
              </div>
              <div className="lp-reveal mt-16 flex flex-wrap items-center justify-between gap-6 rounded-[24px] border border-[var(--paper-line)] bg-white p-6 sm:p-8">
                <div>
                  <h3 className="lp-h3">Ready when you are.</h3>
                  <p className="lp-muted mt-1">Your browser will ask to use the microphone.</p>
                </div>
                <button type="button" onClick={call.start} className="lp-btn lp-btn-primary">
                  Talk to {agent}<span className="lp-chip" aria-hidden="true"><Phone size={16} /><Phone size={16} /></span>
                </button>
              </div>
            </section>
          </div>

          {/* ---------------- Footer ---------------- */}
          <footer className="relative z-[1] mt-16 overflow-hidden pb-4">
            <div className="lp-wrap flex flex-wrap items-center justify-between gap-6 border-t border-[var(--ink-line)] py-8 text-[14px] text-[var(--on-ink-muted)]">
              <span className="lp-brand text-[var(--on-ink)]"><BrandMark />{PRODUCT_NAME}</span>
              <span>{venue}</span>
              <div className="flex gap-2">
                <Link href="/operations" className="lp-navlink">Operations</Link>
                <Link href="/owner" className="lp-navlink">Owner portal</Link>
              </div>
            </div>
            <div aria-hidden="true" className="select-none bg-[linear-gradient(180deg,rgba(238,241,246,.14),rgba(238,241,246,0)_85%)] bg-clip-text pb-2 text-center font-[family-name:var(--f-display)] text-[clamp(4.5rem,17vw,15rem)] font-bold leading-[0.8] tracking-[-0.07em] text-transparent">
              {PRODUCT_NAME}
            </div>
          </footer>
        </main>
      ) : (
        /* ---------------- Live call ---------------- */
        <main className="relative z-[1]">
          <section className="lp-wrap grid min-h-[100svh] grid-cols-[minmax(0,1fr)_minmax(0,460px)] gap-8 pb-8 pt-[104px] max-[1000px]:grid-cols-1 max-[1000px]:pb-[132px]">
            {/* identity, status and controls over the orb */}
            <div className="relative flex flex-col justify-between max-[1000px]:min-h-[calc(100svh-236px)]">
              <div className="lp-enter">
                <p className="lp-label text-[var(--ion)]">AI host · {restaurant}</p>
                <h1 className="lp-display mt-3 text-[clamp(2.4rem,4.2vw,3.6rem)]">{agent}</h1>
                <p className="mt-3 flex items-center gap-3 text-[15px] text-[var(--on-ink-muted)]">
                  <span className="lp-live lp-label" data-on={call.state === 'active'}><i aria-hidden="true" />{call.state === 'active' ? 'Connected' : call.state === 'connecting' ? 'Connecting' : 'Disconnected'}</span>
                  <span className="lp-num font-[family-name:var(--f-mono)]">{clock(call.seconds)}</span>
                </p>
              </div>

              <div className="pb-2 max-[1000px]:text-center" aria-live="polite">
                <p key={status} className="lp-enter lp-display text-[clamp(2rem,3.6vw,3.2rem)]">
                  {call.state === 'active' && call.phase !== 'speaking' ? <>{status}<span className="lp-grad">…</span></> : status}
                </p>
                {call.muted && call.state === 'active' && <p className="mt-2 text-[14.5px] text-[#ffcf85]">Your microphone is muted</p>}
                {call.error && <p role="alert" className="mt-3 max-w-md text-[14.5px] text-[#ff9c8a]">{call.error}</p>}
                {call.notice && !call.booking && <p className="mt-2 text-[14.5px] text-[var(--ion)]">{call.notice}</p>}

                {/* controls (fixed to the bottom on phones, like a phone call) */}
                <div className="mt-8 flex items-center gap-4 max-[1000px]:fixed max-[1000px]:inset-x-0 max-[1000px]:bottom-0 max-[1000px]:z-20 max-[1000px]:mt-0 max-[1000px]:justify-center max-[1000px]:bg-[linear-gradient(180deg,transparent,rgba(8,11,18,.92)_35%)] max-[1000px]:pb-7 max-[1000px]:pt-10">
                  {call.state === 'ended' ? (
                    <>
                      <button type="button" onClick={call.start} className="lp-btn lp-btn-primary">Call again<span className="lp-chip" aria-hidden="true"><Phone size={16} /><Phone size={16} /></span></button>
                      <button type="button" onClick={() => window.location.assign('/')} className="lp-btn lp-btn-ghost">Back</button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={call.toggleMute}
                        disabled={call.state !== 'active'}
                        aria-pressed={call.muted}
                        aria-label={call.muted ? 'Unmute microphone' : 'Mute microphone'}
                        className={`lp-round h-16 w-16 border ${call.muted ? 'border-transparent bg-[var(--on-ink)] text-[var(--ink)]' : 'border-[var(--ink-line-2)] bg-white/[0.05] hover:bg-white/10'}`}
                      >
                        {call.muted ? <MicOff size={22} /> : <Mic size={22} />}
                      </button>
                      <button
                        type="button"
                        onClick={call.end}
                        aria-label="End call"
                        className="lp-round h-[76px] w-[76px] bg-[#e5484d] text-white shadow-[0_18px_40px_-14px_rgba(229,72,77,.75)] hover:scale-[1.04] hover:bg-[#d93d42]"
                      >
                        <PhoneOff size={28} />
                      </button>
                      <button
                        type="button"
                        onClick={() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        aria-label="Show conversation"
                        className="lp-round hidden h-16 w-16 border border-[var(--ink-line-2)] bg-white/[0.05] max-[1000px]:grid"
                      >
                        <MessageSquareText size={22} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* live panel */}
            <div ref={panelRef} className="lp-panel lp-enter flex max-h-[calc(100svh-136px)] flex-col p-6 max-[1000px]:max-h-none max-[600px]:p-[18px]">
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--ink-line)] pb-4">
                <span className="lp-live lp-label" data-on={call.phase === 'speaking' && call.state === 'active'}>
                  <i aria-hidden="true" />{call.state === 'active' ? (call.phase === 'speaking' ? `${agent} speaking` : status) : status}
                </span>
                <span className="lp-label lp-num text-[var(--on-ink-muted)]">{clock(call.seconds)}</span>
              </div>
              <LiveWave active={waveActive} inputLevelRef={call.inputLevelRef} outputLevelRef={call.outputLevelRef} />
              {call.booking && <div className="mt-5"><BookingCard booking={call.booking} /></div>}
              <div ref={transcriptRef} className="mt-5 flex min-h-[220px] flex-1 flex-col gap-3 overflow-y-auto pr-1">
                <Transcript items={call.transcript} agentName={agent} />
              </div>
              <div className="mt-5"><Steps items={call.activity} /></div>
              <p className="lp-label mt-4 flex justify-between text-[var(--on-ink-muted)]"><span>Saved to the call log</span><span>{venue}</span></p>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
