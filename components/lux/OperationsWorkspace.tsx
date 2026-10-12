'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Armchair, CalendarDays, Flame, Bike, PhoneCall, ArrowRight } from 'lucide-react';
import Workspace, { PageHead, Figures, type WorkspaceSection } from '@/components/lux/Workspace';
import FloorCommand from '@/components/FloorCommand';
import KDSExpediter from '@/components/KDSExpediter';
import DeliveryDispatch from '@/components/DeliveryDispatch';
import ReservationsPanel, { useReservations } from '@/components/lux/data/ReservationsPanel';
import CallsPanel, { useCalls, needsAttention } from '@/components/lux/data/CallsPanel';
import { useApiList, todayISO } from '@/components/lux/data/useApiList';
import { useKDS } from '@/lib/kdsContext';
import { useDelivery } from '@/lib/deliveryContext';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { useMounted } from '@/components/lux/useMounted';

type OpsSection = 'overview' | 'floor' | 'reservations' | 'kitchen' | 'delivery' | 'calls';

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  QUEUED: { label: 'Queued', cls: 'lux-badge-quiet' },
  IN_PROGRESS: { label: 'Firing', cls: 'lux-badge-gold' },
  EXPEDITE_READY: { label: 'Ready to run', cls: 'lux-badge-ok' },
};

const SOURCE_LABEL: Record<string, string> = {
  DINE_IN: 'Dine-in', VOICE_CALL: 'Phone', UBEREATS: 'Uber Eats', DOORDASH: 'DoorDash', SKIPTHEDISHES: 'SkipTheDishes',
};

function Overview({ go }: { go: (s: OpsSection) => void }) {
  const { ownerConfig } = useOwnerConfig();
  const { tickets, totalActiveOrders, isThrottled } = useKDS();
  const { activeDeliveryCount, killSwitchEngaged, platformStatus } = useDelivery();
  const reservations = useReservations();
  const calls = useCalls();
  const seating = useApiList<{ id: string; stage: string; capacity: number }>('/api/db/seating', 'seating');
  const today = todayISO();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const todays = reservations.items.filter(r => r.status === 'CONFIRMED' && r.reservation_date === today);
  const covers = todays.reduce((sum, r) => sum + Number(r.party_size || 0), 0);
  const freeTables = seating.items.filter(t => t.stage === 'AVAILABLE').length;
  const attention = calls.items.filter(needsAttention).length;
  const activeTickets = tickets
    .filter(t => t.status !== 'COMPLETED' && t.status !== 'BUMPED')
    .sort((a, b) => a.targetReadyTime - b.targetReadyTime)
    .slice(0, 5);
  const pausedChannels = Object.entries(platformStatus).filter(([, s]) => s === 'PAUSED').map(([p]) => p);
  const mounted = useMounted();
  const dateLabel = mounted ? new Date(now).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today';

  return (
    <>
      <PageHead
        eyebrow={dateLabel}
        title={<>Tonight at <em className="italic text-[var(--lux-champagne)]">{ownerConfig.restaurant_name}</em></>}
        description="Live service at a glance: who is booked, what the kitchen is firing, and which calls need a person."
        actions={
          <>
            <span className={`lux-badge ${isThrottled ? 'lux-badge-bad' : 'lux-badge-ok'}`}>{isThrottled ? 'Kitchen at capacity' : 'Kitchen pacing normally'}</span>
            <span className={`lux-badge ${killSwitchEngaged ? 'lux-badge-bad' : pausedChannels.length ? 'lux-badge-warn' : 'lux-badge-ok'}`}>
              {killSwitchEngaged ? 'Delivery paused' : pausedChannels.length ? `${pausedChannels.length} delivery channel paused` : 'Delivery channels open'}
            </span>
          </>
        }
      />

      <Figures
        items={[
          { label: 'Reservations today', value: reservations.loading ? '–' : todays.length, hint: `${covers} covers` },
          { label: 'Tables free now', value: seating.loading ? '–' : `${freeTables}/${seating.items.length}` },
          { label: 'Kitchen tickets open', value: totalActiveOrders },
          { label: 'Deliveries in progress', value: activeDeliveryCount },
          { label: 'Calls needing attention', value: calls.loading ? '–' : attention },
        ]}
      />

      <div className="mt-14 grid gap-14 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="lux-section-title">Next reservations</h2>
            <button type="button" onClick={() => go('reservations')} className="lux-navlink text-[13px] inline-flex items-center gap-1.5">All reservations <ArrowRight size={14} /></button>
          </div>
          <ReservationsPanel upcomingOnly limit={6} allowCancel={false} />
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="lux-section-title">On the pass</h2>
            <button type="button" onClick={() => go('kitchen')} className="lux-navlink text-[13px] inline-flex items-center gap-1.5">Kitchen <ArrowRight size={14} /></button>
          </div>
          {activeTickets.length === 0 ? (
            <div className="lux-empty"><h3>The pass is clear</h3><p className="text-[13.5px]">New tickets from the floor, phone and delivery land here.</p></div>
          ) : (
            <div className="border-t border-[var(--lux-line)]">
              {activeTickets.map(t => {
                const status = TICKET_STATUS[t.status] || TICKET_STATUS.QUEUED;
                const mins = Math.max(0, Math.round((t.targetReadyTime - now) / 60000));
                return (
                  <div key={t.id} className="lux-row grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-medium">{t.guestName}</p>
                      <p className="mt-1 truncate text-[12.5px] lux-muted">
                        {SOURCE_LABEL[t.source] || t.source} · {t.items.length} {t.items.length === 1 ? 'item' : 'items'}{t.tableNumber ? ` · ${t.tableNumber}` : ''} · ready in ~{mins} min
                      </p>
                    </div>
                    <span className={`lux-badge ${status.cls}`}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="lux-section-title">Latest calls</h2>
          <button type="button" onClick={() => go('calls')} className="lux-navlink text-[13px] inline-flex items-center gap-1.5">Call log <ArrowRight size={14} /></button>
        </div>
        <CallsPanel compact limit={4} />
      </section>
    </>
  );
}

export default function OperationsWorkspace() {
  const [active, setActive] = useState<OpsSection>('overview');
  const { ownerConfig, floorTables } = useOwnerConfig();
  const { totalActiveOrders, isThrottled } = useKDS();
  const { activeDeliveryCount } = useDelivery();
  const calls = useCalls();
  const attention = useMemo(() => calls.items.some(needsAttention), [calls.items]);
  const syncKey = `${ownerConfig.restaurant_name}-${ownerConfig.last_deployed_at || floorTables.length}`;

  const sections: WorkspaceSection[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Service' },
    { id: 'floor', label: 'Floor & tables', icon: Armchair, group: 'Service' },
    { id: 'reservations', label: 'Reservations', icon: CalendarDays, group: 'Service' },
    { id: 'kitchen', label: 'Kitchen', icon: Flame, group: 'Production', count: totalActiveOrders, attention: isThrottled },
    { id: 'delivery', label: 'Delivery & takeout', icon: Bike, group: 'Production', count: activeDeliveryCount },
    { id: 'calls', label: 'Calls', icon: PhoneCall, group: 'Concierge', attention },
  ];

  const legacy = active === 'floor' || active === 'kitchen' || active === 'delivery';

  return (
    <Workspace
      product="Operations"
      venueName={ownerConfig.restaurant_name}
      sections={sections}
      active={active}
      onSelect={id => setActive(id as OpsSection)}
      fullBleed={legacy}
      sidebarFooter={
        <Link href="/owner" className="lux-side-link">
          <ArrowRight size={17} strokeWidth={1.6} />
          <span>Owner Portal</span>
        </Link>
      }
    >
      {active === 'overview' && <Overview go={setActive} />}
      {active === 'floor' && <div className="h-full w-full overflow-hidden"><FloorCommand key={`floor-${syncKey}`} /></div>}
      {active === 'kitchen' && <div className="h-full w-full overflow-hidden"><KDSExpediter key={`kds-${syncKey}`} /></div>}
      {active === 'delivery' && <div className="h-full w-full overflow-hidden"><DeliveryDispatch key={`dispatch-${syncKey}`} /></div>}
      {active === 'reservations' && (
        <>
          <PageHead
            eyebrow="Service"
            title="Reservations"
            description="Every booking the AI concierge has saved. Cancelling here frees the table immediately for new callers."
          />
          <ReservationsPanel />
        </>
      )}
      {active === 'calls' && (
        <>
          <PageHead
            eyebrow="Concierge"
            title="Calls"
            description="Calls the AI concierge handled, with transcripts and every booking-system action it took."
          />
          <CallsPanel />
        </>
      )}
    </Workspace>
  );
}
