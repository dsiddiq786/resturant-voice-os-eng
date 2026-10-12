'use client';

import React from 'react';
import Link from 'next/link';
import { Mic, MicOff, Phone, PhoneOff, CalendarCheck } from 'lucide-react';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { useVoiceCall, type ConfirmedBooking } from '@/components/concierge/useVoiceCall';
import './concierge.css';

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 px-5 sm:px-10 h-16 border-b border-[#E6E0D5] bg-[#FBF9F5]">
      <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="Leed Pizza home">
        <span className="grid place-items-center w-8 h-8 rounded-full bg-[#B8432A] text-[#FBF9F5] text-[13px] font-semibold tracking-tight">
          LP
        </span>
        <span className="hidden sm:inline font-semibold tracking-tight text-[#1B1B19] truncate">Leed Pizza</span>
      </Link>
      <nav className="flex items-center gap-1 text-[13px] whitespace-nowrap" aria-label="Primary">
        <Link
          href="/"
          aria-current="page"
          className="px-2.5 sm:px-3 py-1.5 rounded-full text-[#1B1B19] bg-[#EFEAE0] font-medium"
        >
          AI Concierge
        </Link>
        <Link
          href="/owner"
          className="px-2.5 sm:px-3 py-1.5 rounded-full text-[#4A4740] hover:text-[#1B1B19] hover:bg-[#EFEAE0] transition-colors"
        >
          Owner Portal
        </Link>
      </nav>
    </header>
  );
}

function Avatar({ level, active, connecting, initials }: { level: number; active: boolean; connecting: boolean; initials: string }) {
  return (
    <div className="relative grid place-items-center w-44 h-44 sm:w-52 sm:h-52" style={{ ['--level' as any]: level }}>
      <span className="absolute inset-0 rounded-full border border-[#F3EEE4]/10" />
      <span className="concierge-ring absolute inset-4 rounded-full border border-[#F3EEE4]/20" />
      {connecting && <span className="concierge-breathe absolute inset-0 rounded-full bg-[#B8432A]/40" />}
      <span
        className="relative grid place-items-center w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-[#B8432A] text-[#FBF9F5] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)]"
        aria-hidden="true"
      >
        <span className="font-serif text-4xl sm:text-5xl tracking-tight">{initials}</span>
        {active && (
          <span className="absolute bottom-3 flex items-end gap-[3px] h-5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className="concierge-bar w-[3px] rounded-full bg-[#FBF9F5]"
                style={{ height: `${4 + level * 16 * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.9 + level * 5)))}px` }}
              />
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

function BookingChip({ booking }: { booking: ConfirmedBooking }) {
  return (
    <div className="concierge-fade-in flex items-center gap-3 rounded-2xl bg-[#F3EEE4]/[0.08] px-4 py-3 text-left text-[#F3EEE4] w-full max-w-sm">
      <CalendarCheck size={18} className="shrink-0 text-[#E9B49F]" aria-hidden="true" />
      <div className="min-w-0 text-[13px] leading-snug">
        <div className="font-medium">
          Booked for {booking.party_size} · {formatDate(booking.date)} · {formatTime(booking.time)}
        </div>
        <div className="text-[#F3EEE4]/60">
          Confirmation <span className="font-mono tracking-wider text-[#F3EEE4]">{booking.confirmation_code}</span>
        </div>
      </div>
    </div>
  );
}

export default function ConciergeHome() {
  const { ownerConfig } = useOwnerConfig();
  const restaurantName = ownerConfig.restaurant_name || 'Leed Pizza';
  const venue = ownerConfig.venue || `${restaurantName} Main St`;
  const voice = ownerConfig.voice_name || 'Leda';
  const call = useVoiceCall({ venue, voice });
  const initials = restaurantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || 'LP';

  const statusLine =
    call.state === 'connecting' ? 'Connecting' :
    call.state === 'active'
      ? call.speaker === 'agent' ? 'Speaking'
      : call.speaker === 'caller' ? 'Listening'
      : 'Connected'
    : call.state === 'ended' ? 'Call ended' : 'AI host';

  return (
    <div className="min-h-dvh flex flex-col bg-[#F6F3EE] text-[#1B1B19]">
      <SiteHeader />

      <main className="flex-1 grid lg:grid-cols-[1fr_minmax(0,520px)] items-center gap-10 lg:gap-16 px-5 sm:px-10 py-10 lg:py-16 max-w-6xl w-full mx-auto">
        <section className="order-2 lg:order-1 max-w-md">
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#B8432A] font-semibold">AI Concierge</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight text-[#1B1B19]">
            Speak with {restaurantName}.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#56524A]">
            Our AI host can check table availability, book, change or cancel a reservation, and answer questions
            using the menu and details the restaurant has provided. Anything it cannot answer goes to the team.
          </p>
          <ul className="mt-6 space-y-2.5 text-[14px] text-[#3D3A34]">
            <li>Book a table for your party, or change an existing booking</li>
            <li>Ask about the menu, prices and takeout</li>
            <li>Request a callback from the team</li>
          </ul>
        </section>

        <section
          aria-label="Voice call"
          className="order-1 lg:order-2 relative overflow-hidden rounded-[32px] bg-[#131E1B] text-[#F3EEE4] shadow-[0_30px_60px_-30px_rgba(19,30,27,0.55)]"
        >
          <div className="flex flex-col items-center px-6 pt-10 pb-8 sm:px-10 min-h-[560px] sm:min-h-[600px]">
            <div className="text-center">
              <p className="text-[12px] uppercase tracking-[0.18em] text-[#F3EEE4]/55">{restaurantName}</p>
              <p className="mt-1 font-medium text-[17px]">Virtual host {voice ? `· ${voice}` : ''}</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6">
              <Avatar
                level={call.speaker === 'none' ? 0 : call.level}
                active={call.state === 'active'}
                connecting={call.state === 'connecting'}
                initials={initials}
              />

              <div className="text-center min-h-[64px]" aria-live="polite">
                {call.state === 'active' || call.state === 'connecting' ? (
                  <>
                    <p className="font-mono text-2xl tracking-wider tabular-nums">
                      {call.state === 'active' ? formatClock(call.seconds) : '--:--'}
                    </p>
                    <p className="mt-1 text-[13px] text-[#F3EEE4]/65">{statusLine}</p>
                  </>
                ) : call.state === 'ended' ? (
                  <>
                    <p className="text-lg font-medium">Call ended</p>
                    <p className="mt-1 text-[13px] text-[#F3EEE4]/65">Duration {formatClock(call.seconds)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium">Ready when you are</p>
                    <p className="mt-1 text-[13px] text-[#F3EEE4]/65">Tap start to speak with the AI host</p>
                  </>
                )}
              </div>

              {call.booking && <BookingChip booking={call.booking} />}
              {call.notice && !call.booking && (
                <p className="concierge-fade-in text-[13px] text-[#E9B49F]">{call.notice}</p>
              )}
              {call.error && (
                <p role="alert" className="concierge-fade-in max-w-sm text-center text-[13px] leading-snug text-[#F1B8A6]">
                  {call.error}
                </p>
              )}
            </div>

            <div className="w-full flex items-center justify-center gap-6">
              {call.state === 'active' && (
                <button
                  type="button"
                  onClick={call.toggleMute}
                  aria-pressed={call.muted}
                  aria-label={call.muted ? 'Unmute microphone' : 'Mute microphone'}
                  className="grid place-items-center w-14 h-14 rounded-full bg-[#F3EEE4]/12 hover:bg-[#F3EEE4]/20 transition-colors"
                >
                  {call.muted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
              )}

              {call.state === 'active' || call.state === 'connecting' ? (
                <button
                  type="button"
                  onClick={call.end}
                  aria-label="End call"
                  className="grid place-items-center w-[72px] h-[72px] rounded-full bg-[#D9463B] hover:bg-[#C73D33] text-white transition-colors"
                >
                  <PhoneOff size={26} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={call.start}
                  aria-label={call.state === 'ended' ? 'Call again' : 'Start call'}
                  className="flex items-center gap-2.5 h-14 px-7 rounded-full bg-[#1FA366] hover:bg-[#18905A] text-white font-medium transition-colors"
                >
                  <Phone size={20} />
                  <span>{call.state === 'ended' ? 'Call again' : 'Start call'}</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
