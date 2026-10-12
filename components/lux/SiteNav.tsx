'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowUpRight } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'AI Concierge' },
  { href: '/operations', label: 'Operations' },
  { href: '/owner', label: 'Owner Portal' },
];

export function LuxLogo() {
  return (
    <Link href="/" className="lux-logo" aria-label="Leed Pizza, AI Concierge home">
      <span className="lux-logo-mark" aria-hidden="true">L</span>
      <span className="block">
        <span className="lux-logo-word block">Leed Pizza</span>
        <span className="lux-logo-sub block">AI Concierge</span>
      </span>
    </Link>
  );
}

export default function SiteNav({ solid = false }: { solid?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <>
      <header className="lux-nav" data-scrolled={scrolled} data-solid={solid || open}>
        <LuxLogo />
        <nav aria-label="Primary" className="hidden md:flex items-center gap-9">
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="lux-navlink"
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="md:hidden lux-icon-btn w-10 h-10 hover:bg-white/5"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      {open && (
        <nav className="lux-mobile-sheet md:hidden" aria-label="Mobile">
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <span className={isActive(link.href) ? 'text-[var(--lux-champagne)]' : ''}>{link.label}</span>
              <ArrowUpRight size={18} className="text-[var(--lux-ivory-3)]" />
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
