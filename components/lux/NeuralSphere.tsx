'use client';

import React, { useEffect, useRef } from 'react';

export type SphereMode = 'idle' | 'connecting' | 'listening' | 'thinking' | 'waiting' | 'speaking' | 'ended';

interface Props {
  mode: SphereMode;
  inputLevelRef?: React.MutableRefObject<number>;
  outputLevelRef?: React.MutableRefObject<number>;
  className?: string;
}

interface Particle {
  bx: number; by: number; bz: number;   // base position on the unit sphere
  rx: number; ry: number; rz: number;   // "ring" position used when the sphere reorganises
  seed: number;
  accent: boolean;
}

interface Params {
  amp: number;        // organic displacement
  breathe: number;    // breathing amplitude
  breatheRate: number;
  spin: number;       // rotation speed (rad/s)
  morph: number;      // 0 = organic sphere, 1 = latitude rings
  scan: number;       // processing scan band strength
  gold: number;       // share of gold tint
  bright: number;     // overall brightness
  link: number;       // connection visibility
}

const TARGETS: Record<SphereMode, Params> = {
  idle:       { amp: 0.03, breathe: 0.035, breatheRate: 0.7, spin: 0.10, morph: 0,    scan: 0, gold: 0.15, bright: 0.85, link: 0.55 },
  connecting: { amp: 0.05, breathe: 0.06,  breatheRate: 1.6, spin: 0.22, morph: 0.15, scan: 0, gold: 0.25, bright: 0.9,  link: 0.6 },
  listening:  { amp: 0.05, breathe: 0.02,  breatheRate: 0.9, spin: 0.12, morph: 0,    scan: 0, gold: 0.1,  bright: 1,    link: 0.7 },
  thinking:   { amp: 0.02, breathe: 0.015, breatheRate: 1.2, spin: 0.38, morph: 0.85, scan: 0, gold: 0.35, bright: 1,    link: 0.95 },
  waiting:    { amp: 0.02, breathe: 0.01,  breatheRate: 1.0, spin: 0.55, morph: 0.55, scan: 1, gold: 0.55, bright: 1,    link: 0.8 },
  speaking:   { amp: 0.06, breathe: 0.02,  breatheRate: 1.0, spin: 0.16, morph: 0,    scan: 0, gold: 0.6,  bright: 1,    link: 0.75 },
  ended:      { amp: 0.015, breathe: 0.02, breatheRate: 0.5, spin: 0.05, morph: 0,    scan: 0, gold: 0.1,  bright: 0.45, link: 0.35 },
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const RING_BANDS = 4; // bands either side of the equator

function buildParticles(count: number): { particles: Particle[]; edges: Uint16Array } {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = GOLDEN * i;
    const ry = Math.round(y * RING_BANDS) / RING_BANDS;
    const rr = Math.sqrt(Math.max(0, 1 - ry * ry));
    particles.push({
      bx: Math.cos(theta) * r, by: y, bz: Math.sin(theta) * r,
      rx: Math.cos(theta) * rr, ry, rz: Math.sin(theta) * rr,
      seed: Math.random() * 1000,
      accent: Math.random() < 0.12,
    });
  }
  // Three nearest neighbours per particle, computed once.
  const pairs = new Set<number>();
  for (let i = 0; i < count; i++) {
    const a = particles[i];
    const best: Array<[number, number]> = [];
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const b = particles[j];
      const d = (a.bx - b.bx) ** 2 + (a.by - b.by) ** 2 + (a.bz - b.bz) ** 2;
      if (best.length < 3) {
        best.push([d, j]);
        best.sort((p, q) => p[0] - q[0]);
      } else if (d < best[2][0]) {
        best[2] = [d, j];
        best.sort((p, q) => p[0] - q[0]);
      }
    }
    for (const [, j] of best) pairs.add(i < j ? i * 65536 + j : j * 65536 + i);
  }
  const edges = new Uint16Array(pairs.size * 2);
  let k = 0;
  pairs.forEach(key => {
    edges[k++] = Math.floor(key / 65536);
    edges[k++] = key % 65536;
  });
  return { particles, edges };
}

export default function NeuralSphere({ mode, inputLevelRef, outputLevelRef, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef<SphereMode>(mode);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    modeRef.current = mode;
    redrawRef.current?.();
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = window.innerWidth < 640;
    const { particles, edges } = buildParticles(compact ? 220 : 480);
    const n = particles.length;
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    const sd = new Float32Array(n); // depth 0 (back) .. 1 (front)

    const params: Params = { ...TARGETS[modeRef.current] };
    let width = 0;
    let height = 0;
    let dpr = 1;
    let yaw = 0;
    let tiltX = 0;
    let tiltY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let inLevel = 0;
    let outLevel = 0;
    let last = performance.now();
    let elapsed = 0;
    let raf: number | null = null;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2);
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
    };

    const draw = (dt: number) => {
      const target = TARGETS[modeRef.current];
      const ease = reduceMotion ? 1 : 1 - Math.exp(-dt * 3.2);
      (Object.keys(params) as Array<keyof Params>).forEach(k => {
        params[k] += (target[k] - params[k]) * ease;
      });

      const rawIn = inputLevelRef?.current ?? 0;
      const rawOut = outputLevelRef?.current ?? 0;
      inLevel += (Math.min(1, rawIn * 10) - inLevel) * (1 - Math.exp(-dt * 12));
      outLevel += (Math.min(1, rawOut * 5) - outLevel) * (1 - Math.exp(-dt * 14));
      const m = modeRef.current;
      const listenDrive = m === 'listening' ? inLevel : 0;
      const speakDrive = m === 'speaking' ? outLevel : 0;

      if (!reduceMotion) {
        elapsed += dt;
        yaw += dt * params.spin;
        tiltX += (pointerY * 0.35 - tiltX) * (1 - Math.exp(-dt * 2.5));
        tiltY += (pointerX * 0.45 - tiltY) * (1 - Math.exp(-dt * 2.5));
      }
      const t = elapsed;

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.34;
      const breathe = 1 + Math.sin(t * params.breatheRate * Math.PI) * params.breathe;
      const scale = radius * breathe * (1 + speakDrive * 0.12);

      // Soft core, so the sphere reads as a volume rather than a flat disc.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.25);
      glow.addColorStop(0, `rgba(214, 184, 128, ${0.07 * params.bright + speakDrive * 0.05})`);
      glow.addColorStop(1, 'rgba(214, 184, 128, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const cosY = Math.cos(yaw + tiltY);
      const sinY = Math.sin(yaw + tiltY);
      const pitch = 0.32 + tiltX;
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);
      const camera = 3.4;
      const scanY = Math.sin(t * 1.6) * 0.9;

      for (let i = 0; i < n; i++) {
        const p = particles[i];
        let x = p.bx + (p.rx - p.bx) * params.morph;
        let y = p.by + (p.ry - p.by) * params.morph;
        let z = p.bz + (p.rz - p.bz) * params.morph;

        const noise = Math.sin(p.seed + t * 0.9) * Math.cos(p.seed * 0.7 + t * 0.6);
        const ripple = listenDrive * 0.32 * Math.sin(p.by * 7 + t * 6 + p.seed * 0.01);
        const pulse = speakDrive * 0.22 * (0.5 + 0.5 * Math.sin(p.seed + t * 9));
        const scanBoost = params.scan * Math.max(0, 1 - Math.abs(y - scanY) * 5) * 0.12;
        const disp = 1 + noise * params.amp + ripple + pulse + scanBoost;
        x *= disp; y *= disp; z *= disp;

        // Rotate around Y, then tilt around X.
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const persp = camera / (camera - z2);
        sx[i] = cx + x1 * scale * persp;
        sy[i] = cy + y1 * scale * persp;
        sd[i] = (z2 + 1.2) / 2.4;
      }

      // Connections in three depth buckets: back to front.
      const linkAlpha = 0.16 * params.link * params.bright;
      for (let bucket = 0; bucket < 3; bucket++) {
        ctx.beginPath();
        for (let e = 0; e < edges.length; e += 2) {
          const a = edges[e];
          const b = edges[e + 1];
          const depth = (sd[a] + sd[b]) / 2;
          const bin = depth < 0.4 ? 0 : depth < 0.65 ? 1 : 2;
          if (bin !== bucket) continue;
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[b], sy[b]);
        }
        ctx.strokeStyle = `rgba(232, 220, 196, ${linkAlpha * (0.35 + bucket * 0.45)})`;
        ctx.lineWidth = dpr * (bucket === 2 ? 0.8 : 0.6);
        ctx.stroke();
      }

      for (let i = 0; i < n; i++) {
        const depth = Math.max(0, Math.min(1, sd[i]));
        const p = particles[i];
        const isGold = p.accent || (params.gold > 0.3 && (p.seed % 1) < params.gold * 0.35);
        const alpha = (0.18 + depth * 0.82) * params.bright;
        const size = dpr * (0.55 + depth * 1.6 + (isGold ? 0.35 : 0) + speakDrive * depth * 0.8);
        ctx.fillStyle = isGold
          ? `rgba(214, 180, 116, ${Math.min(1, alpha + 0.1)})`
          : `rgba(242, 235, 221, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx[i], sy[i], size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = visible ? requestAnimationFrame(loop) : null;
    };

    const startLoop = () => {
      if (reduceMotion || raf !== null) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };

    resize();
    redrawRef.current = reduceMotion ? () => draw(1) : null;
    // Paint one frame immediately, so a hidden or throttled tab never shows an empty canvas.
    draw(reduceMotion ? 1 : 0.016);
    if (!reduceMotion) startLoop();

    const ro = new ResizeObserver(() => {
      resize();
      // Resizing clears the canvas; repaint now rather than waiting for the next animation frame.
      draw(reduceMotion ? 1 : 0.016);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !document.hidden) startLoop();
      else stopLoop();
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else if (visible) startLoop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
      pointerY = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      stopLoop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      redrawRef.current = null;
    };
  }, [inputLevelRef, outputLevelRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
