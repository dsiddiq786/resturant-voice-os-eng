'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import SiteNav, { ArrowChip } from '@/components/brand/SiteNav';
import { PRODUCT_NAME } from '@/components/brand/product';

export interface Section {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  count?: number | null;
  dot?: boolean;
}

interface Props {
  product: string;
  venueName: string;
  sections: Section[];
  active: string;
  onSelect: (id: string) => void;
  framed?: boolean;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}

/** Light workspace used by the Owner portal and Operations: paper surfaces, one sidebar, one content column. */
export default function Workspace({ product, venueName, sections, active, onSelect, framed, sidebarFooter, children }: Props) {
  const groups = Array.from(new Set(sections.map(s => s.group)));
  const agent = PRODUCT_NAME;
  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_520px_at_85%_-8%,rgba(127,216,255,.22),transparent_60%),radial-gradient(900px_420px_at_0%_0%,rgba(59,99,255,.08),transparent_60%)] bg-[var(--paper)]">
      <SiteNav
        light
        action={<Link href="/" className="lp-btn lp-btn-primary lp-btn-sm">Talk to {agent}<ArrowChip /></Link>}
      />
      <div className="lp-app">
        <aside className="lp-side" aria-label={`${product} sections`}>
          <div className="lp-side-title">
            <p className="lp-label lp-muted">{product}</p>
            <p className="mt-1 font-[family-name:var(--f-display)] text-[22px] font-semibold tracking-[-0.03em]">{venueName}</p>
          </div>
          {groups.map(g => (
            <div key={g}>
              <p className="lp-side-group">{g}</p>
              {sections.filter(s => s.group === g).map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.id} type="button" className="lp-side-link" aria-current={active === s.id ? 'page' : undefined} onClick={() => onSelect(s.id)}>
                    <Icon size={18} strokeWidth={1.8} />
                    {s.label}
                    {s.dot ? <span className="lp-side-dot" aria-label="Needs attention" /> : typeof s.count === 'number' ? <span className="lp-side-count">{s.count}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
          {sidebarFooter}
        </aside>

        <main className="lp-main">
          <nav className="lp-tabs" aria-label={`${product} sections`}>
            {sections.map(s => (
              <button key={s.id} type="button" aria-current={active === s.id ? 'page' : undefined} onClick={() => onSelect(s.id)}>{s.label}</button>
            ))}
          </nav>
          <div key={active} className="lp-enter">
            {framed ? (
              <div className="lp-legacy h-[calc(100dvh-136px)] overflow-hidden rounded-[var(--r-card)] border border-[var(--paper-line)] bg-white max-[960px]:h-[calc(100dvh-170px)]">
                {children}
              </div>
            ) : children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHead({ label, title, description, actions }: {
  label: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="lp-head">
      <div className="max-w-2xl">
        <p className="lp-label lp-muted">{label}</p>
        <h1 className="lp-title mt-2">{title}</h1>
        {description && <p className="lp-muted mt-3 text-[15.5px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stats({ items }: { items: Array<{ label: string; value: React.ReactNode; hint?: string }> }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
      {items.map(s => (
        <div key={s.label} className="lp-card lp-stat">
          <p className="lp-stat-value">{s.value}</p>
          <p className="mt-2 text-[14px] text-[var(--on-paper)]">{s.label}</p>
          {s.hint && <p className="lp-muted text-[13px]">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 px-1">
      <h2 className="font-[family-name:var(--f-display)] text-[20px] font-semibold tracking-[-0.025em]">{title}</h2>
      {action}
    </div>
  );
}
