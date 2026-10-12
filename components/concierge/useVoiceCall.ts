'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CallState = 'idle' | 'connecting' | 'active' | 'ended';
export type Speaker = 'none' | 'caller' | 'agent';

export interface ConfirmedBooking {
  confirmation_code: string;
  customer_name: string;
  party_size: number;
  date: string;
  time: string;
}

interface Options {
  venue: string;
  voice: string;
}

// Same wire protocol as the back-office client: 16 kHz PCM16 up, 24 kHz PCM16 down, base64 in JSON.
function floatToPcm16Base64(input: Float32Array) {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const SPEECH_RMS = 0.015;
const AGENT_HOLD_MS = 450;

export function useVoiceCall({ venue, voice }: Options) {
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [speaker, setSpeaker] = useState<Speaker>('none');
  const [level, setLevel] = useState(0);
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayRef = useRef(0);
  const mutedRef = useRef(false);
  const callerLevelRef = useRef(0);
  const agentUntilRef = useRef(0);
  const callerSpeakingRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const endingRef = useRef(false);

  const stopTimers = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
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
    callerLevelRef.current = 0;
    callerSpeakingRef.current = false;
    agentUntilRef.current = 0;
  }, []);

  const finish = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    stopTimers();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
    releaseAudio();
    if (startedAtRef.current) setSeconds(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
    setSpeaker('none');
    setLevel(0);
    setState('ended');
  }, [releaseAudio]);

  const playChunk = (ctx: AudioContext, base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, pcm.length, 24000);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    if (nextPlayRef.current < ctx.currentTime) nextPlayRef.current = ctx.currentTime;
    source.start(nextPlayRef.current);
    nextPlayRef.current += buffer.duration;
    sourcesRef.current.push(source);
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter(s => s !== source);
    };
    agentUntilRef.current = Date.now() + AGENT_HOLD_MS;
  };

  const start = useCallback(async () => {
    if (state === 'connecting' || state === 'active') return;
    setError(null);
    setNotice(null);
    setBooking(null);
    setSeconds(0);
    setMuted(false);
    mutedRef.current = false;
    endingRef.current = false;
    nextPlayRef.current = 0;
    setState('connecting');

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('This browser cannot access the microphone. Try Safari or Chrome on a secure connection.');
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

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/live?venue=${encodeURIComponent(venue)}&voice=${encodeURIComponent(voice)}`
      );
      wsRef.current = ws;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        callerLevelRef.current = Math.sqrt(sum / input.length);
        if (ws.readyState === WebSocket.OPEN && !mutedRef.current) {
          ws.send(JSON.stringify({ audio: floatToPcm16Base64(input) }));
        }
      };
      source.connect(processor);
      processor.connect(inputCtx.destination);

      ws.onopen = () => {
        startedAtRef.current = Date.now();
        setState('active');
        tickRef.current = setInterval(() => {
          const now = Date.now();
          setSeconds(Math.floor((now - startedAtRef.current) / 1000));
          const rms = callerLevelRef.current;
          const callerTalking = rms > SPEECH_RMS;
          callerSpeakingRef.current = callerTalking;
          const agentTalking = sourcesRef.current.length > 0 || now < agentUntilRef.current;
          setSpeaker(agentTalking ? 'agent' : callerTalking ? 'caller' : 'none');
          setLevel(agentTalking ? 0.55 + Math.random() * 0.2 : Math.min(1, rms * 9));
        }, 120);
      };

      ws.onmessage = (event) => {
        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.audio && outputCtxRef.current) playChunk(outputCtxRef.current, msg.audio);
        if (msg.interrupted) {
          sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { /* already ended */ } });
          sourcesRef.current = [];
          if (outputCtxRef.current) nextPlayRef.current = outputCtxRef.current.currentTime;
        }
        if (msg.error) {
          setError(String(msg.error));
          finish();
          return;
        }
        if (msg.toolResult) {
          const result = msg.toolResult.result;
          if (msg.toolResult.name === 'submit_reservation_data' && result?.status === 'confirmed') {
            setBooking(result.reservation);
            setNotice(null);
          }
          if (msg.toolResult.name === 'modify_reservation' && result?.status === 'modified') {
            setBooking(result.reservation);
            setNotice('Booking updated');
          }
          if (msg.toolResult.name === 'cancel_reservation' && result?.status === 'cancelled') {
            setBooking(null);
            setNotice('Booking cancelled');
          }
          if (msg.toolResult.name === 'request_staff_callback' && result?.status === 'callback_requested') {
            setNotice('Callback request recorded for the team');
          }
        }
        if (msg.status === 'disconnected') finish();
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
    stopTimers();
    wsRef.current?.close();
    wsRef.current = null;
    releaseAudio();
  }, [releaseAudio]);

  return { state, error, muted, seconds, speaker, level, booking, notice, start, end, toggleMute };
}
