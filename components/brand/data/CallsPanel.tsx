'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useApiList } from './useApiList';
import { useOwnerConfig } from '@/lib/ownerConfigContext';

export interface CallRow {
  id: string;
  caller_name: string;
  caller_phone: string;
  start_time: string;
  duration_seconds: number;
  intent: string;
  transcript: Array<{ role: string; text: string }>;
  tool_calls: Array<{ name: string; result?: { status?: string } }>;
  reservation_summary: string | null;
  order_summary: string | null;
}

export function useCalls() {
  return useApiList<CallRow>('/api/db/calls?limit=100', 'calls');
}

// A call needs a person when the host recorded a callback request, or a booking-system step failed.
export function needsAttention(c: CallRow) {
  return c.intent === 'handoff' || (c.tool_calls || []).some(t => t.result?.status === 'error');
}

const INTENT: Record<string, { label: string; cls: string }> = {
  reservation: { label: 'Booking', cls: 'lp-badge-volt' },
  takeout: { label: 'Takeout', cls: 'lp-badge-ok' },
  handoff: { label: 'Callback', cls: 'lp-badge-warn' },
  inquiry: { label: 'Question', cls: '' },
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const dur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

export default function CallsPanel({ limit, compact = false, attentionOnly = false }: { limit?: number; compact?: boolean; attentionOnly?: boolean }) {
  const { items, loading, error, refresh } = useCalls();
  const agent = useOwnerConfig().ownerConfig.agent_name || 'Talkie';
  const [filter, setFilter] = useState<'all' | 'attention' | 'reservation' | 'takeout'>(attentionOnly ? 'attention' : 'all');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = items;
    if (filter === 'attention') list = list.filter(needsAttention);
    else if (filter !== 'all') list = list.filter(c => c.intent === filter);
    return limit ? list.slice(0, limit) : list;
  }, [items, filter, limit]);

  return (
    <div>
      {!compact && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="lp-seg" role="tablist" aria-label="Filter calls">
            {([['all', 'All'], ['attention', 'Needs you'], ['reservation', 'Bookings'], ['takeout', 'Orders']] as const).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={refresh} className="lp-btn lp-btn-light lp-btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      )}
      {error && <p className="mb-3 text-[14px] text-[var(--bad)]">Could not load calls: {error}</p>}

      <div className="lp-card overflow-hidden">
        {!loading && rows.length === 0 && !error ? (
          <div className="lp-empty">
            <h3>{filter === 'attention' ? 'Nothing needs you' : 'No calls yet'}</h3>
            <p>{filter === 'attention' ? 'Callback requests and failed bookings appear here.' : `Calls ${agent} handles are logged here when they end.`}</p>
          </div>
        ) : rows.map(c => {
          const intent = INTENT[c.intent] || INTENT.inquiry;
          const summary = c.reservation_summary || c.order_summary || (c.intent === 'handoff' ? 'Asked for the team to call back.' : 'General question');
          const expanded = open === c.id;
          return (
            <div key={c.id} className="border-t border-[var(--paper-line)] first:border-t-0">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : c.id)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-black/[0.015] sm:grid-cols-[140px_minmax(0,1fr)_auto]"
              >
                <div className="hidden sm:block">
                  <p className="text-[13.5px]">{when(c.start_time)}</p>
                  <p className="lp-muted text-[12.5px]">{dur(c.duration_seconds || 0)}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{c.caller_name}</p>
                  <p className="lp-muted truncate text-[13px]">{summary}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  {needsAttention(c) && c.intent !== 'handoff' && <span className="lp-badge lp-badge-bad">Error</span>}
                  <span className={`lp-badge ${intent.cls}`}>{intent.label}</span>
                  <ChevronDown size={16} className={`text-[var(--on-paper-muted)] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expanded && (
                <div className="lp-enter grid gap-6 bg-[#fafbfc] px-5 py-5 md:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="space-y-2.5">
                    <p className="lp-label lp-muted">Transcript</p>
                    {(c.transcript || []).length === 0
                      ? <p className="lp-muted text-[14px]">No transcript was recorded for this call.</p>
                      : c.transcript.map((t, i) => (
                        <p key={i} className="text-[14.5px] leading-relaxed">
                          <span className={`lp-label mr-2 ${t.role === 'agent' ? 'text-[var(--volt)]' : 'lp-muted'}`}>{t.role === 'agent' ? agent : 'Caller'}</span>
                          {t.text}
                        </p>
                      ))}
                  </div>
                  <div className="space-y-2">
                    <p className="lp-label lp-muted">{agent}&rsquo;s actions</p>
                    {(c.tool_calls || []).length === 0
                      ? <p className="lp-muted text-[14px]">None</p>
                      : c.tool_calls.map((t, i) => (
                        <p key={i} className="flex justify-between gap-3 text-[13px]"><span>{t.name.replace(/_/g, ' ')}</span><span className="lp-muted">{t.result?.status || '—'}</span></p>
                      ))}
                    <p className="lp-muted pt-2 text-[13px]">{c.caller_phone}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
