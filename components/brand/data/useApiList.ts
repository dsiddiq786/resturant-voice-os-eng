'use client';

import { useCallback, useEffect, useState } from 'react';

async function fetchList<T>(url: string, key: string): Promise<{ items: T[]; error: string | null }> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
    return { items: Array.isArray(data[key]) ? data[key] : [], error: null };
  } catch (e: any) {
    return { items: [], error: e?.message || 'Could not load data' };
  }
}

// Small fetch hook for the back-office lists. Returns real API data or an error; never placeholder rows.
export function useApiList<T>(url: string, key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchList<T>(url, key).then(result => {
      if (cancelled) return;
      if (!result.error) setItems(result.items);
      setError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [url, key]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchList<T>(url, key);
    if (!result.error) setItems(result.items);
    setError(result.error);
    setLoading(false);
  }, [url, key]);

  return { items, loading, error, refresh };
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function time12(hhmm?: string) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function dateLong(iso?: string) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}
