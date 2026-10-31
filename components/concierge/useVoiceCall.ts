'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CallState = 'idle' | 'connecting' | 'active' | 'ended';
// Every phase is derived from a real event: mic energy, server tool events, or agent audio playback.
export type CallPhase = 'listening' | 'thinking' | 'waiting' | 'speaking';

export interface ConfirmedBooking {
  confirmation_code: string;
  customer_name: string;
  party_size: number;
  date: string;
  time: string;
}

export interface TranscriptEntry {
  id: number;
  role: 'caller' | 'agent';
  text: string;
}

export interface ActivityEntry {
  id: string;
  tool: string;
  phase: 'started' | 'slow' | 'completed';
  status?: string;
  detail?: Record<string, any> | null;
  startedAt: number;
  completedAt?: number;
}

interface Options {
  venue: string;
  voice: string;
}

// Wire protocol: binary 16 kHz PCM16 frames up and 24 kHz PCM16 frames down (?bin=1); events stay JSON.
function floatToPcm16(input: Float32Array) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// Microphone capture off the main thread, so page rendering can never delay or drop caller audio.
const MIC_WORKLET = `
class MicCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.size = options.processorOptions.size;
    this.buf = new Float32Array(this.size);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.size) {
        const pcm = new Int16Array(this.size);
        let sum = 0;
        for (let j = 0; j < this.size; j++) {
          const s = Math.max(-1, Math.min(1, this.buf[j]));
          sum += s * s;
          pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage({ pcm: pcm.buffer, rms: Math.sqrt(sum / this.size) }, [pcm.buffer]);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
`;

const SPEECH_RMS = 0.015;
const SPEECH_FRAMES_TO_START = 2;
const SILENCE_FRAMES_TO_END = 5;
// 1024 samples at 16 kHz = 64 ms per chunk: half the input buffering delay of the old 2048-sample frames.
const MIC_CHUNK = 1024;
const THINKING_TIMEOUT_MS = 10000;
// Upload backpressure: if more than ~1.5 s of audio is still waiting to leave the browser, drop new
// frames instead of queueing them. Queued audio only arrives late and makes the call lag further behind.
const UPLINK_MAX_BUFFERED = 48_000;
// Small playout delay after a gap, so one late network packet doesn't cut a word in half.
const PLAYBACK_LEAD_S = 0.06;
const STATS_EVERY_MS = 5000;
// Longest wait for the agent's goodbye to finish playing before an agent-ended call hangs up.
const HANGUP_MAX_WAIT_MS = 12000;

export function useVoiceCall({ venue, voice }: Options) {
  const [state, setState] = useState<CallState>('idle');
  const [phase, setPhase] = useState<CallPhase>('listening');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  // Audio levels for the visualisation. Refs, not state, so the canvas can read them every frame.
  const inputLevelRef = useRef(0);
  const outputLevelRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const outputBusRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<AudioNode | null>(null);
  // Audio health, reported to the server every few seconds and stored with the call.
  const statsRef = useRef({ sent: 0, dropped: 0, underruns: 0, maxUplinkBytes: 0, maxLoopLagMs: 0, playbackLagMs: 0, worklet: false, binary: true });
  const lastAudioEndRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayRef = useRef(0);
  const mutedRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const endingRef = useRef(false);

  const speechFramesRef = useRef(0);
  const silenceFramesRef = useRef(0);
  const callerSpeakingRef = useRef(false);
  const awaitingReplySinceRef = useRef(0);
  const pendingToolsRef = useRef(new Set<string>());
  const openTurnRef = useRef<{ role: 'caller' | 'agent'; id: number } | null>(null);
  const transcriptIdRef = useRef(0);
  const phaseRef = useRef<CallPhase>('listening');

  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lagTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopLoops = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = null;
    if (lagTimerRef.current) clearInterval(lagTimerRef.current);
    lagTimerRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const releaseAudio = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { /* already ended */ } });
    sourcesRef.current = [];
    inputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;
    outputCtxRef.current = null;
    outputBusRef.current = null;
    analyserRef.current = null;
    inputLevelRef.current = 0;
    outputLevelRef.current = 0;
    callerSpeakingRef.current = false;
    awaitingReplySinceRef.current = 0;
    pendingToolsRef.current.clear();
  }, []);

  const finish = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    stopLoops();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
    releaseAudio();
    openTurnRef.current = null;
    if (startedAtRef.current) setSeconds(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
    setState('ended');
  }, [releaseAudio]);

  const playPcm = (pcm: Int16Array) => {
    const ctx = outputCtxRef.current;
    const bus = outputBusRef.current;
    if (!ctx || !bus || pcm.length === 0) return;
    const buffer = ctx.createBuffer(1, pcm.length, 24000);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(bus);
    if (nextPlayRef.current < ctx.currentTime) {
      // Playback ran dry. Mid-sentence (audio ended under a second ago) that is an audible gap.
      if (lastAudioEndRef.current && ctx.currentTime - lastAudioEndRef.current < 1) statsRef.current.underruns += 1;
      nextPlayRef.current = ctx.currentTime + PLAYBACK_LEAD_S;
    }
    source.start(nextPlayRef.current);
    nextPlayRef.current += buffer.duration;
    lastAudioEndRef.current = nextPlayRef.current;
    statsRef.current.playbackLagMs = Math.round((nextPlayRef.current - ctx.currentTime) * 1000);
    sourcesRef.current.push(source);
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter(s => s !== source);
    };
  };

  const playBase64 = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    playPcm(new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1));
  };

  const addTranscript = (role: 'caller' | 'agent', text: string) => {
    const open = openTurnRef.current;
    if (open && open.role === role) {
      setTranscript(prev => prev.map(e => (e.id === open.id ? { ...e, text: e.text + text } : e)));
      return;
    }
    const id = ++transcriptIdRef.current;
    openTurnRef.current = { role, id };
    setTranscript(prev => [...prev, { id, role, text }]);
  };

  const computePhase = (): CallPhase => {
    const now = Date.now();
    if (pendingToolsRef.current.size > 0) return 'waiting';
    if (sourcesRef.current.length > 0) return 'speaking';
    if (awaitingReplySinceRef.current && now - awaitingReplySinceRef.current < THINKING_TIMEOUT_MS) return 'thinking';
    return 'listening';
  };

  const start = useCallback(async () => {
    if (state === 'connecting' || state === 'active') return;
    setError(null);
    setNotice(null);
    setBooking(null);
    setTranscript([]);
    setActivity([]);
    setSeconds(0);
    setMuted(false);
    setPhase('listening');
    phaseRef.current = 'listening';
    mutedRef.current = false;
    endingRef.current = false;
    nextPlayRef.current = 0;
    lastAudioEndRef.current = 0;
    statsRef.current = { sent: 0, dropped: 0, underruns: 0, maxUplinkBytes: 0, maxLoopLagMs: 0, playbackLagMs: 0, worklet: false, binary: true };
    openTurnRef.current = null;
    pendingToolsRef.current.clear();
    setState('connecting');

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('This browser cannot access the microphone. Use Chrome or Safari over localhost or HTTPS.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const outputCtx = new AudioContext({ sampleRate: 24000 });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      outputCtxRef.current = outputCtx;
      inputCtxRef.current = inputCtx;

      // Agent audio: sources -> bus -> analyser -> speakers. The analyser drives the "speaking" visual.
      const bus = outputCtx.createGain();
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 512;
      bus.connect(analyser);
      analyser.connect(outputCtx.destination);
      outputBusRef.current = bus;
      analyserRef.current = analyser;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/live?bin=1&venue=${encodeURIComponent(venue)}&voice=${encodeURIComponent(voice)}`
      );
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      // One captured mic frame: voice-activity tracking for the visuals, then upload.
      const onMicFrame = (pcm: Int16Array, rms: number) => {
        const level = mutedRef.current ? 0 : rms;
        inputLevelRef.current = level;

        // Voice activity: speech then a short silence means the caller finished a sentence.
        if (level > SPEECH_RMS) {
          silenceFramesRef.current = 0;
          speechFramesRef.current += 1;
          if (speechFramesRef.current >= SPEECH_FRAMES_TO_START) {
            callerSpeakingRef.current = true;
            awaitingReplySinceRef.current = 0;
          }
        } else if (callerSpeakingRef.current) {
          silenceFramesRef.current += 1;
          if (silenceFramesRef.current >= SILENCE_FRAMES_TO_END) {
            callerSpeakingRef.current = false;
            speechFramesRef.current = 0;
            silenceFramesRef.current = 0;
            awaitingReplySinceRef.current = Date.now();
          }
        } else {
          speechFramesRef.current = 0;
        }

        if (ws.readyState !== WebSocket.OPEN || mutedRef.current) return;
        const st = statsRef.current;
        if (ws.bufferedAmount > st.maxUplinkBytes) st.maxUplinkBytes = ws.bufferedAmount;
        if (ws.bufferedAmount > UPLINK_MAX_BUFFERED) { st.dropped += 1; return; }
        ws.send(pcm.buffer);
        st.sent += 1;
      };

      const source = inputCtx.createMediaStreamSource(stream);
      let capture: AudioNode;
      try {
        const url = URL.createObjectURL(new Blob([MIC_WORKLET], { type: 'text/javascript' }));
        await inputCtx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        const node = new AudioWorkletNode(inputCtx, 'mic-capture', { processorOptions: { size: MIC_CHUNK } });
        node.port.onmessage = (e) => onMicFrame(new Int16Array(e.data.pcm), e.data.rms);
        capture = node;
        statsRef.current.worklet = true;
      } catch {
        // Older browsers: capture on the main thread.
        const processor = inputCtx.createScriptProcessor(MIC_CHUNK, 1, 1);
        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
          onMicFrame(floatToPcm16(input), Math.sqrt(sum / input.length));
        };
        capture = processor;
      }
      processorRef.current = capture;
      source.connect(capture);
      capture.connect(inputCtx.destination);

      const levelBuffer = new Uint8Array(analyser.fftSize);
      const sampleOutput = () => {
        const a = analyserRef.current;
        if (a) {
          a.getByteTimeDomainData(levelBuffer);
          let sum = 0;
          for (let i = 0; i < levelBuffer.length; i++) {
            const v = (levelBuffer[i] - 128) / 128;
            sum += v * v;
          }
          outputLevelRef.current = Math.sqrt(sum / levelBuffer.length);
          rafRef.current = requestAnimationFrame(sampleOutput);
        }
      };
      rafRef.current = requestAnimationFrame(sampleOutput);

      ws.onopen = () => {
        startedAtRef.current = Date.now();
        setState('active');
        tickRef.current = setInterval(() => {
          setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
          const next = computePhase();
          if (next !== phaseRef.current) {
            phaseRef.current = next;
            setPhase(next);
          }
        }, 120);
        // Main-thread stalls are what make browser audio stutter; measure the worst one.
        let expected = Date.now() + 250;
        lagTimerRef.current = setInterval(() => {
          const lag = Date.now() - expected;
          if (lag > statsRef.current.maxLoopLagMs) statsRef.current.maxLoopLagMs = lag;
          expected = Date.now() + 250;
        }, 250);
        statsTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ stats: { ...statsRef.current, seconds: Math.round((Date.now() - startedAtRef.current) / 1000) } }));
          }
        }, STATS_EVERY_MS);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          awaitingReplySinceRef.current = 0;
          playPcm(new Int16Array(event.data, 0, event.data.byteLength >> 1));
          return;
        }
        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.audio) {
          awaitingReplySinceRef.current = 0;
          playBase64(msg.audio);
        }
        if (msg.transcript?.text) {
          addTranscript(msg.transcript.role === 'agent' ? 'agent' : 'caller', String(msg.transcript.text));
        }
        if (msg.turnComplete) {
          openTurnRef.current = null;
        }
        if (msg.interrupted) {
          sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { /* already ended */ } });
          sourcesRef.current = [];
          if (outputCtxRef.current) nextPlayRef.current = outputCtxRef.current.currentTime;
          lastAudioEndRef.current = 0;
          if (openTurnRef.current?.role === 'agent') openTurnRef.current = null;
        }
        if (msg.activity?.id) {
          const a = msg.activity;
          if (a.phase === 'started') {
            pendingToolsRef.current.add(a.id);
            awaitingReplySinceRef.current = 0;
            setActivity(prev => [...prev, { id: a.id, tool: a.tool, phase: 'started', startedAt: Date.now() }]);
          } else if (a.phase === 'slow') {
            // The booking system is slow; the agent has been told to keep the caller informed.
            setActivity(prev => prev.map(e => (e.id === a.id ? { ...e, phase: 'slow' } : e)));
          } else {
            pendingToolsRef.current.delete(a.id);
            setActivity(prev => prev.map(e =>
              e.id === a.id ? { ...e, phase: 'completed', status: a.status, detail: a.detail, completedAt: Date.now() } : e
            ));
          }
        }
        if (msg.error) {
          setError(String(msg.error));
          finish();
          return;
        }
        if (msg.toolResult) {
          const result = msg.toolResult.result;
          const name = msg.toolResult.name;
          if (name === 'submit_reservation_data' && result?.status === 'confirmed') {
            setBooking(result.reservation);
            setNotice(null);
          }
          if (name === 'modify_reservation' && result?.status === 'modified') {
            setBooking(result.reservation);
            setNotice('Booking updated');
          }
          if (name === 'cancel_reservation' && result?.status === 'cancelled') {
            setBooking(null);
            setNotice('Booking cancelled');
          }
          if (name === 'request_staff_callback' && result?.status === 'callback_requested') {
            setNotice('Callback request recorded for the team');
          }
        }
        if (msg.status === 'disconnected') finish();
        if (msg.hangup) {
          // The agent ended the call: let its goodbye finish playing, then hang up.
          const startedWaiting = Date.now();
          const waitForGoodbye = setInterval(() => {
            const ctx = outputCtxRef.current;
            const playing = ctx ? nextPlayRef.current - ctx.currentTime > 0.05 : false;
            if (endingRef.current || !playing || Date.now() - startedWaiting > HANGUP_MAX_WAIT_MS) {
              clearInterval(waitForGoodbye);
              if (!endingRef.current) finish();
            }
          }, 200);
        }
      };

      ws.onerror = () => {
        setError('The connection to the concierge was interrupted.');
      };

      ws.onclose = () => {
        if (!endingRef.current) finish();
      };
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setError(denied ? 'Microphone access was blocked. Allow it in your browser settings and try again.' : (err?.message || 'Could not start the call.'));
      endingRef.current = true;
      stopLoops();
      releaseAudio();
      wsRef.current?.close();
      wsRef.current = null;
      setState('idle');
    }
  }, [state, venue, voice, finish, releaseAudio]);

  const end = useCallback(() => {
    finish();
  }, [finish]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
  }, []);

  useEffect(() => () => {
    endingRef.current = true;
    stopLoops();
    wsRef.current?.close();
    wsRef.current = null;
    releaseAudio();
  }, [releaseAudio]);

  return {
    state, phase, error, muted, seconds, booking, notice, transcript, activity,
    inputLevelRef, outputLevelRef,
    start, end, toggleMute,
  };
}
