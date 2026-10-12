'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';
import { PRODUCT_NAME } from '@/components/brand/product';

const LINKS = [
  { href: '/', label: 'Concierge' },
  { href: '/operations', label: 'Operations' },
  { href: '/owner', label: 'Owner portal' },
];

export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#3B63FF" />
      <rect x="8.5" y="12" width="3" height="8" rx="1.5" fill="#fff" />
      <rect x="14.5" y="8" width="3" height="16" rx="1.5" fill="#fff" />
      <rect x="20.5" y="11" width="3" height="10" rx="1.5" fill="#fff" />
      <circle cx="25.5" cy="7" r="2.2" fill="#7FD8FF" />
    </svg>
  );
}

export function ArrowChip() {
  return (
    <span className="lp-chip" aria-hidden="true">
      <ArrowRight strokeWidth={2.2} />
      <ArrowRight strokeWidth={2.2} />
    </span>
  );
}

/**
 * Floating glass pill navigation. `light` pages (Owner portal, Operations) use the paper variant;
 * on the dark concierge page it switches to the paper variant while it sits over a light sheet.
 */
export default function SiteNav({ light = false, action }: { light?: boolean; action?: React.ReactNode }) {
  const pathname = usePathname();
  const [overLight, setOverLight] = useState(light);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (light) return;
    const check = () => {
      const y = 44;
      const sheets = Array.from(document.querySelectorAll('.lp-sheet'));
      setOverLight(sheets.some(s => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; }));
    };
    const first = requestAnimationFrame(check);
    window.addEventListener('scroll', check, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener('scroll', check);
    };
  }, [light]);

  const onLight = light || overLight;
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <>
      <header className={`lp-nav ${onLight ? 'on-light' : ''}`}>
        <div className="lp-nav-in">
          <Link href="/" className="lp-brand" aria-label={`${PRODUCT_NAME} home`}>
            <BrandMark />
            {PRODUCT_NAME}
          </Link>
          <nav aria-label="Primary" className="lp-navlinks max-[860px]:hidden">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} className="lp-navlink" aria-current={isActive(l.href) ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <div className="max-[560px]:hidden">{action}</div>
            <button
              type="button"
              className="hidden max-[860px]:grid lp-round h-11 w-11 hover:bg-black/5"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <nav className={`lp-mobile-menu min-[861px]:hidden ${onLight ? 'on-light' : ''}`} aria-label="Mobile">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? 'page' : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {action && <div className="mt-2 min-[561px]:hidden" onClick={() => setOpen(false)}>{action}</div>}
        </nav>
      )}
    </>
  );
}
