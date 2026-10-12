'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Home, AudioLines, ScrollText, UtensilsCrossed, Armchair, CalendarDays, PhoneCall, PlugZap, Rocket, Loader2, Check,
} from 'lucide-react';
import Workspace, { PageHead, Stats, SectionTitle, type Section } from '@/components/brand/Workspace';
import { ArrowChip } from '@/components/brand/SiteNav';
import VoicePersonaConfig from './VoicePersonaConfig';
import FloorPlanBuilder from './FloorPlanBuilder';
import MenuBuilder from './MenuBuilder';
import DeployPanel from './DeployPanel';
import MasterPromptControl from './MasterPromptControl';
import ReservationsPanel, { useReservations } from '@/components/brand/data/ReservationsPanel';
import CallsPanel, { useCalls, needsAttention } from '@/components/brand/data/CallsPanel';
import { todayISO } from '@/components/brand/data/useApiList';
import { useMounted } from '@/components/brand/useMounted';
import { useOwnerConfig } from '@/lib/ownerConfigContext';

export type OwnerNavTab = 'home' | 'host' | 'prompt' | 'menu' | 'floor' | 'bookings' | 'calls' | 'integrations' | 'publish';

interface OwnerControlPanelProps {
  onSwitchToOperations?: () => void;
}

function PublishButton({ small = true }: { small?: boolean }) {
  const { saveAndDeploy, isDeploying, deploySuccess, hasUnsavedChanges } = useOwnerConfig();
  return (
    <button type="button" onClick={saveAndDeploy} disabled={isDeploying || !hasUnsavedChanges} className={`lp-btn lp-btn-primary ${small ? 'lp-btn-sm' : ''}`}>
      {isDeploying ? 'Publishing' : deploySuccess ? 'Published' : 'Publish changes'}
      <span className="lp-chip" aria-hidden="true">
        {isDeploying ? <Loader2 className="animate-spin" /> : deploySuccess ? <Check /> : <Rocket />}
      </span>
    </button>
  );
}

// ---------------- Home ----------------
function HomeView({ go }: { go: (t: OwnerNavTab) => void }) {
  const { ownerConfig, selectedVoice, menuItems, hasUnsavedChanges } = useOwnerConfig();
  const agent = ownerConfig.agent_name || 'Talkie';
  const mounted = useMounted();
  const calls = useCalls();
  const reservations = useReservations();
  const today = todayISO();
  const attention = calls.items.filter(needsAttention).length;
  const upcoming = reservations.items.filter(r => r.status === 'CONFIRMED' && r.reservation_date >= today).length;
  const available = menuItems.filter(m => !m.is_86).length;
  const published = ownerConfig.last_deployed_at && mounted
    ? new Date(ownerConfig.last_deployed_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

  return (
    <>
      <PageHead label="Owner portal" title="Your restaurant at a glance" />

      {/* The host, front and centre */}
      <section className="lp-panel lp-dark mb-8 overflow-hidden p-7 sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="lp-label text-[var(--ion)]">{agent} · your AI host</p>
            <p className="mt-4 font-[family-name:var(--f-display)] text-[clamp(1.6rem,2.6vw,2.3rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
              &ldquo;{ownerConfig.greeting}&rdquo;
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
              <span className="lp-step">Voice <b>{selectedVoice?.name || ownerConfig.voice_name}</b></span>
              <span className="lp-step">Tone <b>{ownerConfig.tone}</b></span>
              <span className="lp-step" data-s={hasUnsavedChanges ? 'warn' : 'ok'}>Status <b>{hasUnsavedChanges ? 'Unpublished changes' : 'Live'}</b></span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <p className="lp-label text-[var(--on-ink-muted)]">Last published · {published}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="lp-btn lp-btn-primary">Talk to {agent}<ArrowChip /></Link>
              <button type="button" onClick={() => go('host')} className="lp-btn lp-btn-ghost">Edit {agent}</button>
            </div>
          </div>
        </div>
      </section>

      <Stats
        items={[
          { label: 'Calls handled', value: calls.loading ? '–' : calls.items.length },
          { label: 'Need you', value: calls.loading ? '–' : attention, hint: 'Callbacks and errors' },
          { label: `Bookings by ${agent}`, value: reservations.loading ? '–' : reservations.items.length, hint: `${upcoming} upcoming` },
          { label: 'Dishes on offer', value: `${available}/${menuItems.length}`, hint: `${menuItems.length - available} sold out` },
        ]}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section>
          <SectionTitle title="Needs you" action={<button type="button" onClick={() => go('calls')} className="text-[14px] text-[var(--volt)]">All calls</button>} />
          <CallsPanel compact attentionOnly limit={4} />
        </section>
        <section>
          <SectionTitle title="Upcoming bookings" action={<button type="button" onClick={() => go('bookings')} className="text-[14px] text-[var(--volt)]">All bookings</button>} />
          <ReservationsPanel compact limit={5} />
        </section>
      </div>
    </>
  );
}

// ---------------- Host (profile + voice) ----------------
function HostView() {
  const { ownerConfig, updateOwnerConfig, lastDeployedMessage } = useOwnerConfig();
  const agent = ownerConfig.agent_name || 'Talkie';
  return (
    <>
      <PageHead
        label="Voice & greeting"
        title={`How ${agent} sounds`}
        description="The host's name, your restaurant details and the greeting callers hear first. Publish to make changes live."
        actions={<PublishButton />}
      />
      <div className="lp-card lp-card-pad mb-6 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-[14px] font-medium">Host name</span>
          <input className="lp-input" value={ownerConfig.agent_name ?? 'Talkie'} onChange={e => updateOwnerConfig({ agent_name: e.target.value })} />
          <span className="lp-muted text-[13px]">What the AI host calls itself on every call.</span>
        </label>
        <label className="grid gap-2">
          <span className="text-[14px] font-medium">Restaurant name</span>
          <input className="lp-input" value={ownerConfig.restaurant_name} onChange={e => updateOwnerConfig({ restaurant_name: e.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="text-[14px] font-medium">Location callers hear</span>
          <input className="lp-input" value={ownerConfig.venue || ''} onChange={e => updateOwnerConfig({ venue: e.target.value })} />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-[14px] font-medium">Greeting</span>
          <textarea rows={2} className="lp-input" value={ownerConfig.greeting} onChange={e => updateOwnerConfig({ greeting: e.target.value })} />
          <span className="lp-muted text-[13px]">{agent} says exactly this when it answers.</span>
        </label>
        <label className="flex items-center justify-between gap-6 rounded-[14px] border border-[var(--paper-line)] px-4 py-3.5 md:col-span-2">
          <span>
            <span className="block text-[14.5px] font-medium">Friendly Canadian phrasing</span>
            <span className="lp-muted block text-[13px]">Natural fillers and words like washroom and bill.</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--volt)]" checked={ownerConfig.canadian_dialect !== false} onChange={e => updateOwnerConfig({ canadian_dialect: e.target.checked })} />
        </label>
        {lastDeployedMessage && <p className="lp-muted text-[13.5px] md:col-span-2">{lastDeployedMessage}</p>}
      </div>
      <SectionTitle title="Voice" />
      <div className="lp-legacy lp-card overflow-hidden p-1"><VoicePersonaConfig /></div>
    </>
  );
}

// ---------------- Integrations ----------------
const PROVIDERS = [
  { name: 'Leed Pizza booking book', state: 'Connected', note: 'Talkie checks availability, books, changes and cancels here.' },
  { name: 'OpenTable', state: 'Needs partner access', note: 'Requires approval as an OpenTable integration partner and a production agreement.' },
  { name: 'TouchBistro', state: 'Needs partner access', note: 'Partner-only API. Requires TouchBistro partner program approval.' },
  { name: 'Lightspeed Restaurant', state: 'Needs partner access', note: 'Reservations for Platforms API, for approved Lightspeed developer accounts.' },
  { name: 'POS KING', state: 'Not available', note: 'No public API documentation found. Needs a vendor contact.' },
];

function IntegrationsView() {
  return (
    <>
      <PageHead label="Integrations" title="Where bookings live" description="Only the local booking book is connected. Nothing is synced to outside platforms yet." />
      <div className="lp-card overflow-hidden">
        {PROVIDERS.map(p => (
          <div key={p.name} className="lp-row grid-cols-[minmax(0,1fr)_auto] py-5">
            <div className="min-w-0">
              <p className="font-[family-name:var(--f-display)] text-[18px] font-semibold tracking-[-0.02em]">{p.name}</p>
              <p className="lp-muted text-[14px]">{p.note}</p>
            </div>
            <span className={`lp-badge ${p.state === 'Connected' ? 'lp-badge-ok' : ''}`}>{p.state}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------- Shell ----------------
export default function OwnerControlPanel({ onSwitchToOperations }: OwnerControlPanelProps) {
  const [active, setActive] = useState<OwnerNavTab>('home');
  const { ownerConfig, hasUnsavedChanges, menuItems } = useOwnerConfig();
  const agent = ownerConfig.agent_name || 'Talkie';
  const calls = useCalls();
  const attention = useMemo(() => calls.items.some(needsAttention), [calls.items]);

  const sections: Section[] = [
    { id: 'home', label: 'Home', icon: Home, group: 'Overview' },
    { id: 'host', label: 'Voice & greeting', icon: AudioLines, group: agent },
    { id: 'prompt', label: 'Instructions', icon: ScrollText, group: agent },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed, group: 'Restaurant', count: menuItems.length },
    { id: 'floor', label: 'Floor plan', icon: Armchair, group: 'Restaurant' },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays, group: 'Restaurant' },
    { id: 'calls', label: 'Calls', icon: PhoneCall, group: 'Restaurant', dot: attention },
    { id: 'integrations', label: 'Integrations', icon: PlugZap, group: 'Settings' },
    { id: 'publish', label: 'Publish', icon: Rocket, group: 'Settings', dot: hasUnsavedChanges },
  ];

  const legacy: Partial<Record<OwnerNavTab, { label: string; title: string; description: string; body: React.ReactNode }>> = {
    prompt: { label: agent, title: 'Instructions', description: `House rules ${agent} follows on every call.`, body: <MasterPromptControl /> },
    menu: { label: 'Restaurant', title: 'Menu', description: `Dishes, prices and what’s sold out. ${agent} only offers what’s available here.`, body: <MenuBuilder /> },
    floor: { label: 'Restaurant', title: 'Floor plan', description: `Tables and seats ${agent} uses for every availability check.`, body: <FloorPlanBuilder /> },
    publish: { label: 'Settings', title: 'Publish', description: 'Review your changes and make them live for callers.', body: <DeployPanel onSwitchToOperations={onSwitchToOperations} /> },
  };
  const page = legacy[active];

  return (
    <Workspace
      product="Owner portal"
      venueName={ownerConfig.restaurant_name}
      sections={sections}
      active={active}
      onSelect={id => setActive(id as OwnerNavTab)}
      sidebarFooter={
        hasUnsavedChanges ? (
          <div className="lp-card mx-1 p-4">
            <p className="text-[13.5px] font-medium">You have unpublished changes</p>
            <div className="mt-3"><PublishButton /></div>
          </div>
        ) : null
      }
    >
      {active === 'home' && <HomeView go={setActive} />}
      {active === 'host' && <HostView />}
      {active === 'integrations' && <IntegrationsView />}
      {active === 'bookings' && (
        <>
          <PageHead label="Restaurant" title="Bookings" description={`Every table ${agent} has booked. Cancelling frees it for new callers right away.`} />
          <ReservationsPanel />
        </>
      )}
      {active === 'calls' && (
        <>
          <PageHead label="Restaurant" title="Calls" description={`Every call ${agent} handled, with the transcript and what it did.`} />
          <CallsPanel />
        </>
      )}
      {page && (
        <>
          <PageHead label={page.label} title={page.title} description={page.description} actions={active !== 'publish' ? <PublishButton /> : undefined} />
          <div className="lp-legacy lp-card overflow-hidden p-1">{page.body}</div>
        </>
      )}
    </Workspace>
  );
}
