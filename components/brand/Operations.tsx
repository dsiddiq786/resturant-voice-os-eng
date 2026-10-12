'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Armchair, CalendarDays, Flame, Bike, PhoneCall } from 'lucide-react';
import Workspace, { PageHead, Stats, SectionTitle, type Section } from '@/components/brand/Workspace';
import FloorCommand from '@/components/FloorCommand';
import KDSExpediter from '@/components/KDSExpediter';
import DeliveryDispatch from '@/components/DeliveryDispatch';
import ReservationsPanel, { useReservations } from '@/components/brand/data/ReservationsPanel';
import CallsPanel, { useCalls, needsAttention } from '@/components/brand/data/CallsPanel';
import { useApiList, todayISO } from '@/components/brand/data/useApiList';
import { useMounted } from '@/components/brand/useMounted';
import { useKDS } from '@/lib/kdsContext';
import { useDelivery } from '@/lib/deliveryContext';
import { useOwnerConfig } from '@/lib/ownerConfigContext';

type OpsTab = 'overview' | 'floor' | 'bookings' | 'kitchen' | 'delivery' | 'calls';

const TICKET: Record<string, { label: string; cls: string }> = {
  QUEUED: { label: 'Queued', cls: '' },
  IN_PROGRESS: { label: 'Cooking', cls: 'lp-badge-volt' },
  EXPEDITE_READY: { label: 'Ready', cls: 'lp-badge-ok' },
};
const SOURCE: Record<string, string> = { DINE_IN: 'Dine-in', VOICE_CALL: 'Phone', UBEREATS: 'Uber Eats', DOORDASH: 'DoorDash', SKIPTHEDISHES: 'SkipTheDishes' };

function Overview({ go }: { go: (t: OpsTab) => void }) {
  const { tickets, totalActiveOrders, isThrottled } = useKDS();
  const { activeDeliveryCount, killSwitchEngaged, platformStatus } = useDelivery();
  const reservations = useReservations();
  const calls = useCalls();
  const seating = useApiList<{ id: string; stage: string }>('/api/db/seating', 'seating');
  const mounted = useMounted();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const today = todayISO();
  const todays = reservations.items.filter(r => r.status === 'CONFIRMED' && r.reservation_date === today);
  const covers = todays.reduce((n, r) => n + Number(r.party_size || 0), 0);
  const free = seating.items.filter(t => t.stage === 'AVAILABLE').length;
  const attention = calls.items.filter(needsAttention).length;
  const paused = Object.values(platformStatus).filter(s => s === 'PAUSED').length;
  const pass = tickets
    .filter(t => t.status !== 'COMPLETED' && t.status !== 'BUMPED')
    .sort((a, b) => a.targetReadyTime - b.targetReadyTime)
    .slice(0, 5);

  return (
    <>
      <PageHead
        label={mounted ? new Date(now).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today'}
        title="Tonight’s service"
        actions={
          <>
            <span className={`lp-badge ${isThrottled ? 'lp-badge-bad' : 'lp-badge-ok'}`}>{isThrottled ? 'Kitchen at capacity' : 'Kitchen on pace'}</span>
            <span className={`lp-badge ${killSwitchEngaged ? 'lp-badge-bad' : paused ? 'lp-badge-warn' : 'lp-badge-ok'}`}>
              {killSwitchEngaged ? 'Delivery paused' : paused ? `${paused} delivery app paused` : 'Delivery apps open'}
            </span>
          </>
        }
      />
      <Stats
        items={[
          { label: 'Bookings today', value: reservations.loading ? '–' : todays.length, hint: `${covers} covers` },
          { label: 'Tables free now', value: seating.loading ? '–' : `${free}/${seating.items.length}` },
          { label: 'Kitchen tickets', value: totalActiveOrders },
          { label: 'Deliveries', value: activeDeliveryCount },
          { label: 'Calls need you', value: calls.loading ? '–' : attention },
        ]}
      />
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle title="Next bookings" action={<button type="button" onClick={() => go('bookings')} className="text-[14px] text-[var(--volt)]">All bookings</button>} />
          <ReservationsPanel compact limit={6} />
        </section>
        <section>
          <SectionTitle title="On the pass" action={<button type="button" onClick={() => go('kitchen')} className="text-[14px] text-[var(--volt)]">Kitchen</button>} />
          <div className="lp-card overflow-hidden">
            {pass.length === 0 ? (
              <div className="lp-empty"><h3>The pass is clear</h3><p>New tickets from the floor, phone and delivery land here.</p></div>
            ) : pass.map(t => {
              const st = TICKET[t.status] || TICKET.QUEUED;
              const mins = Math.max(0, Math.round((t.targetReadyTime - now) / 60000));
              return (
                <div key={t.id} className="lp-row grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{t.guestName}</p>
                    <p className="lp-muted truncate text-[13px]">{SOURCE[t.source] || t.source} · {t.items.length} items · ready in ~{mins} min</p>
                  </div>
                  <span className={`lp-badge ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="mt-8">
        <SectionTitle title="Latest calls" action={<button type="button" onClick={() => go('calls')} className="text-[14px] text-[var(--volt)]">All calls</button>} />
        <CallsPanel compact limit={4} />
      </section>
    </>
  );
}

export default function Operations() {
  const [active, setActive] = useState<OpsTab>('overview');
  const { ownerConfig, floorTables } = useOwnerConfig();
  const agent = ownerConfig.agent_name || 'Talkie';
  const { totalActiveOrders, isThrottled } = useKDS();
  const { activeDeliveryCount } = useDelivery();
  const calls = useCalls();
  const attention = useMemo(() => calls.items.some(needsAttention), [calls.items]);
  const syncKey = `${ownerConfig.restaurant_name}-${ownerConfig.last_deployed_at || floorTables.length}`;

  const sections: Section[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Service' },
    { id: 'floor', label: 'Floor', icon: Armchair, group: 'Service' },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays, group: 'Service' },
    { id: 'kitchen', label: 'Kitchen', icon: Flame, group: 'Production', count: totalActiveOrders, dot: isThrottled },
    { id: 'delivery', label: 'Delivery', icon: Bike, group: 'Production', count: activeDeliveryCount },
    { id: 'calls', label: 'Calls', icon: PhoneCall, group: agent, dot: attention },
  ];
  const framed = active === 'floor' || active === 'kitchen' || active === 'delivery';

  return (
    <Workspace product="Operations" venueName={ownerConfig.restaurant_name} sections={sections} active={active} onSelect={id => setActive(id as OpsTab)} framed={framed}>
      {active === 'overview' && <Overview go={setActive} />}
      {active === 'floor' && <FloorCommand key={`floor-${syncKey}`} />}
      {active === 'kitchen' && <KDSExpediter key={`kds-${syncKey}`} />}
      {active === 'delivery' && <DeliveryDispatch key={`dispatch-${syncKey}`} />}
      {active === 'bookings' && (
        <>
          <PageHead label="Service" title="Bookings" description={`Every table ${agent} has booked. Cancelling frees it for new callers right away.`} />
          <ReservationsPanel />
        </>
      )}
      {active === 'calls' && (
        <>
          <PageHead label={agent} title="Calls" description={`Calls ${agent} handled, with transcripts and every booking step it took.`} />
          <CallsPanel />
        </>
      )}
    </Workspace>
  );
}
