'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Phone, PhoneOff, Mic, MicOff, MessageSquareText, X, Check, AlertCircle, Loader2, CalendarCheck, ArrowRight,
} from 'lucide-react';
import SiteNav from '@/components/lux/SiteNav';
import NeuralSphere, { type SphereMode } from '@/components/lux/NeuralSphere';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import {
  useVoiceCall, type ActivityEntry, type CallPhase, type ConfirmedBooking, type TranscriptEntry,
} from '@/components/concierge/useVoiceCall';

// ---------- formatting ----------
function clock(total: number) {
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, '0')}`;
}
function time12(hhmm?: string) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function dateShort(iso?: string) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------- activity copy: one line per real tool event ----------
type Tone = 'ok' | 'warn' | 'bad';
const WORKING: Record<string, string> = {
  check_availability: 'Checking available tables',
  submit_reservation_data: 'Confirming your booking',
  find_reservation: 'Searching reservations',
  modify_reservation: 'Updating reservation',
  cancel_reservation: 'Cancelling reservation',
  request_staff_callback: 'Recording a callback request',
  submit_food_order: 'Sending order to the kitchen',
};

function outcome(entry: ActivityEntry): { text: string; tone: Tone } {
  const s = entry.status;
  const d = entry.detail || {};
  const when = [dateShort(d.date), time12(d.time)].filter(Boolean).join(', ');
  if (s === 'error') return { text: 'Booking system unavailable', tone: 'bad' };
  switch (entry.tool) {
    case 'check_availability':
      if (s === 'available') return { text: `Table available for ${d.party_size} · ${when}`, tone: 'ok' };
      if (s === 'unavailable') {
        const alt = (d.alternatives || []).map(time12).join(', ');
        return { text: `Fully booked at ${time12(d.time)}${alt ? ` · open: ${alt}` : ''}`, tone: 'warn' };
      }
      return { text: 'Needs a clearer date, time or party size', tone: 'warn' };
    case 'submit_reservation_data':
      if (s === 'confirmed') return { text: `Reservation confirmed · ${d.code}`, tone: 'ok' };
      if (s === 'duplicate') return { text: 'A booking already exists for this number', tone: 'warn' };
      if (s === 'unavailable') return { text: 'That time is no longer available', tone: 'warn' };
      return { text: 'Missing booking details', tone: 'warn' };
    case 'find_reservation':
      if (s === 'found') return { text: `Found ${d.count} reservation${d.count === 1 ? '' : 's'}`, tone: 'ok' };
      if (s === 'not_found') return { text: 'No matching reservation', tone: 'warn' };
      return { text: 'Needs a confirmation code, or phone and name', tone: 'warn' };
    case 'modify_reservation':
      if (s === 'modified') return { text: `Reservation updated · ${when}`, tone: 'ok' };
      if (s === 'unavailable') return { text: 'The new time is not available', tone: 'warn' };
      return { text: 'Could not update that reservation', tone: 'warn' };
    case 'cancel_reservation':
      if (s === 'cancelled') return { text: 'Reservation cancelled', tone: 'ok' };
      return { text: 'Could not cancel that reservation', tone: 'warn' };
    case 'request_staff_callback':
      return { text: 'Callback request recorded for the team', tone: 'ok' };
    case 'submit_food_order':
      return { text: 'Order sent to the kitchen', tone: 'ok' };
    default:
      return { text: 'Done', tone: 'ok' };
  }
}

const SLOW_TOOL_MS = 2000;

function phaseLabel(state: string, phase: CallPhase, pending: ActivityEntry | undefined, now: number) {
  if (state === 'connecting') return 'Connecting to the concierge';
  if (state === 'ended') return 'Call ended';
  if (phase === 'waiting' && pending) {
    return now - pending.startedAt > SLOW_TOOL_MS ? 'Waiting for the booking system' : WORKING[pending.tool] || 'Working on it';
  }
  if (phase === 'thinking') return 'Thinking';
  if (phase === 'speaking') return 'Speaking';
  return 'Listening';
}

// ---------- pieces ----------
function ActivityTimeline({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) {
    return <p className="text-[13px] lux-muted leading-relaxed">Every step the concierge takes with the booking system appears here as it happens.</p>;
  }
  return (
    <ol className="relative space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--lux-line-strong)]">
      {items.map(item => {
        const done = item.phase === 'completed';
        const result = done ? outcome(item) : null;
        const color = !done ? 'var(--lux-champagne)' : result?.tone === 'ok' ? 'var(--lux-ok)' : result?.tone === 'warn' ? 'var(--lux-warn)' : 'var(--lux-bad)';
        return (
          <li key={item.id} className="lux-fade relative pl-8">
            <span
              className="absolute left-0 top-0.5 grid place-items-center w-[19px] h-[19px] rounded-full bg-[var(--lux-ink)] border"
              style={{ borderColor: color, color }}
            >
              {!done ? <Loader2 size={11} className="animate-spin" /> : result?.tone === 'ok' ? <Check size={11} /> : <AlertCircle size={11} />}
            </span>
            <p className="text-[13.5px] text-[var(--lux-ivory)]">{WORKING[item.tool] || item.tool}</p>
            <p className="text-[12.5px] mt-0.5" style={{ color: done ? color : 'var(--lux-ivory-3)' }}>
              {done ? result?.text : 'In progress'}
              {done && item.completedAt ? <span className="lux-muted"> · {Math.max(1, item.completedAt - item.startedAt)} ms</span> : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Transcript({ items, agentName }: { items: TranscriptEntry[]; agentName: string }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [items]);
  if (items.length === 0) {
    return <p className="text-[13px] lux-muted leading-relaxed">The conversation appears here as you and the concierge speak.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map(entry => (
        <div key={entry.id} className={`lux-fade flex ${entry.role === 'caller' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
              entry.role === 'caller'
                ? 'bg-[var(--lux-ivory)] text-[var(--lux-ink)] rounded-br-md'
                : 'bg-white/[0.05] text-[var(--lux-ivory)] rounded-bl-md border border-[var(--lux-line)]'
            }`}
          >
            <span className={`block text-[10.5px] uppercase tracking-[0.16em] mb-1 ${entry.role === 'caller' ? 'text-black/45' : 'text-[var(--lux-champagne)]'}`}>
              {entry.role === 'caller' ? 'You' : agentName}
            </span>
            {entry.text.trim()}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function BookingCard({ booking }: { booking: ConfirmedBooking }) {
  return (
    <div className="lux-rise flex items-center gap-4 rounded-2xl border border-[rgba(201,164,92,0.4)] bg-[var(--lux-gold-soft)] px-4 py-3.5">
      <CalendarCheck size={20} className="shrink-0 text-[var(--lux-champagne)]" />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">
          {booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'} · {dateShort(booking.date)} · {time12(booking.time)}
        </p>
        <p className="text-[12.5px] lux-muted">
          Confirmation <span className="font-mono tracking-[0.18em] text-[var(--lux-ivory)]">{booking.confirmation_code}</span>
        </p>
      </div>
    </div>
  );
}

// ---------- page ----------
export default function ConciergeExperience() {
  const { ownerConfig } = useOwnerConfig();
  const restaurantName = ownerConfig.restaurant_name || 'Leed Pizza';
  const venue = ownerConfig.venue || `${restaurantName} Main St`;
  const voice = ownerConfig.voice_name || 'Leda';
  const call = useVoiceCall({ venue, voice });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const inCall = call.state !== 'idle';
  const pending = useMemo(() => [...call.activity].reverse().find(a => a.phase === 'started'), [call.activity]);

  // Re-render while a tool is pending so the "slow" label can appear; driven by the real start time.
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [pending]);

  useEffect(() => {
    if (inCall) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [inCall]);

  const sphereMode: SphereMode =
    call.state === 'idle' ? 'idle' :
    call.state === 'connecting' ? 'connecting' :
    call.state === 'ended' ? 'ended' : call.phase;

  const label = phaseLabel(call.state, call.phase, pending, now);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[var(--lux-ink)] lux-grain">
      <SiteNav />

      {!inCall ? (
        <>
          {/* ---------------- HERO ---------------- */}
          <section className="relative mx-auto grid max-w-7xl items-center gap-6 px-5 pt-24 sm:px-10 lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20">
            <div className="relative z-10 order-2 pb-10 lg:order-1 lg:pb-0">
              <p className="lux-eyebrow lux-rise">Leed Pizza · AI Concierge</p>
              <h1 className="lux-display mt-6 lux-rise lux-rise-1">
                Your table is <em>one conversation</em> away.
              </h1>
              <p className="lux-lede mt-7 max-w-[34rem] lux-rise lux-rise-2">
                Speak naturally with our AI host. It checks real availability, books, changes and cancels
                reservations, and answers from the menu the kitchen keeps up to date.
              </p>
              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center lux-rise lux-rise-3">
                <button type="button" onClick={call.start} className="lux-btn lux-btn-primary h-14 px-8 text-[15.5px]">
                  <Phone size={18} />
                  Talk to AI Concierge
                </button>
                <p className="text-[12.5px] lux-muted max-w-[16rem] leading-snug">
                  Uses your microphone. Calls are logged for the restaurant team.
                </p>
              </div>
              {call.error && (
                <p role="alert" className="mt-5 flex items-start gap-2 text-[13.5px] text-[var(--lux-bad)] lux-fade">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> {call.error}
                </p>
              )}
            </div>

            <div className="relative order-1 lg:order-2 lux-fade">
              <div className="relative mx-auto aspect-square w-full max-w-[min(640px,92vw)]">
                <NeuralSphere mode="idle" className="absolute inset-0 h-full w-full" />
              </div>
              <p className="absolute bottom-[6%] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] uppercase tracking-[0.3em] lux-muted">
                {restaurantName} · Host voice {voice}
              </p>
            </div>
          </section>

          {/* ---------------- CAPABILITIES ---------------- */}
          <section className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-10">
            <div className="grid border-t border-[var(--lux-line)] md:grid-cols-3">
              {[
                { n: '01', t: 'Reservations', d: 'Checks the live floor plan for your party and time, then books, moves or cancels it. You hear a confirmation code only after the booking is saved.' },
                { n: '02', t: 'The menu', d: 'Prices, dietary notes and today’s sold-out dishes come straight from the menu the owner manages. It will not invent an answer.' },
                { n: '03', t: 'A person, when you need one', d: 'Complaints, supplier calls or anything unusual are recorded as a callback request for the team.' },
              ].map((item, i) => (
                <div key={item.n} className={`py-10 md:pr-10 ${i > 0 ? 'md:pl-10 md:border-l border-t md:border-t-0 border-[var(--lux-line)]' : ''}`}>
                  <p className="font-[family-name:var(--lux-serif)] text-[var(--lux-champagne)] text-lg italic">{item.n}</p>
                  <h2 className="lux-serif mt-4 text-[30px] leading-tight">{item.t}</h2>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--lux-ivory-2)]">{item.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-4 border-t border-[var(--lux-line)] pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] lux-muted">{venue}</p>
              <div className="flex gap-6 text-[13px]">
                <Link href="/operations" className="lux-navlink">Operations</Link>
                <Link href="/owner" className="lux-navlink">Owner Portal</Link>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* ---------------- CALL STAGE ---------------- */
        <section className="relative mx-auto grid min-h-[100dvh] max-w-7xl gap-6 px-5 pb-6 pt-[84px] sm:px-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-10">
          <div className="relative flex min-h-[calc(100dvh-110px)] flex-col items-center lux-fade">
            {/* identity + connection */}
            <div className="w-full flex items-center justify-between">
              <div>
                <p className="lux-serif text-[28px] leading-none">{restaurantName}</p>
                <p className="mt-2 text-[12.5px] lux-muted">AI host · {voice}</p>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-2 text-[12.5px] text-[var(--lux-ivory-2)]">
                  {call.state === 'active' ? <span className="lux-live-dot" /> : call.state === 'connecting' ? <Loader2 size={12} className="animate-spin" /> : <span className="h-[7px] w-[7px] rounded-full bg-[var(--lux-ivory-4)]" />}
                  {call.state === 'active' ? 'Connected' : call.state === 'connecting' ? 'Connecting' : 'Disconnected'}
                </p>
                <p className="mt-1 font-mono text-[22px] lux-num">{call.state === 'connecting' ? '0:00' : clock(call.seconds)}</p>
              </div>
            </div>

            {/* brain */}
            <div className="relative flex w-full flex-1 items-center justify-center">
              <div className="relative aspect-square w-full max-w-[min(560px,88vw,62vh)]">
                <NeuralSphere
                  mode={sphereMode}
                  inputLevelRef={call.inputLevelRef}
                  outputLevelRef={call.outputLevelRef}
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>

            {/* live status */}
            <div className="text-center min-h-[86px]" aria-live="polite">
              <p key={label} className="lux-serif lux-fade text-[clamp(26px,3.2vw,38px)] italic text-[var(--lux-ivory)]">
                {label}{call.state === 'active' && call.phase !== 'speaking' ? '…' : ''}
              </p>
              {call.muted && call.state === 'active' && <p className="mt-1 text-[12.5px] text-[var(--lux-warn)]">Your microphone is muted</p>}
              {call.error && <p role="alert" className="mt-2 max-w-md text-[13px] text-[var(--lux-bad)]">{call.error}</p>}
              {call.notice && !call.booking && <p className="mt-2 text-[13px] text-[var(--lux-champagne)]">{call.notice}</p>}
            </div>

            {call.booking && <div className="mt-4 w-full max-w-sm lg:hidden"><BookingCard booking={call.booking} /></div>}

            {/* controls */}
            <div className="mt-6 flex items-center justify-center gap-6 sm:gap-8">
              {call.state === 'ended' ? (
                <>
                  <button type="button" onClick={call.start} className="lux-btn lux-btn-primary">
                    <Phone size={17} /> Call again
                  </button>
                  <button type="button" onClick={() => window.location.assign('/')} className="lux-btn lux-btn-ghost">
                    Back to home <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={call.toggleMute}
                    disabled={call.state !== 'active'}
                    aria-pressed={call.muted}
                    aria-label={call.muted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`lux-icon-btn h-16 w-16 ${call.muted ? 'bg-[var(--lux-ivory)] text-[var(--lux-ink)]' : 'lux-glass hover:bg-white/10'}`}
                  >
                    {call.muted ? <MicOff size={22} /> : <Mic size={22} />}
                  </button>
                  <button
                    type="button"
                    onClick={call.end}
                    aria-label="End call"
                    className="lux-icon-btn h-[76px] w-[76px] bg-[#d94a3d] text-white shadow-[0_18px_40px_-16px_rgba(217,74,61,0.7)] hover:bg-[#c8402f] hover:scale-[1.04]"
                  >
                    <PhoneOff size={28} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    aria-label="Show conversation and activity"
                    className="lux-icon-btn h-16 w-16 lux-glass hover:bg-white/10 lg:hidden"
                  >
                    <MessageSquareText size={22} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* side panel (desktop) / sheet (mobile) */}
          <aside
            className={`${sheetOpen ? 'fixed inset-x-0 bottom-0 z-[60] max-h-[78dvh] rounded-t-[28px] lux-rise' : 'hidden'} lg:static lg:z-auto lg:flex lg:max-h-[calc(100dvh-110px)] lg:rounded-[28px] flex-col overflow-hidden lux-glass bg-[rgba(17,17,19,0.92)] lg:bg-transparent`}
            aria-label="Conversation and agent activity"
          >
            <div className="flex items-center justify-between px-6 pt-5 lg:hidden">
              <p className="lux-eyebrow">Live call</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="lux-icon-btn h-9 w-9 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="border-b border-[var(--lux-line)] px-6 pb-5 pt-5">
              <p className="lux-eyebrow mb-4">Agent activity</p>
              {call.booking && <div className="mb-4 hidden lg:block"><BookingCard booking={call.booking} /></div>}
              <div className="max-h-[220px] overflow-y-auto pr-1">
                <ActivityTimeline items={call.activity} />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-5">
              <p className="lux-eyebrow mb-4">Conversation</p>
              <div className="min-h-[120px] flex-1 overflow-y-auto pr-1">
                <Transcript items={call.transcript} agentName={restaurantName} />
              </div>
            </div>
          </aside>
          {sheetOpen && <button type="button" aria-label="Close panel" className="fixed inset-0 z-[55] bg-black/50 lg:hidden" onClick={() => setSheetOpen(false)} />}
        </section>
      )}
    </div>
  );
}
