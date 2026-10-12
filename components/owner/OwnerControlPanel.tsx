'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, AudioLines, ScrollText, Store, UtensilsCrossed, Armchair, CalendarDays, PhoneCall,
  PlugZap, Rocket, ArrowRight, Loader2, Check, CircleDot,
} from 'lucide-react';
import Workspace, { PageHead, Figures, type WorkspaceSection } from '@/components/lux/Workspace';
import VoicePersonaConfig from './VoicePersonaConfig';
import FloorPlanBuilder from './FloorPlanBuilder';
import MenuBuilder from './MenuBuilder';
import DeployPanel from './DeployPanel';
import MasterPromptControl from './MasterPromptControl';
import ReservationsPanel, { useReservations } from '@/components/lux/data/ReservationsPanel';
import CallsPanel, { useCalls, needsAttention } from '@/components/lux/data/CallsPanel';
import { todayISO } from '@/components/lux/data/useApiList';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { useMounted } from '@/components/lux/useMounted';

export type OwnerNavTab =
  | 'overview' | 'voice' | 'prompt' | 'profile' | 'menu' | 'floor' | 'reservations' | 'calls' | 'integrations' | 'deploy';

interface OwnerControlPanelProps {
  onSwitchToOperations?: () => void;
}

function since(iso?: string) {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ---------------- Overview ----------------
function Overview({ go }: { go: (t: OwnerNavTab) => void }) {
  const { ownerConfig, selectedVoice, menuItems, floorTables, hasUnsavedChanges } = useOwnerConfig();
  const mounted = useMounted();
  const calls = useCalls();
  const reservations = useReservations();
  const today = todayISO();

  const attention = calls.items.filter(needsAttention);
  const upcoming = reservations.items.filter(r => r.status === 'CONFIRMED' && r.reservation_date >= today);
  const handled = reservations.items.length;
  const available = menuItems.filter(m => !m.is_86).length;

  return (
    <>
      <PageHead
        eyebrow="Owner Portal"
        title={<>Good to see you. <em className="italic text-[var(--lux-champagne)]">Here is your concierge.</em></>}
        description="What the AI host is saying to guests, what it has booked, and what needs a person."
        actions={
          <>
            <Link href="/" className="lux-btn lux-btn-ghost lux-btn-sm">Talk to it</Link>
            <button type="button" onClick={() => go('voice')} className="lux-btn lux-btn-primary lux-btn-sm">Configure agent</button>
          </>
        }
      />

      {/* Agent identity */}
      <section className="grid gap-10 border-b border-[var(--lux-line)] pb-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <p className="lux-eyebrow mb-4">Greeting guests hear</p>
          <blockquote className="lux-serif text-[clamp(26px,3vw,36px)] italic leading-snug text-[var(--lux-ivory)]">
            “{ownerConfig.greeting}”
          </blockquote>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 self-end text-[13.5px]">
          <div><dt className="lux-muted text-[12px]">Voice</dt><dd className="mt-1">{selectedVoice?.label || ownerConfig.voice_name}</dd></div>
          <div><dt className="lux-muted text-[12px]">Tone</dt><dd className="mt-1">{ownerConfig.tone}</dd></div>
          <div><dt className="lux-muted text-[12px]">Last published</dt><dd className="mt-1">{mounted ? since(ownerConfig.last_deployed_at) : '—'}</dd></div>
          <div>
            <dt className="lux-muted text-[12px]">Draft</dt>
            <dd className="mt-1">
              {hasUnsavedChanges
                ? <button type="button" onClick={() => go('deploy')} className="text-[var(--lux-warn)] underline-offset-4 hover:underline">Unpublished changes</button>
                : <span className="text-[var(--lux-ok)]">Live and in sync</span>}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-12">
        <Figures
          items={[
            { label: 'Calls logged', value: calls.loading ? '–' : calls.items.length },
            { label: 'Need attention', value: calls.loading ? '–' : attention.length },
            { label: 'Bookings made by the concierge', value: reservations.loading ? '–' : handled, hint: `${upcoming.length} upcoming` },
            { label: 'Dishes on offer', value: `${available}/${menuItems.length}`, hint: `${menuItems.length - available} sold out` },
            { label: 'Tables configured', value: floorTables.length },
          ]}
        />
      </div>

      <div className="mt-14 grid gap-14 xl:grid-cols-2">
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="lux-section-title">Calls that need you</h2>
            <button type="button" onClick={() => go('calls')} className="lux-navlink text-[13px] inline-flex items-center gap-1.5">Call history <ArrowRight size={14} /></button>
          </div>
          {!calls.loading && attention.length === 0 ? (
            <div className="lux-empty"><h3>Nothing waiting</h3><p className="text-[13.5px]">Callback requests and failed bookings show up here.</p></div>
          ) : (
            <div className="border-t border-[var(--lux-line)]">
              {attention.slice(0, 5).map(c => (
                <div key={c.id} className="lux-row grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-medium">{c.caller_name}</p>
                    <p className="mt-1 truncate text-[12.5px] lux-muted">{c.caller_phone} · {since(c.start_time)}</p>
                  </div>
                  <span className="lux-badge lux-badge-warn">{c.intent === 'handoff' ? 'Callback' : 'Tool error'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="lux-section-title">Upcoming bookings</h2>
            <button type="button" onClick={() => go('reservations')} className="lux-navlink text-[13px] inline-flex items-center gap-1.5">All reservations <ArrowRight size={14} /></button>
          </div>
          <ReservationsPanel upcomingOnly limit={5} allowCancel={false} />
        </section>
      </div>
    </>
  );
}

// ---------------- Restaurant profile ----------------
function Profile() {
  const { ownerConfig, updateOwnerConfig, saveAndDeploy, isDeploying, deploySuccess, lastDeployedMessage, hasUnsavedChanges } = useOwnerConfig();
  const field = 'w-full rounded-xl border border-[var(--lux-line-strong)] bg-[#0e0e10] px-4 py-3 text-[14.5px] text-[var(--lux-ivory)] outline-none transition-colors focus:border-[var(--lux-champagne)]';

  return (
    <>
      <PageHead
        eyebrow="Concierge"
        title="Restaurant profile"
        description="The name, location and greeting the AI host uses on every call. Publish to make changes live."
        actions={
          <button type="button" onClick={saveAndDeploy} disabled={isDeploying || !hasUnsavedChanges} className="lux-btn lux-btn-primary lux-btn-sm">
            {isDeploying ? <Loader2 size={14} className="animate-spin" /> : deploySuccess ? <Check size={14} /> : <Rocket size={14} />}
            {isDeploying ? 'Publishing' : deploySuccess ? 'Published' : 'Publish changes'}
          </button>
        }
      />
      <div className="grid max-w-3xl gap-8">
        <label className="grid gap-2">
          <span className="text-[13px] text-[var(--lux-ivory-2)]">Restaurant name</span>
          <input className={field} value={ownerConfig.restaurant_name} onChange={e => updateOwnerConfig({ restaurant_name: e.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="text-[13px] text-[var(--lux-ivory-2)]">Location (spoken to callers)</span>
          <input className={field} value={ownerConfig.venue || ''} onChange={e => updateOwnerConfig({ venue: e.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="text-[13px] text-[var(--lux-ivory-2)]">Greeting</span>
          <textarea rows={3} className={field} value={ownerConfig.greeting} onChange={e => updateOwnerConfig({ greeting: e.target.value })} />
          <span className="text-[12px] lux-muted">The host says this exact sentence when it answers.</span>
        </label>
        <label className="flex items-center justify-between gap-6 border-t border-[var(--lux-line)] pt-6">
          <span>
            <span className="block text-[14px]">Canadian hospitality phrasing</span>
            <span className="mt-1 block text-[12.5px] lux-muted">Conversational fillers and terms such as washroom and bill.</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--lux-champagne)]"
            checked={ownerConfig.canadian_dialect !== false}
            onChange={e => updateOwnerConfig({ canadian_dialect: e.target.checked })}
          />
        </label>
        {lastDeployedMessage && <p className="text-[13px] lux-muted">{lastDeployedMessage}</p>}
      </div>
    </>
  );
}

// ---------------- Integrations ----------------
const PROVIDERS = [
  {
    name: 'Leed Pizza reservation book',
    status: 'connected',
    note: 'Local database. The AI concierge checks availability, books, changes and cancels here.',
  },
  {
    name: 'OpenTable',
    status: 'partner',
    note: 'Partner API. Requires approval as an OpenTable integration partner and a production agreement.',
  },
  {
    name: 'TouchBistro',
    status: 'partner',
    note: 'Partner-only API. Requires TouchBistro partner program approval and issued API keys.',
  },
  {
    name: 'Lightspeed Restaurant',
    status: 'partner',
    note: 'Reservations for Platforms API (K-Series). Requires an approved Lightspeed Developer Portal account.',
  },
  {
    name: 'POS KING',
    status: 'unknown',
    note: 'No public API documentation found. Needs vendor contact before any integration work.',
  },
];

function Integrations() {
  return (
    <>
      <PageHead
        eyebrow="Settings"
        title="Integrations"
        description="Where the concierge reads and writes bookings. Only the local reservation book is connected; nothing is synchronised to external platforms."
      />
      <div className="border-t border-[var(--lux-line)]">
        {PROVIDERS.map(p => (
          <div key={p.name} className="lux-row grid-cols-[minmax(0,1fr)_auto] py-6">
            <div className="min-w-0">
              <p className="lux-serif text-[24px] leading-none">{p.name}</p>
              <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed lux-muted">{p.note}</p>
            </div>
            {p.status === 'connected' ? (
              <span className="lux-badge lux-badge-ok">Connected</span>
            ) : p.status === 'partner' ? (
              <span className="lux-badge lux-badge-quiet">Needs partner access</span>
            ) : (
              <span className="lux-badge lux-badge-quiet">Not available</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------- Shell ----------------
export default function OwnerControlPanel({ onSwitchToOperations }: OwnerControlPanelProps) {
  const [active, setActive] = useState<OwnerNavTab>('overview');
  const { ownerConfig, hasUnsavedChanges, isDeploying, deploySuccess, saveAndDeploy, menuItems } = useOwnerConfig();
  const calls = useCalls();
  const attention = useMemo(() => calls.items.some(needsAttention), [calls.items]);

  const sections: WorkspaceSection[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Owner' },
    { id: 'voice', label: 'Agent voice', icon: AudioLines, group: 'Concierge' },
    { id: 'prompt', label: 'Instructions', icon: ScrollText, group: 'Concierge' },
    { id: 'profile', label: 'Restaurant profile', icon: Store, group: 'Concierge' },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed, group: 'Restaurant', count: menuItems.length },
    { id: 'floor', label: 'Floor plan', icon: Armchair, group: 'Restaurant' },
    { id: 'reservations', label: 'Reservations', icon: CalendarDays, group: 'Restaurant' },
    { id: 'calls', label: 'Call history', icon: PhoneCall, group: 'Restaurant', attention },
    { id: 'integrations', label: 'Integrations', icon: PlugZap, group: 'Settings' },
    { id: 'deploy', label: 'Publish', icon: Rocket, group: 'Settings', attention: hasUnsavedChanges },
  ];

  const legacyTitles: Partial<Record<OwnerNavTab, { eyebrow: string; title: string; description: string }>> = {
    voice: { eyebrow: 'Concierge', title: 'Agent voice', description: 'Choose the Gemini Live voice and personality guests hear.' },
    prompt: { eyebrow: 'Concierge', title: 'Instructions', description: 'House rules and directives layered on top of the concierge’s fixed safety rules.' },
    menu: { eyebrow: 'Restaurant', title: 'Menu', description: 'Dishes, prices and sold-out status. The concierge only offers what is available here.' },
    floor: { eyebrow: 'Restaurant', title: 'Floor plan', description: 'Tables and capacities used for every availability check.' },
    deploy: { eyebrow: 'Settings', title: 'Publish', description: 'Review the compiled instructions and push your changes live to the voice concierge.' },
  };
  const legacy = legacyTitles[active];

  return (
    <Workspace
      product="Owner Portal"
      venueName={ownerConfig.restaurant_name}
      sections={sections}
      active={active}
      onSelect={id => setActive(id as OwnerNavTab)}
      sidebarFooter={
        <div className="mx-1 rounded-2xl border border-[var(--lux-line)] p-4">
          <p className="flex items-center gap-2 text-[12.5px]">
            <CircleDot size={13} className={hasUnsavedChanges ? 'text-[var(--lux-warn)]' : 'text-[var(--lux-ok)]'} />
            {hasUnsavedChanges ? 'Unpublished changes' : 'Concierge is up to date'}
          </p>
          <button
            type="button"
            onClick={saveAndDeploy}
            disabled={!hasUnsavedChanges || isDeploying}
            className="lux-btn lux-btn-primary lux-btn-sm mt-3 w-full"
          >
            {isDeploying ? <Loader2 size={14} className="animate-spin" /> : deploySuccess ? <Check size={14} /> : <Rocket size={14} />}
            {isDeploying ? 'Publishing' : deploySuccess ? 'Published' : 'Publish'}
          </button>
        </div>
      }
    >
      {active === 'overview' && <Overview go={setActive} />}
      {active === 'profile' && <Profile />}
      {active === 'integrations' && <Integrations />}
      {active === 'reservations' && (
        <>
          <PageHead eyebrow="Restaurant" title="Reservations" description="Bookings saved by the AI concierge. Cancelling frees the table for new callers." />
          <ReservationsPanel />
        </>
      )}
      {active === 'calls' && (
        <>
          <PageHead eyebrow="Restaurant" title="Call history" description="Every call the concierge handled, with transcript and the actions it took." />
          <CallsPanel />
        </>
      )}
      {legacy && (
        <>
          <PageHead eyebrow={legacy.eyebrow} title={legacy.title} description={legacy.description} />
          <div className="lux-legacy">
            {active === 'voice' && <VoicePersonaConfig />}
            {active === 'prompt' && <MasterPromptControl />}
            {active === 'menu' && <MenuBuilder />}
            {active === 'floor' && <FloorPlanBuilder />}
            {active === 'deploy' && <DeployPanel onSwitchToOperations={onSwitchToOperations} />}
          </div>
        </>
      )}
    </Workspace>
  );
}
