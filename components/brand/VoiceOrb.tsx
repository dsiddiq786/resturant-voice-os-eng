'use client';

import React, { useEffect, useRef } from 'react';

export type OrbMode = 'idle' | 'connecting' | 'listening' | 'thinking' | 'waiting' | 'speaking' | 'ended';
export type OrbLayout = 'hero' | 'call';

interface Props {
  mode: OrbMode;
  layout: OrbLayout;
  inputLevelRef?: React.MutableRefObject<number>;
  outputLevelRef?: React.MutableRefObject<number>;
}

// Shape targets per voice state. morph: 0 = sphere, 1 = sound rings, 2 = neural graph.
const MODE: Record<OrbMode, { morph: number; amp: number; spin: number; opacity: number }> = {
  idle:       { morph: 0,   amp: 0,    spin: 0,   opacity: 1 },
  connecting: { morph: 0.5, amp: 0.25, spin: 0.8, opacity: 1 },
  listening:  { morph: 0,   amp: 0,    spin: 0,   opacity: 1 },
  thinking:   { morph: 1,   amp: 0.3,  spin: 0.2, opacity: 1 },
  waiting:    { morph: 2,   amp: 0.1,  spin: 1,   opacity: 1 },
  speaking:   { morph: 0,   amp: 0,    spin: 0,   opacity: 1 },
  ended:      { morph: 0,   amp: 0,    spin: 0,   opacity: 0.35 },
};

/**
 * Full-viewport WebGL particle orb (behind page content). Thousands of points morph between a
 * sphere, sound rings and a neural graph; the live call's real mic and speaker levels drive it.
 */
export default function VoiceOrb({ mode, layout, inputLevelRef, outputLevelRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  const layoutRef = useRef(layout);
  const kickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    modeRef.current = mode;
    layoutRef.current = layout;
    kickRef.current?.();
  }, [mode, layout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    import('three').then(THREE => {
      if (disposed) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isMobile = () => window.innerWidth <= 1000;

      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
      } catch {
        canvas.style.background = 'radial-gradient(circle at 70% 45%, rgba(59,99,255,.25), transparent 40%)';
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 9);
      const group = new THREE.Group();
      scene.add(group);

      const N = isMobile() ? 7000 : 16000;
      const aSphere = new Float32Array(N * 3);
      const aWave = new Float32Array(N * 3);
      const aGraph = new Float32Array(N * 3);
      const aRand = new Float32Array(N);
      let seed = 1337;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const gauss = () => {
        let u = 0, v = 0;
        while (!u) u = rnd();
        while (!v) v = rnd();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      };
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i, R = 1.75 + (rnd() - 0.5) * 0.08;
        aSphere.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
        aRand[i] = rnd();
      }
      for (let i = 0; i < N; i++) {
        const t = rnd() * Math.PI * 2, b = Math.floor(rnd() * 5);
        const w = Math.sin(t * 12 + b) * 0.16 + Math.sin(t * 31) * 0.06;
        const R = 1.55 + b * 0.11 + w * (1 - b * 0.15) + gauss() * 0.012;
        aWave.set([Math.cos(t) * R, Math.sin(t) * R, (b - 2) * 0.09 + gauss() * 0.03], i * 3);
      }
      const nodes: import('three').Vector3[] = [];
      for (let k = 0; k < 46; k++) {
        let p: import('three').Vector3;
        do { p = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); } while (p.length() > 1);
        nodes.push(p.multiplyScalar(1.85));
      }
      const edges: Array<[number, number]> = [];
      nodes.forEach((a, i) => {
        nodes.map((b, j) => [j, a.distanceTo(b)] as [number, number])
          .filter(([j]) => j !== i)
          .sort((x, y) => x[1] - y[1])
          .slice(0, 3)
          .forEach(([j]) => { if (i < j) edges.push([i, j]); });
      });
      for (let i = 0; i < N; i++) {
        let p: number[];
        if (rnd() < 0.42) {
          const n = nodes[Math.floor(rnd() * nodes.length)], s = 0.05 + rnd() * 0.05;
          p = [n.x + gauss() * s, n.y + gauss() * s, n.z + gauss() * s];
        } else {
          const [ai, bi] = edges[Math.floor(rnd() * edges.length)], a = nodes[ai], b = nodes[bi], t = rnd();
          p = [a.x + (b.x - a.x) * t + gauss() * 0.01, a.y + (b.y - a.y) * t + gauss() * 0.01, a.z + (b.z - a.z) * t + gauss() * 0.01];
        }
        aGraph.set(p, i * 3);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(aSphere.slice(), 3));
      geo.setAttribute('aSphere', new THREE.BufferAttribute(aSphere, 3));
      geo.setAttribute('aWave', new THREE.BufferAttribute(aWave, 3));
      geo.setAttribute('aGraph', new THREE.BufferAttribute(aGraph, 3));
      geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));

      const mouse = new THREE.Vector2(99, 99), mouseT = new THREE.Vector2(99, 99);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 }, uMorph: { value: 0 }, uAmp: { value: 0 }, uVoice: { value: 0 }, uListen: { value: 0 },
          uOpacity: { value: 0 }, uMouse: { value: mouse }, uSize: { value: isMobile() ? 34 : 30 }, uPixel: { value: renderer.getPixelRatio() },
          uBase: { value: new THREE.Color('#C9D5FF') }, uVolt: { value: new THREE.Color('#3B63FF') }, uIon: { value: new THREE.Color('#7FD8FF') },
        },
        vertexShader: `
          attribute vec3 aSphere; attribute vec3 aWave; attribute vec3 aGraph; attribute float aRand;
          uniform float uTime, uMorph, uAmp, uVoice, uListen, uSize, uPixel; uniform vec2 uMouse;
          varying float vAlpha; varying float vTone; varying float vDepth;
          void main(){
            float m1 = smoothstep(0.0, 1.0, clamp(uMorph, 0.0, 1.0));
            float m2 = smoothstep(0.0, 1.0, clamp(uMorph - 1.0, 0.0, 1.0));
            vec3 p = mix(mix(aSphere, aWave, m1), aGraph, m2);
            float n = sin(p.x * 2.1 + uTime * .8 + aRand * 6.283) * sin(p.y * 1.7 - uTime * .6) * sin(p.z * 2.3 + uTime * .5);
            vec3 dir = normalize(p + 1e-4);
            float speak = uVoice * (0.5 + 0.5 * sin(aRand * 50.0 + uTime * 13.0)) * (0.6 + 0.4 * n);
            float listen = uListen * (0.5 + 0.5 * sin(p.y * 6.0 + uTime * 7.0 + aRand * 3.0));
            p += dir * (n * 0.07 + uAmp * 0.12 * sin(uTime * 3.0 + aRand * 20.0) + speak * 0.32 + listen * 0.18);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vec2 d = mv.xy - uMouse; mv.xy += normalize(d + 1e-4) * 0.45 * smoothstep(1.1, 0.0, length(d));
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * uPixel * (0.55 + aRand * 0.9) / -mv.z;
            vTone = aRand; vDepth = clamp((p.z + 2.0) / 4.0, 0.0, 1.0);
            vAlpha = 0.35 + 0.45 * aRand + uVoice * 0.3 + uListen * 0.15;
          }`,
        fragmentShader: `
          uniform vec3 uBase; uniform vec3 uVolt; uniform vec3 uIon; uniform float uOpacity, uVoice;
          varying float vAlpha; varying float vTone; varying float vDepth;
          void main(){
            float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5));
            vec3 col = mix(uVolt, uBase, smoothstep(0.25, 0.85, vTone));
            col = mix(col, uIon, step(0.9, vTone) + uVoice * step(0.6, vTone) * 0.8);
            gl_FragColor = vec4(col, a * vAlpha * uOpacity * (0.35 + 0.65 * vDepth) * 0.62);
          }`,
      });
      group.add(new THREE.Points(geo, mat));

      // Where the orb sits for each page layout (scene units; camera sees about 6.5 units tall).
      const place = () => {
        const m = isMobile();
        if (layoutRef.current === 'call') return m ? { x: 0, y: 1.25, scale: 0.68 } : { x: -2.15, y: 0.05, scale: 0.95 };
        return m ? { x: 0, y: 1.7, scale: 0.72 } : { x: 2.4, y: 0, scale: 1 };
      };
      const S = { morph: 0, amp: 0, voice: 0, listen: 0, spin: 0, opacity: 0, x: 2.4, y: 0, scale: 0.5 };
      const sync = () => Object.assign(S, MODE[modeRef.current], place(), { voice: 0, listen: 0 });

      let vh = 1, vw = 1;
      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        vh = 2 * Math.tan(THREE.MathUtils.degToRad(20)) * 9;
        vw = vh * camera.aspect;
        if (reduce) render(0);
      };
      const onPointer = (e: PointerEvent) => mouseT.set((e.clientX / window.innerWidth - 0.5) * vw, -(e.clientY / window.innerHeight - 0.5) * vh);

      const t0 = performance.now();
      let rotY = 0;
      function render(dt: number) {
        const t = (performance.now() - t0) / 1000;
        const k = reduce ? 1 : 1 - Math.exp(-dt * 2.4);
        const target = { ...MODE[modeRef.current], ...place() };
        S.morph += (target.morph - S.morph) * k;
        S.amp += (target.amp - S.amp) * k;
        S.spin += (target.spin - S.spin) * k;
        S.opacity += (target.opacity - S.opacity) * k;
        S.x += (target.x - S.x) * k;
        S.y += (target.y - S.y) * k;
        S.scale += (target.scale - S.scale) * k;
        // Real audio: speaker level while the agent talks, microphone level while listening.
        const speaking = modeRef.current === 'speaking';
        const listening = modeRef.current === 'listening';
        const out = Math.min(1, (outputLevelRef?.current ?? 0) * 6);
        const inp = Math.min(1, (inputLevelRef?.current ?? 0) * 12);
        S.voice += ((speaking ? 0.35 + out * 0.9 : 0) - S.voice) * 0.25;
        S.listen += ((listening ? inp : 0) - S.listen) * 0.2;
        mouse.lerp(mouseT, 0.08);
        rotY += dt * (0.06 + S.spin * 0.5);
        group.rotation.y = rotY + mouse.x * 0.04;
        group.rotation.x = -mouse.y * 0.04 + Math.sin(t * 0.2) * 0.05;
        group.position.set(S.x, S.y, 0);
        group.scale.setScalar(S.scale);
        const u = mat.uniforms;
        u.uTime.value = t; u.uMorph.value = S.morph; u.uAmp.value = S.amp;
        u.uVoice.value = S.voice; u.uListen.value = S.listen; u.uOpacity.value = S.opacity;
        renderer.render(scene, camera);
      }

      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', onPointer, { passive: true });
      resize();

      let raf = 0;
      let last = performance.now();
      if (reduce) {
        sync();
        render(0);
        kickRef.current = () => { sync(); render(0); };
      } else {
        const loop = (now: number) => {
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          if (!document.hidden) render(dt);
          raf = requestAnimationFrame(loop);
        };
        render(0.016);
        raf = requestAnimationFrame(loop);
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointer);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        kickRef.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [inputLevelRef, outputLevelRef]);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-0 h-full w-full pointer-events-none" />;
}
