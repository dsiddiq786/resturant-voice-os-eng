'use client';

import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApiList, todayISO, time12, dateLong } from './useApiList';
import { PRODUCT_NAME } from '@/components/brand/product';

export interface ReservationRow {
  id: string;
  confirmation_code: string;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  table_id: string | null;
  special_requests: string;
  status: 'CONFIRMED' | 'CANCELLED';
  created_at: string;
}

export function useReservations() {
  return useApiList<ReservationRow>('/api/db/reservations?limit=200', 'reservations');
}

function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return digits;
}

export default function ReservationsPanel({ limit, compact = false }: { limit?: number; compact?: boolean }) {
  const { items, loading, error, refresh } = useReservations();
  const agent = PRODUCT_NAME;
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'cancelled'>('upcoming');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const today = todayISO();

  const rows = useMemo(() => {
    let list = items;
    if (compact || filter === 'upcoming') {
      list = list
        .filter(r => r.status === 'CONFIRMED' && r.reservation_date >= today)
        .sort((a, b) => (a.reservation_date + a.reservation_time).localeCompare(b.reservation_date + b.reservation_time));
    } else if (filter === 'cancelled') {
      list = list.filter(r => r.status === 'CANCELLED');
    }
    return limit ? list.slice(0, limit) : list;
  }, [items, filter, limit, today, compact]);

  const cancel = async (row: ReservationRow) => {
    if (!window.confirm(`Cancel ${row.customer_name}'s table for ${row.party_size} on ${dateLong(row.reservation_date)} at ${time12(row.reservation_time)}?`)) return;
    setBusy(row.id);
    setActionError(null);
    try {
      const res = await fetch('/api/db/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id: row.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not cancel');
      await refresh();
    } catch (e: any) {
      setActionError(e?.message || 'Could not cancel');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {!compact && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="lp-seg" role="tablist" aria-label="Filter reservations">
            {(['upcoming', 'all', 'cancelled'] as const).map(f => (
              <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className="capitalize">{f}</button>
            ))}
          </div>
          <button type="button" onClick={refresh} className="lp-btn lp-btn-light lp-btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      )}
      {error && <p className="mb-3 text-[14px] text-[var(--bad)]">Could not load reservations: {error}</p>}
      {actionError && <p className="mb-3 text-[14px] text-[var(--bad)]">{actionError}</p>}

      <div className="lp-card overflow-hidden">
        {!loading && rows.length === 0 && !error ? (
          <div className="lp-empty">
            <h3>{filter === 'cancelled' && !compact ? 'No cancellations' : 'No upcoming bookings'}</h3>
            <p>Bookings {agent} confirms on calls show up here the moment they are saved.</p>
          </div>
        ) : (
          rows.map(r => {
            const past = r.reservation_date < today;
            return (
              <div key={r.id} className={`lp-row grid-cols-[88px_minmax(0,1fr)_auto] ${compact ? 'sm:grid-cols-[100px_minmax(0,1fr)_auto]' : 'sm:grid-cols-[110px_minmax(0,1fr)_120px_auto]'}`}>
                <div>
                  <p className="font-[family-name:var(--f-display)] text-[19px] font-semibold tracking-[-0.02em] lp-num">{time12(r.reservation_time)}</p>
                  <p className="lp-muted text-[12.5px]">{dateLong(r.reservation_date)}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{r.customer_name} <span className="lp-muted font-normal">· {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}</span></p>
                  <p className="lp-muted truncate text-[13px]">
                    {formatPhone(r.customer_phone)}{r.table_id ? ` · Table ${r.table_id}` : ''}{r.special_requests ? ` · ${r.special_requests}` : ''}
                  </p>
                </div>
                {!compact && <p className="lp-label lp-muted hidden sm:block">{r.confirmation_code}</p>}
                <div className="flex items-center justify-end gap-3">
                  {r.status === 'CANCELLED' ? <span className="lp-badge">Cancelled</span>
                    : past ? <span className="lp-badge">Past</span>
                    : <span className="lp-badge lp-badge-ok">Confirmed</span>}
                  {!compact && r.status === 'CONFIRMED' && !past && (
                    <button type="button" onClick={() => cancel(r)} disabled={busy === r.id} className="text-[13px] text-[var(--on-paper-muted)] underline-offset-4 hover:text-[var(--bad)] hover:underline">
                      {busy === r.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
