'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import SiteNav from '@/components/lux/SiteNav';

export interface WorkspaceSection {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  count?: number | null;
  attention?: boolean;
}

interface Props {
  product: string;
  venueName: string;
  sections: WorkspaceSection[];
  active: string;
  onSelect: (id: string) => void;
  fullBleed?: boolean;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}

export default function Workspace({ product, venueName, sections, active, onSelect, fullBleed, sidebarFooter, children }: Props) {
  const groups = Array.from(new Set(sections.map(s => s.group)));

  return (
    <div className="min-h-dvh bg-[var(--lux-ink)]">
      <SiteNav solid />
      <div className="lux-app">
        <aside className="lux-sidebar" aria-label={`${product} sections`}>
          <div className="px-3">
            <p className="lux-eyebrow">{product}</p>
            <p className="lux-serif mt-2 text-[24px] leading-tight">{venueName}</p>
          </div>
          {groups.map(group => (
            <div key={group}>
              <p className="lux-side-group-title">{group}</p>
              <div className="space-y-0.5">
                {sections.filter(s => s.group === group).map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="lux-side-link"
                      aria-current={active === s.id ? 'page' : undefined}
                      onClick={() => onSelect(s.id)}
                    >
                      <Icon size={17} strokeWidth={1.6} />
                      <span>{s.label}</span>
                      {s.attention ? (
                        <span className="ml-auto h-2 w-2 rounded-full bg-[var(--lux-warn)]" aria-label="Needs attention" />
                      ) : typeof s.count === 'number' ? (
                        <span className="lux-side-count">{s.count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {sidebarFooter && <div className="mt-auto">{sidebarFooter}</div>}
        </aside>

        <div className="min-w-0">
          <nav className="lux-tabs" aria-label={`${product} sections`}>
            {sections.map(s => (
              <button key={s.id} type="button" aria-current={active === s.id ? 'page' : undefined} onClick={() => onSelect(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
          {fullBleed ? (
            <main key={active} className="lux-legacy lux-fade h-[calc(100dvh-64px)] min-w-0 overflow-hidden max-[960px]:h-[calc(100dvh-121px)]">
              {children}
            </main>
          ) : (
            <main key={active} className="lux-main lux-fade">{children}</main>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageHead({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="lux-page-head">
      <div className="max-w-2xl">
        <p className="lux-eyebrow">{eyebrow}</p>
        <h1 className="lux-page-title mt-3">{title}</h1>
        {description && <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--lux-ivory-2)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

export function Figures({ items }: { items: Array<{ label: string; value: React.ReactNode; hint?: string }> }) {
  return (
    <div className="lux-figures">
      <div className="lux-figures-inner">
        {items.map(item => (
          <div key={item.label} className="lux-figure">
            <p className="lux-figure-value">{item.value}</p>
            <p className="lux-figure-label">{item.label}{item.hint ? <span className="block text-[11.5px] text-[var(--lux-ivory-4)] mt-1">{item.hint}</span> : null}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
