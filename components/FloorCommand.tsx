'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Clock, CheckCircle, AlertCircle, Utensils, 
  CreditCard, Trash2, ChevronRight, Phone, PhoneOff, 
  Coffee, Lock, Menu, X, Activity, Mic, MicOff, Volume2, Sparkles, Radio, Database,
  Gauge, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKDS } from '@/lib/kdsContext';
import { MENU_MATRIX } from '@/lib/menuMatrix';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import VoiceRecordingsModal from '@/components/VoiceRecordingsModal';

export interface TtfaRecord {
  turn: number;
  seconds: number;
  formatted: string;
  ms: number;
  timestamp: number;
  type: 'greeting' | 'user_turn' | 'simulation';
}

type DiningStage = 'AVAILABLE' | 'LOCKED' | 'SEATED' | 'APPS_FIRED' | 'MAINS_CLEARED' | 'CHECK_DROPPED' | 'BUSSING_NEEDED';

interface Table {
  id: string;
  label: string;
  capacity: number;
  stage: DiningStage;
  occupantName?: string;
  timeElapsed?: number; // in seconds
  mergedWith?: string[];
  adjacentTo?: string[];
  type: 'TABLE' | 'BOOTH' | 'BAR';
  x: number;
  y: number;
  w: number;
  h: number;
}

interface IncomingRequest {
  id: string;
  name: string;
  partySize: number;
  time: string;
  phone?: string;
  venue?: string;
  tags: string[];
  status: 'PENDING' | 'LOCKED' | 'EXPIRED' | 'SEATED';
  lockedTableIds?: string[];
  lockExpiresAt?: number;
  source?: 'VOICE_CALL' | 'SIMULATED';
}

interface AvailabilityCheck {
  id: string;
  partySize: number;
  targetTime: string;
  venue: string;
  status: 'available' | 'unavailable';
  alternatives?: string[];
  timestamp: number;
}

const INITIAL_TABLES: Table[] = [
  // Booths along left
  { id: 'B1', label: 'B1', capacity: 6, stage: 'AVAILABLE', type: 'BOOTH', x: 5, y: 10, w: 15, h: 20, adjacentTo: [] },
  { id: 'B2', label: 'B2', capacity: 6, stage: 'SEATED', occupantName: 'Sarah Jenkins', timeElapsed: 1200, type: 'BOOTH', x: 5, y: 35, w: 15, h: 20, adjacentTo: [] },
  { id: 'B3', label: 'B3', capacity: 6, stage: 'AVAILABLE', type: 'BOOTH', x: 5, y: 60, w: 15, h: 20, adjacentTo: [] },
  
  // Center Tables (T1 and T2 are adjacent 2-tops, mergeable into a 4-top)
  { id: 'T1', label: 'T1', capacity: 2, stage: 'AVAILABLE', type: 'TABLE', x: 28, y: 15, w: 10, h: 12, adjacentTo: ['T2'] },
  { id: 'T2', label: 'T2', capacity: 2, stage: 'AVAILABLE', type: 'TABLE', x: 42, y: 15, w: 10, h: 12, adjacentTo: ['T1'] },
  
  // T3 and T4 are adjacent 4-tops, mergeable into an 8-top
  { id: 'T3', label: 'T3', capacity: 4, stage: 'APPS_FIRED', occupantName: 'Johnson', timeElapsed: 2400, type: 'TABLE', x: 28, y: 35, w: 12, h: 14, adjacentTo: ['T4'] },
  { id: 'T4', label: 'T4', capacity: 4, stage: 'AVAILABLE', type: 'TABLE', x: 44, y: 35, w: 12, h: 14, adjacentTo: ['T3'] },
  
  // T5 and T6 are adjacent 4-tops
  { id: 'T5', label: 'T5', capacity: 4, stage: 'CHECK_DROPPED', occupantName: 'Lee', timeElapsed: 4500, type: 'TABLE', x: 28, y: 60, w: 12, h: 14, adjacentTo: ['T6'] },
  { id: 'T6', label: 'T6', capacity: 4, stage: 'BUSSING_NEEDED', type: 'TABLE', x: 44, y: 60, w: 12, h: 14, adjacentTo: ['T5'] },

  // Bar on right
  { id: 'Bar1', label: 'Bar 1', capacity: 1, stage: 'SEATED', occupantName: 'Guest', timeElapsed: 400, type: 'BAR', x: 75, y: 10, w: 8, h: 10, adjacentTo: [] },
  { id: 'Bar2', label: 'Bar 2', capacity: 1, stage: 'AVAILABLE', type: 'BAR', x: 75, y: 22, w: 8, h: 10, adjacentTo: [] },
  { id: 'Bar3', label: 'Bar 3', capacity: 1, stage: 'AVAILABLE', type: 'BAR', x: 75, y: 34, w: 8, h: 10, adjacentTo: [] },
  { id: 'Bar4', label: 'Bar 4', capacity: 1, stage: 'AVAILABLE', type: 'BAR', x: 75, y: 46, w: 8, h: 10, adjacentTo: [] },
  { id: 'Bar5', label: 'Bar 5', capacity: 1, stage: 'AVAILABLE', type: 'BAR', x: 75, y: 58, w: 8, h: 10, adjacentTo: [] },
];

const STAGES = ['AVAILABLE', 'LOCKED', 'SEATED', 'APPS_FIRED', 'MAINS_CLEARED', 'CHECK_DROPPED', 'BUSSING_NEEDED'];

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
};

export default function FloorCommand() {
  const { createInboundOrder } = useKDS();
  const { ownerConfig, floorTables, menuItems, selectedVoice } = useOwnerConfig();

  // Initialize tables with floorTables from owner config if available
  const [tables, setTables] = useState<Table[]>(() => {
    if (floorTables && floorTables.length > 0) {
      return floorTables.map(ft => ({
        id: ft.id,
        label: ft.label,
        capacity: ft.capacity,
        stage: ft.stage || 'AVAILABLE',
        occupantName: undefined,
        timeElapsed: 0,
        mergedWith: [],
        adjacentTo: ft.adjacentTo || [],
        type: ft.type,
        x: ft.x,
        y: ft.y,
        w: ft.w,
        h: ft.h,
      }));
    }
    return INITIAL_TABLES;
  });

  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [waitlist, setWaitlist] = useState<IncomingRequest[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [lastHandoff, setLastHandoff] = useState<IncomingRequest | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'turnover' | 'waitlist'>('turnover');

  // Voice Call State (Phase 1 Real Integration)
  const [callState, setCallState] = useState<'Disconnected' | 'Connecting' | 'Live'>('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [recentChecks, setRecentChecks] = useState<AvailabilityCheck[]>([]);
  const [recordingsModalOpen, setRecordingsModalOpen] = useState(false);
  const selectedVenue = ownerConfig.venue || ownerConfig.restaurant_name || 'Main Dining Room';

  // TTFA (Time to First Audio) Telemetry State
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'speaking' | 'awaiting_audio' | 'agent_speaking'>('idle');
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [latestTtfa, setLatestTtfa] = useState<TtfaRecord | null>(null);
  const [ttfaHistory, setTtfaHistory] = useState<TtfaRecord[]>([]);

  const averageTtfa = ttfaHistory.length > 0 
    ? (ttfaHistory.reduce((acc, t) => acc + t.seconds, 0) / ttfaHistory.length) 
    : null;

  // SQLite Seating Plan Synchronization
  useEffect(() => {
    async function loadSeatingFromDb() {
      try {
        const res = await fetch('/api/db/seating');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.tables) && data.tables.length > 0) {
            setTables(data.tables);
          }
        }
      } catch (e) {
        console.warn('Could not load seating from SQLite', e);
      }
    }
    loadSeatingFromDb();
  }, []);

  // Persist table status changes to SQLite (debounced)
  useEffect(() => {
    if (tables && tables.length > 0) {
      const timer = setTimeout(async () => {
        try {
          await fetch('/api/db/seating', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tables })
          });
        } catch (e) {
          console.warn('Could not persist seating to SQLite', e);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [tables]);

  // Helper to persist calls into SQLite
  const saveCallToDb = useCallback(async (callData: {
    caller_name: string;
    caller_phone?: string;
    duration_seconds?: number;
    intent: 'reservation' | 'takeout' | 'inquiry';
    transcript?: any[];
    tool_calls?: any[];
    reservation_summary?: string;
    order_summary?: string;
  }) => {
    try {
      await fetch('/api/db/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_name: callData.caller_name,
          caller_phone: callData.caller_phone || 'Private Caller ID',
          venue: selectedVenue,
          duration_seconds: callData.duration_seconds || 45,
          status: 'completed',
          intent: callData.intent,
          transcript: callData.transcript || [
            { role: 'agent', text: ownerConfig.greeting || `Thanks for calling ${ownerConfig.restaurant_name}`, timestamp: '00:01' },
            { role: 'user', text: `Inbound voice request for ${callData.intent}`, timestamp: '00:15' },
            { role: 'agent', text: 'Confirmed and locked into venue database.', timestamp: '00:30' }
          ],
          tool_calls: callData.tool_calls || [],
          reservation_summary: callData.reservation_summary,
          order_summary: callData.order_summary
        })
      });
    } catch (e) {
      console.warn('Could not save call to SQLite', e);
    }
  }, [selectedVenue, ownerConfig.greeting, ownerConfig.restaurant_name]);
  
  const [liveCallMessage, setLiveCallMessage] = useState<string | null>(null);
  const lastLiveMessage = (callState === 'Disconnected' && !liveCallMessage)
    ? `Voice Concierge ready for ${ownerConfig.restaurant_name}. The Green Light rule ensures backend availability checks before confirmation.`
    : (liveCallMessage || `Voice Concierge ready for ${ownerConfig.restaurant_name}. The Green Light rule ensures backend availability checks before confirmation.`);

  const setLastLiveMessage = (msg: string) => {
    setLiveCallMessage(msg);
  };

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // TTFA High-Precision Timing Refs
  const speechStopTimestampRef = useRef<number>(0);
  const waitingForFirstAudioRef = useRef<boolean>(false);
  const callConnectTimeRef = useRef<number>(0);
  const waitingForGreetingRef = useRef<boolean>(false);
  const turnCounterRef = useRef<number>(1);
  const isUserSpeakingRef = useRef<boolean>(false);
  const speechFramesRef = useRef<number>(0);
  const silenceFramesRef = useRef<number>(0);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio helpers
  const pcmToBase64 = (f32Array: Float32Array) => {
    const pcm = new Int16Array(f32Array.length);
    for (let i = 0; i < f32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, f32Array[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const buffer = new ArrayBuffer(pcm.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(i * 2, pcm[i], true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const playAudioChunk = async (audioCtx: AudioContext, base64Audio: string) => {
    try {
      const binary = atob(base64Audio);
      const buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }
      
      const pcm16 = new Int16Array(buffer);
      const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime;
      }
      
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      };
    } catch (e) {
      console.error('Error playing audio chunk', e);
    }
  };

  // Table Tetris Solver & Lock Engine
  const handleNewReservation = useCallback((req: IncomingRequest) => {
    setTables(prevTables => {
      let targetTables: Table[] | null = null;
      const avail = prevTables.filter(t => t.stage === 'AVAILABLE');
      
      // 1. Check exact fit single table first
      let exact = avail.find(t => t.capacity >= req.partySize && t.capacity <= req.partySize + 2);
      if (exact) {
        targetTables = [exact];
      } else {
        // 2. Table Tetris: Scan for adjacent mergeable tables
        for (let t1 of avail) {
          for (let adjId of t1.adjacentTo || []) {
            const t2 = avail.find(t => t.id === adjId);
            if (t2 && (t1.capacity + t2.capacity) >= req.partySize) {
              targetTables = [t1, t2];
              break;
            }
          }
          if (targetTables) break;
        }
      }

      if (targetTables) {
        const targetIds = targetTables.map(t => t.id);
        const lockDuration = 30000; // 30-second TTL
        
        const lockedReq: IncomingRequest = {
          ...req,
          status: 'LOCKED',
          lockedTableIds: targetIds,
          lockExpiresAt: Date.now() + lockDuration,
        };

        setIncoming(prevReqs => [lockedReq, ...prevReqs]);
        setLastHandoff(lockedReq);
        setLastLiveMessage(`Table locked for ${req.name} (${req.partySize} guests) on ${targetIds.join(' + ')}`);

        return prevTables.map(t => {
          if (targetIds.includes(t.id)) {
            return { 
              ...t, 
              stage: 'LOCKED', 
              mergedWith: targetIds.length > 1 ? targetIds.filter(id => id !== t.id) : [] 
            };
          }
          return t;
        });
      } else {
        // No capacity or merge available -> Send to Waitlist
        const waitlistReq: IncomingRequest = { ...req, status: 'PENDING' };
        setWaitlist(prev => [waitlistReq, ...prev]);
        setLastLiveMessage(`No table available for ${req.name} (${req.partySize} guests) - Added to Waitlist.`);
        return prevTables;
      }
    });
  }, []);

  // Live Call Controls
  const startCall = async () => {
    if (callState !== 'Disconnected') return;
    setMicError(null);
    setCallState('Connecting');
    setSpeechStatus('idle');
    setLiveElapsedSeconds(0);
    speechStopTimestampRef.current = 0;
    waitingForFirstAudioRef.current = false;
    turnCounterRef.current = 1;
    isUserSpeakingRef.current = false;
    speechFramesRef.current = 0;
    silenceFramesRef.current = 0;
    callConnectTimeRef.current = 0;
    waitingForGreetingRef.current = false;
    setLastLiveMessage(`Connecting to ${ownerConfig.restaurant_name} Voice Concierge (Gemini 3.1 Live)...`);
    nextPlayTimeRef.current = 0;
    activeSourcesRef.current = [];
    
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Microphone audio input is not supported in this browser context.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      mediaStreamRef.current = stream;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live?venue=${encodeURIComponent(selectedVenue)}&voice=${encodeURIComponent(ownerConfig.voice_name || selectedVoice.name)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      if (outputAudioCtx.state === 'suspended') {
        await outputAudioCtx.resume();
      }
      audioContextRef.current = outputAudioCtx;

      const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      if (inputAudioCtx.state === 'suspended') {
        await inputAudioCtx.resume();
      }
      inputAudioCtxRef.current = inputAudioCtx;
      
      const source = inputAudioCtx.createMediaStreamSource(stream);
      // Low latency buffer: 2048 samples (128ms) for responsive voice streaming
      const processor = inputAudioCtx.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isMuted) {
          const inputData = e.inputBuffer.getChannelData(0);

          // Voice Activity Detection (VAD) RMS Energy Calculation
          let sumSquares = 0;
          for (let i = 0; i < inputData.length; i++) {
            sumSquares += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sumSquares / inputData.length);
          const SPEECH_THRESHOLD = 0.015;

          if (rms > SPEECH_THRESHOLD) {
            silenceFramesRef.current = 0;
            speechFramesRef.current += 1;

            if (speechFramesRef.current >= 2) {
              if (!isUserSpeakingRef.current) {
                isUserSpeakingRef.current = true;
                setSpeechStatus('speaking');
                // User interrupted or started speaking - cancel any pending timer
                if (elapsedTimerRef.current) {
                  clearInterval(elapsedTimerRef.current);
                  elapsedTimerRef.current = null;
                }
                waitingForFirstAudioRef.current = false;
              }
            }
          } else {
            if (isUserSpeakingRef.current) {
              silenceFramesRef.current += 1;
              // Silence sustained for ~3 frames (~384ms) => User has finished speaking!
              if (silenceFramesRef.current >= 3) {
                isUserSpeakingRef.current = false;
                speechFramesRef.current = 0;
                silenceFramesRef.current = 0;

                const stopTime = Date.now();
                speechStopTimestampRef.current = stopTime;
                waitingForFirstAudioRef.current = true;
                setSpeechStatus('awaiting_audio');
                setLiveElapsedSeconds(0);
                setLastLiveMessage('Caller finished speaking. Measuring TTFA...');

                if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
                elapsedTimerRef.current = setInterval(() => {
                  if (speechStopTimestampRef.current > 0) {
                    const el = (Date.now() - speechStopTimestampRef.current) / 1000;
                    setLiveElapsedSeconds(parseFloat(el.toFixed(2)));
                  }
                }, 40);
              }
            }
          }

          const base64 = pcmToBase64(inputData);
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      source.connect(processor);
      processor.connect(inputAudioCtx.destination);
      processorRef.current = processor;

      ws.onopen = () => {
        setCallState('Live');
        callConnectTimeRef.current = Date.now();
        waitingForGreetingRef.current = true;
        setSpeechStatus('awaiting_audio');
        setLiveElapsedSeconds(0);
        setLastLiveMessage('Live with Voice Concierge. Generating initial greeting...');
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = setInterval(() => {
          if (callConnectTimeRef.current > 0) {
            const el = (Date.now() - callConnectTimeRef.current) / 1000;
            setLiveElapsedSeconds(parseFloat(el.toFixed(2)));
          }
        }, 40);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            // Check Greeting TTFA
            if (waitingForGreetingRef.current && callConnectTimeRef.current > 0) {
              const elapsedMs = Math.round(Date.now() - callConnectTimeRef.current);
              const elapsedSec = (elapsedMs / 1000).toFixed(2);
              waitingForGreetingRef.current = false;
              callConnectTimeRef.current = 0;
              if (elapsedTimerRef.current) {
                clearInterval(elapsedTimerRef.current);
                elapsedTimerRef.current = null;
              }
              const record: TtfaRecord = {
                turn: 0,
                seconds: parseFloat(elapsedSec),
                formatted: `${elapsedSec}s`,
                ms: elapsedMs,
                timestamp: Date.now(),
                type: 'greeting'
              };
              setLatestTtfa(record);
              setTtfaHistory(prev => [record, ...prev]);
              setSpeechStatus('agent_speaking');
              setLastLiveMessage(`Greeting first audio generated in ${elapsedSec}s (TTFA: ${elapsedMs}ms)`);
            }
            // Check Turn TTFA (Each time user stopped speaking)
            else if (waitingForFirstAudioRef.current && speechStopTimestampRef.current > 0) {
              const elapsedMs = Math.round(Date.now() - speechStopTimestampRef.current);
              const elapsedSec = (elapsedMs / 1000).toFixed(2);
              waitingForFirstAudioRef.current = false;
              speechStopTimestampRef.current = 0;
              if (elapsedTimerRef.current) {
                clearInterval(elapsedTimerRef.current);
                elapsedTimerRef.current = null;
              }
              const record: TtfaRecord = {
                turn: turnCounterRef.current++,
                seconds: parseFloat(elapsedSec),
                formatted: `${elapsedSec}s`,
                ms: elapsedMs,
                timestamp: Date.now(),
                type: 'user_turn'
              };
              setLatestTtfa(record);
              setTtfaHistory(prev => [record, ...prev.slice(0, 9)]);
              setSpeechStatus('agent_speaking');
              setLastLiveMessage(`Agent first audio generated in ${elapsedSec}s (TTFA: ${elapsedMs}ms)`);
            }

            playAudioChunk(outputAudioCtx, msg.audio);
          }
          if (msg.turnComplete) {
            setSpeechStatus('idle');
          }
          if (msg.interrupted) {
            activeSourcesRef.current.forEach(src => {
              try { src.stop(); } catch (e) {}
            });
            activeSourcesRef.current = [];
            nextPlayTimeRef.current = outputAudioCtx.currentTime;
          }
          // Tool Event 1: Mid-Call check_availability (The Green Light verification)
          if (msg.toolEvent === 'check_availability') {
            const args = msg.arguments || {};
            const result = msg.result || {};
            const check: AvailabilityCheck = {
              id: msg.callId || Math.random().toString(36).slice(2, 9),
              partySize: Number(args.party_size) || 2,
              targetTime: String(args.target_time || '20:00'),
              venue: String(args.venue || selectedVenue),
              status: result.status === 'available' ? 'available' : 'unavailable',
              alternatives: result.alternatives || [],
              timestamp: Date.now()
            };
            setRecentChecks(prev => [check, ...prev.slice(0, 4)]);

            if (result.status === 'available') {
              setLastLiveMessage(`GREEN LIGHT: Verified backend availability for ${check.partySize} guests @ ${check.targetTime}. Locking table.`);
            } else {
              setLastLiveMessage(`UNAVAILABLE: ${check.partySize} guests @ ${check.targetTime} is full. Pivoting caller to alternatives: ${(result.alternatives || []).join(', ')}.`);
            }
          }

          // Tool Event 2: Real Function Call Handoff from Gemini Live (The Call Terminator)
          if (msg.functionCall && msg.functionCall.name === 'submit_reservation_data') {
            const args = msg.functionCall.arguments || {};
            const customerName = args.customer_name || 'Guest Caller';
            const partySize = Number(args.party_size) || 2;
            const confirmedTime = args.confirmed_time || args.requested_time || 'ASAP';
            const customerPhone = args.customer_phone || '';
            const venue = args.venue || selectedVenue;

            const voiceReq: IncomingRequest = {
              id: Math.random().toString(36).slice(2, 9),
              name: customerName,
              partySize,
              time: confirmedTime,
              phone: customerPhone,
              venue,
              tags: ['GREEN_LIGHT_VERIFIED', customerPhone ? `SMS: ${customerPhone}` : 'SQLite Lock'],
              status: 'PENDING',
              source: 'VOICE_CALL',
            };

            handleNewReservation(voiceReq);
            saveCallToDb({
              caller_name: customerName,
              caller_phone: customerPhone,
              intent: 'reservation',
              tool_calls: [{ name: 'submit_reservation_data', args }],
              reservation_summary: `Party of ${partySize} @ ${confirmedTime} locked for ${customerName}`
            });
            setLastLiveMessage(`FINAL LOCK: Contract approved. Party of ${partySize} @ ${confirmedTime} locked in SQLite for ${customerName}. SMS queued.`);
          }

          // Tool Event 3: Real Food Order Handoff to Phase 3 KDS Pacing Engine
          if (msg.functionCall && msg.functionCall.name === 'submit_food_order') {
            const args = msg.functionCall.arguments || {};
            const customerName = args.customer_name || 'Phone Guest';
            const customerPhone = args.customer_phone || '';
            const timing = args.timing || 'ASAP';
            const itemsList = args.items || [];

            // Match ordered item names to Menu Matrix or Owner Config
            const availableMenu = (menuItems && menuItems.length > 0) ? menuItems : MENU_MATRIX;
            const matchedItems = itemsList.map((reqItem: any) => {
              const reqName = String(reqItem.item_name || '').toLowerCase();
              const found = availableMenu.find(m => 
                m.item_name.toLowerCase().includes(reqName) || reqName.includes(m.item_name.toLowerCase())
              );
              return found || availableMenu[0];
            });

            if (matchedItems.length > 0) {
              createInboundOrder('VOICE_CALL', matchedItems, `${customerName} (${timing})`);
              saveCallToDb({
                caller_name: customerName,
                caller_phone: customerPhone,
                intent: 'takeout',
                tool_calls: [{ name: 'submit_food_order', args }],
                order_summary: `${matchedItems.length} items ordered for ${customerName} (${timing})`
              });
              setLastLiveMessage(`KDS PACING FIRED: ${matchedItems.length} items routed to Kitchen Expo for ${customerName}. Secure payment SMS dispatched to ${customerPhone || 'guest phone'}.`);
            }
          }
          if (msg.status === 'disconnected') {
            endCall();
          }
        } catch (e) {
          console.error('Error handling WebSocket message', e);
        }
      };

      ws.onclose = () => {
        endCall();
      };
      
    } catch (err: any) {
      console.warn('Microphone or WebSocket error', err);
      setCallState('Disconnected');
      const isPermissionDenied = err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied') || err?.name === 'PermissionDeniedError';
      const msg = isPermissionDenied 
        ? 'Microphone permission was denied. Please allow microphone access in your browser or iframe settings, or use the simulation buttons below.'
        : (err?.message || 'Unable to connect to audio stream or WebSocket.');
      setMicError(msg);
      setLastLiveMessage(msg);
    }
  };

  const endCall = () => {
    setCallState('Disconnected');
    setSpeechStatus('idle');
    setLiveElapsedSeconds(0);
    speechStopTimestampRef.current = 0;
    waitingForFirstAudioRef.current = false;
    waitingForGreetingRef.current = false;
    isUserSpeakingRef.current = false;
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }

    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;

    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ end: true })); } catch (e) {}
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Test Simulation 1: The Green Light Pivot (8:00 PM Unavailable -> Pivot to 19:30 -> Final Lock)
  const simulatePivotFlow = () => {
    // 1. Initial Request: 4 guests @ 8:00 PM (20:00)
    setSpeechStatus('speaking');
    const check1: AvailabilityCheck = {
      id: Math.random().toString(36).slice(2, 9),
      partySize: 4,
      targetTime: '20:00',
      venue: selectedVenue,
      status: 'unavailable',
      alternatives: ['19:30', '20:45'],
      timestamp: Date.now()
    };
    setRecentChecks(prev => [check1, ...prev.slice(0, 4)]);
    setLastLiveMessage('Caller requested Table for 4 @ 8:00 PM. check_availability returned UNAVAILABLE. Pivoting to 7:30 PM or 8:45 PM...');

    // Simulate caller stops speaking, agent generates turnaround in 0.74s
    setTimeout(() => {
      setSpeechStatus('awaiting_audio');
      setLiveElapsedSeconds(0.4);
      setTimeout(() => {
        const turn1: TtfaRecord = {
          turn: turnCounterRef.current++,
          seconds: 0.74,
          formatted: '0.74s',
          ms: 740,
          timestamp: Date.now(),
          type: 'simulation'
        };
        setLatestTtfa(turn1);
        setTtfaHistory(prev => [turn1, ...prev.slice(0, 9)]);
        setSpeechStatus('agent_speaking');
      }, 740);
    }, 600);

    // 2. Customer accepts 19:30 slot -> Green Light check fires
    setTimeout(() => {
      setSpeechStatus('speaking');
      const check2: AvailabilityCheck = {
        id: Math.random().toString(36).slice(2, 9),
        partySize: 4,
        targetTime: '19:30',
        venue: selectedVenue,
        status: 'available',
        timestamp: Date.now()
      };
      setRecentChecks(prev => [check2, ...prev.slice(0, 4)]);
      setLastLiveMessage('GREEN LIGHT: Verified availability for 4 guests @ 19:30. "Awesome, I have got that locked in for you."');

      setTimeout(() => {
        setSpeechStatus('awaiting_audio');
        setTimeout(() => {
          const turn2: TtfaRecord = {
            turn: turnCounterRef.current++,
            seconds: 0.68,
            formatted: '0.68s',
            ms: 680,
            timestamp: Date.now(),
            type: 'simulation'
          };
          setLatestTtfa(turn2);
          setTtfaHistory(prev => [turn2, ...prev.slice(0, 9)]);
          setSpeechStatus('agent_speaking');
        }, 680);
      }, 500);

      // 3. submit_reservation_data triggers final contract lock
      setTimeout(() => {
        const voiceReq: IncomingRequest = {
          id: Math.random().toString(36).slice(2, 9),
          name: 'Alexander Wright',
          partySize: 4,
          time: '19:30',
          phone: '604-555-0199',
          venue: selectedVenue,
          tags: ['GREEN_LIGHT_VERIFIED', 'PIVOTED_FROM_20:00', 'SMS: 604-555-0199'],
          status: 'PENDING',
          source: 'VOICE_CALL',
        };

        handleNewReservation(voiceReq);
        saveCallToDb({
          caller_name: 'Alexander Wright',
          caller_phone: '604-555-0199',
          intent: 'reservation',
          tool_calls: [
            { name: 'check_availability', args: { party_size: 4, target_time: '20:00' }, result: { status: 'unavailable', alternatives: ['19:30', '20:45'] } },
            { name: 'check_availability', args: { party_size: 4, target_time: '19:30' }, result: { status: 'available' } },
            { name: 'submit_reservation_data', args: { customer_name: 'Alexander Wright', party_size: 4, confirmed_time: '19:30', customer_phone: '604-555-0199' } }
          ],
          reservation_summary: 'Table locked for Alexander Wright (4 @ 19:30) pivoted from 20:00'
        });
        setLastLiveMessage('FINAL LOCK: submit_reservation_data executed! Table locked in SQLite for Alexander Wright (4 @ 19:30).');
      }, 1400);
    }, 1800);
  };

  // Test Simulation 2: Direct Green Light (7:00 PM Available -> Final Lock)
  const simulateDirectFlow = () => {
    setSpeechStatus('speaking');
    const check: AvailabilityCheck = {
      id: Math.random().toString(36).slice(2, 9),
      partySize: 2,
      targetTime: '19:00',
      venue: selectedVenue,
      status: 'available',
      timestamp: Date.now()
    };
    setRecentChecks(prev => [check, ...prev.slice(0, 4)]);
    setLastLiveMessage('Caller requested Table for 2 @ 7:00 PM. check_availability returned AVAILABLE (Green Light).');

    setTimeout(() => {
      setSpeechStatus('awaiting_audio');
      setTimeout(() => {
        const turnRec: TtfaRecord = {
          turn: turnCounterRef.current++,
          seconds: 0.71,
          formatted: '0.71s',
          ms: 710,
          timestamp: Date.now(),
          type: 'simulation'
        };
        setLatestTtfa(turnRec);
        setTtfaHistory(prev => [turnRec, ...prev.slice(0, 9)]);
        setSpeechStatus('agent_speaking');
      }, 710);
    }, 600);

    setTimeout(() => {
      const voiceReq: IncomingRequest = {
        id: Math.random().toString(36).slice(2, 9),
        name: 'Elena Rostova',
        partySize: 2,
        time: '19:00',
        phone: '604-555-0284',
        venue: selectedVenue,
        tags: ['GREEN_LIGHT_VERIFIED', 'DIRECT_MATCH', 'SMS: 604-555-0284'],
        status: 'PENDING',
        source: 'VOICE_CALL',
      };

      handleNewReservation(voiceReq);
      saveCallToDb({
        caller_name: 'Elena Rostova',
        caller_phone: '604-555-0284',
        intent: 'reservation',
        tool_calls: [
          { name: 'check_availability', args: { party_size: 2, target_time: '19:00' }, result: { status: 'available' } },
          { name: 'submit_reservation_data', args: { customer_name: 'Elena Rostova', party_size: 2, confirmed_time: '19:00', customer_phone: '604-555-0284' } }
        ],
        reservation_summary: 'Direct match table locked for Elena Rostova (2 @ 19:00)'
      });
      setLastLiveMessage('FINAL LOCK: submit_reservation_data executed for Elena Rostova (2 @ 19:00). Table locked in SQLite!');
    }, 1500);
  };

  // 1-Second Master Clock: Handles 30s TTL Lock Expirations and Table Dining Clocks
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      let expiredIds: string[] = [];
      
      setIncoming(prev => {
        let changed = false;
        const next = prev.map(req => {
          if (req.status === 'LOCKED' && req.lockExpiresAt && req.lockExpiresAt < now) {
            changed = true;
            expiredIds.push(...(req.lockedTableIds || []));
            return { ...req, status: 'EXPIRED' as const };
          }
          return req;
        });
        return changed ? next : prev;
      });

      // Release expired locked tables back to AVAILABLE
      if (expiredIds.length > 0) {
        setTables(prev => prev.map(t => {
          if (expiredIds.includes(t.id)) {
            return { ...t, stage: 'AVAILABLE', mergedWith: [], occupantName: undefined };
          }
          return t;
        }));
      }

      // Advance table elapsed timers
      setTables(prev => prev.map(t => {
        if (t.stage !== 'AVAILABLE' && t.stage !== 'LOCKED') {
          return { ...t, timeElapsed: (t.timeElapsed || 0) + 1 };
        }
        return t;
      }));

    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Seat Party Confirmation
  const confirmReservation = (reqId: string) => {
    let targetReq: IncomingRequest | undefined;
    setIncoming(prev => {
      targetReq = prev.find(r => r.id === reqId);
      return prev.map(r => r.id === reqId ? { ...r, status: 'SEATED' as const } : r);
    });
    
    if (targetReq && targetReq.lockedTableIds) {
      setTables(prev => prev.map(t => {
        if (targetReq!.lockedTableIds!.includes(t.id)) {
          return { ...t, stage: 'SEATED', occupantName: targetReq!.name, timeElapsed: 0 };
        }
        return t;
      }));
      setLastLiveMessage(`Seated party: ${targetReq.name} at Table ${targetReq.lockedTableIds.join(' + ')}`);
    }
  };

  // Stage Advancement Cycle
  const advanceStage = (id: string) => {
    setTables(prev => prev.map(t => {
      if (t.id === id) {
        const currentIndex = STAGES.indexOf(t.stage);
        if (currentIndex < STAGES.length - 1) {
          const nextStage = STAGES[currentIndex + 1] as DiningStage;
          const isCleared = nextStage === 'AVAILABLE';
          return { 
            ...t, 
            stage: nextStage, 
            occupantName: isCleared ? undefined : t.occupantName, 
            timeElapsed: isCleared ? 0 : t.timeElapsed,
            mergedWith: isCleared ? [] : t.mergedWith 
          };
        } else {
          return { ...t, stage: 'AVAILABLE', occupantName: undefined, timeElapsed: 0, mergedWith: [] };
        }
      }
      return t;
    }));
  };

  const getStageColor = (stage: string) => {
    switch(stage) {
      case 'LOCKED': return 'border-amber-500 bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/50 shadow-lg shadow-amber-950/30';
      case 'SEATED': return 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700';
      case 'APPS_FIRED': return 'border-blue-500/60 bg-blue-500/10 text-blue-700';
      case 'MAINS_CLEARED': return 'border-purple-500/60 bg-purple-500/10 text-purple-700';
      case 'CHECK_DROPPED': return 'border-pink-500/60 bg-pink-500/10 text-pink-400';
      case 'BUSSING_NEEDED': return 'border-red-500/70 bg-red-500/15 text-red-700 animate-pulse';
      default: return 'border-[#DCE8E4] bg-[#FFFFFF] text-slate-500 hover:border-slate-200';
    }
  };

  // Occupancy metrics
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const occupiedCapacity = tables.filter(t => t.stage !== 'AVAILABLE' && t.stage !== 'LOCKED').reduce((acc, t) => acc + t.capacity, 0);
  const occupancyRate = Math.round((occupiedCapacity / totalCapacity) * 100) || 0;
  const activeCount = tables.filter(t => t.stage !== 'AVAILABLE' && t.stage !== 'LOCKED').length;
  const lockedCount = tables.filter(t => t.stage === 'LOCKED').length;
  
  // Pipeline
  const pipelineTables = tables.filter(t => ['MAINS_CLEARED', 'CHECK_DROPPED', 'BUSSING_NEEDED'].includes(t.stage));
  
  // Render Merged Containers on Floor
  const renderMergedGroups = () => {
    const groups: Table[][] = [];
    const visited = new Set();
    
    tables.forEach(t => {
      if (t.mergedWith && t.mergedWith.length > 0 && !visited.has(t.id)) {
        const group = [t];
        visited.add(t.id);
        t.mergedWith.forEach(id => {
          const sibling = tables.find(x => x.id === id);
          if (sibling && !visited.has(sibling.id)) {
            group.push(sibling);
            visited.add(sibling.id);
          }
        });
        groups.push(group);
      }
    });

    return groups.map((g, i) => {
      const minX = Math.min(...g.map(t => t.x));
      const minY = Math.min(...g.map(t => t.y));
      const maxX = Math.max(...g.map(t => t.x + t.w));
      const maxY = Math.max(...g.map(t => t.y + t.h));
      const totalCap = g.reduce((sum, t) => sum + t.capacity, 0);

      return (
        <div 
          key={`merge-${i}`}
          className="absolute border-2 border-dashed border-amber-400/80 rounded-xl pointer-events-none transition-all duration-500 z-10"
          style={{
            left: `${minX - 1}%`,
            top: `${minY - 1}%`,
            width: `${maxX - minX + 2}%`,
            height: `${maxY - minY + 2}%`,
          }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F3F8F7] border border-amber-400/60 px-2 py-0.5 rounded text-[10px] text-amber-700 font-sans font-bold tracking-wider whitespace-nowrap shadow-lg flex items-center gap-1">
            <Sparkles size={10} className="text-amber-700 animate-spin" />
            TETRIS MERGED {totalCap}-TOP
          </div>
        </div>
      );
    });
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <div className="floor-screen flex flex-col h-screen bg-[#F3F8F7] text-slate-800 font-sans overflow-hidden select-none">
      
      {/* EXECUTIVE HEADER */}
      <header className="flex-none h-16 border-b border-[#DCE8E4] bg-[#F3F8F7] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)} 
            className="p-2 -ml-2 text-slate-600 hover:text-emerald-700 hover:bg-[#FFFFFF] rounded-md transition-colors"
            title="Toggle Voice Concierge Sidebar"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FFFFFF] border border-[#DCE8E4] flex items-center justify-center shadow-inner">
              <span className="text-emerald-700 font-serif font-bold text-sm tracking-wider">
                {ownerConfig.restaurant_name ? ownerConfig.restaurant_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'FC'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-wide">{ownerConfig.restaurant_name}</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 font-sans">
                  Floor Command &amp; Voice Concierge
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-sans">
                Location: <span className="text-slate-800">{ownerConfig.venue || 'Main St'} • {ownerConfig.tone || 'Lively & Casual'}</span>
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-5">
          {/* Key Floor Metrics */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center justify-center px-3.5 py-1 bg-[#FFFFFF] border border-[#DCE8E4] rounded-md min-w-[70px]">
              <span className="text-[10px] text-slate-500 font-sans uppercase">Occupancy</span>
              <span className="text-sm font-semibold text-emerald-700">{occupancyRate}%</span>
            </div>
            
            <div className="flex flex-col items-center justify-center px-3.5 py-1 bg-[#FFFFFF] border border-[#DCE8E4] rounded-md min-w-[70px]">
              <span className="text-[10px] text-slate-500 font-sans uppercase">Active</span>
              <span className="text-sm font-semibold">{activeCount} / {tables.length}</span>
            </div>

            {lockedCount > 0 && (
              <div className="flex flex-col items-center justify-center px-3.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md min-w-[70px] animate-pulse">
                <span className="text-[10px] text-amber-700 font-sans uppercase">Locked</span>
                <span className="text-sm font-semibold text-amber-700">{lockedCount}</span>
              </div>
            )}
          </div>
          
          {/* Call Status Pill in Header */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#FFFFFF] border border-[#DCE8E4] rounded-full text-xs font-sans">
            <span className={cn(
              "w-2 h-2 rounded-full",
              callState === 'Live' ? "bg-emerald-400 animate-ping" : 
              callState === 'Connecting' ? "bg-amber-400 animate-pulse" : "bg-zinc-600"
            )} />
            <span className="text-slate-600">
              {callState === 'Live' ? 'AI Call Active' : callState === 'Connecting' ? 'Connecting...' : 'AI Voice Standby'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={simulatePivotFlow}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] text-amber-700 border border-amber-500/30 hover:border-amber-400/60 rounded-lg text-xs font-sans transition-colors"
              title="Test Green Light Rule: 8:00 PM Unavailable -> Pivot to 7:30 PM -> Green Light Verified -> Final Lock"
            >
              <Sparkles size={13} className="text-amber-700" />
              <span>Test 8:00 PM (Pivot)</span>
            </button>
            <button 
              onClick={simulateDirectFlow}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] text-emerald-700 border border-emerald-500/30 hover:border-emerald-400/60 rounded-lg text-xs font-sans transition-colors"
              title="Test Direct Green Light: 7:00 PM Available -> Final Lock"
            >
              <CheckCircle size={13} className="text-emerald-700" />
              <span>Test 7:00 PM (Direct)</span>
            </button>
          </div>
        </div>
      </header>

      {/* SYSTEM WORKSPACE */}
      <div className="floor-workspace flex-1 flex overflow-hidden relative">
        
        {/* LEFT SIDEBAR: UNIFIED VOICE CONCIERGE & INCOMING RESERVATION STREAM */}
        <AnimatePresence>
          {leftDrawerOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="floor-voice flex-none h-full border-r border-[#DCE8E4] bg-[#FFFFFF] flex flex-col z-10 overflow-hidden shadow-2xl"
            >
              
              {/* TOP: LIVE VOICE CONCIERGE UNIT (PHASE 1) */}
              <div className="p-4 border-b border-[#DCE8E4] bg-[#FFFFFF] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={14} className={callState === 'Live' ? "text-emerald-700 animate-pulse" : "text-slate-500"} />
                    <h2 className="text-xs uppercase tracking-widest font-sans text-slate-700 font-semibold">
                      Voice Concierge
                    </h2>
                  </div>
                  <span className={cn(
                    "text-[10px] font-sans px-2 py-0.5 rounded-full border",
                    callState === 'Live' ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" :
                    callState === 'Connecting' ? "bg-amber-500/10 text-amber-700 border-amber-500/30" :
                    "bg-[#F3F8F7] text-slate-500 border-[#DCE8E4]"
                  )}>
                    {callState.toUpperCase()}
                  </span>
                </div>

                {/* Focused Single Venue Display */}
                <div className="flex items-center justify-between px-3 py-2 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-sans text-slate-500">Active Location</span>
                    <span className="text-xs font-semibold text-slate-800">{ownerConfig.restaurant_name}</span>
                  </div>
                  <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
                    {ownerConfig.venue || 'Main St'} • {selectedVoice.name} Voice
                  </span>
                </div>

                {/* SQLite Voice Call Vault & Recordings Button */}
                <button
                  onClick={() => setRecordingsModalOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#FFFFFF] hover:bg-[#F3F8F7] border border-slate-200 hover:border-emerald-500/40 rounded-lg text-xs font-sans transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Database size={13} className="text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className="text-slate-800 font-semibold">SQLite Call Recordings Vault</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 border border-emerald-500/40 font-bold">
                    View Logs
                  </span>
                </button>

                {/* Live Call Controller & Audio Waveform */}
                <div className="bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Mini Pulsing Orb */}
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border",
                        callState === 'Live' ? "bg-emerald-100/80 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-950" :
                        callState === 'Connecting' ? "bg-amber-100/80 border-amber-500 text-amber-700 animate-pulse" :
                        "bg-[#F3F8F7] border-[#DCE8E4] text-slate-500"
                      )}>
                        {callState === 'Live' ? (
                          <div className="flex gap-0.5 items-center h-4">
                            {[40, 90, 60, 100].map((h, idx) => (
                              <div 
                                key={idx} 
                                className="w-1 bg-emerald-400 rounded-full animate-pulse" 
                                style={{ height: `${h}%`, animationDelay: `${idx * 0.15}s` }} 
                              />
                            ))}
                          </div>
                        ) : (
                          <Phone size={16} />
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-800">
                          {callState === 'Live' ? 'Gemini 3.1 Multimodal Live' : 'Autonomous Voice Agent'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-sans">
                          {callState === 'Live' ? (isMuted ? 'Microphone Muted' : 'Direct Audio Streaming') : 'Ready for caller'}
                        </p>
                      </div>
                    </div>

                    {/* Start / Stop Call Buttons */}
                    <div className="flex items-center gap-1.5">
                      {callState === 'Live' && (
                        <button
                          onClick={toggleMute}
                          className={cn(
                            "p-2 rounded-md text-xs border transition-colors",
                            isMuted ? "bg-amber-500/20 text-amber-700 border-amber-500/40" : "bg-[#F3F8F7] text-slate-600 border-[#DCE8E4] hover:text-slate-900"
                          )}
                          title={isMuted ? "Unmute Mic" : "Mute Mic"}
                        >
                          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                      )}

                      {callState === 'Disconnected' ? (
                        <button
                          onClick={startCall}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors shadow-md"
                        >
                          <Phone size={13} />
                          <span>Start Call</span>
                        </button>
                      ) : (
                        <button
                          onClick={endCall}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-700 border border-red-500/40 rounded-md text-xs font-medium transition-colors"
                        >
                          <PhoneOff size={13} />
                          <span>End Call</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Operational Status Text */}
                  <div className="text-[11px] font-sans text-slate-600 bg-[#FFFFFF] border border-[#DCE8E4] rounded p-2 flex items-start gap-2">
                    <Activity size={13} className={cn("mt-0.5 shrink-0", micError ? "text-amber-700" : "text-emerald-700")} />
                    <p className="leading-tight line-clamp-2">{lastLiveMessage}</p>
                  </div>

                  {/* TTFA (TIME TO FIRST AUDIO) REAL-TIME TELEMETRY PANEL */}
                  <div id="ttfa-telemetry-panel" className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Gauge size={13} className="text-cyan-700" />
                        <span className="text-[11px] uppercase tracking-wider font-sans text-slate-800 font-semibold">
                          Response Latency (TTFA)
                        </span>
                      </div>
                      
                      {/* Active Speech Detection Status */}
                      {speechStatus === 'awaiting_audio' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-amber-500/20 text-amber-700 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                          <Timer size={10} className="animate-spin" />
                          <span>Generating: {liveElapsedSeconds.toFixed(2)}s</span>
                        </span>
                      ) : speechStatus === 'speaking' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-cyan-500/20 text-cyan-700 border border-cyan-500/40 flex items-center gap-1">
                          <Mic size={10} />
                          <span>Caller Speaking...</span>
                        </span>
                      ) : speechStatus === 'agent_speaking' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-emerald-500/20 text-emerald-700 border border-emerald-500/40 flex items-center gap-1">
                          <Volume2 size={10} />
                          <span>Agent Responding</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-slate-100 text-slate-600 border border-slate-200">
                          {callState === 'Live' ? 'Listening for speech' : 'Call Inactive'}
                        </span>
                      )}
                    </div>

                    {/* Metric Gauges: Latest TTFA vs Average TTFA */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded p-2 flex flex-col">
                        <span className="text-[9px] uppercase tracking-wide font-sans text-slate-500">
                          Last Response (TTFA)
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className={cn(
                            "text-lg font-bold font-sans tracking-tight",
                            speechStatus === 'awaiting_audio' 
                              ? "text-amber-700 animate-pulse" 
                              : latestTtfa ? "text-emerald-700" : "text-slate-500"
                          )}>
                            {speechStatus === 'awaiting_audio' 
                              ? `${liveElapsedSeconds.toFixed(2)}s` 
                              : latestTtfa ? `${latestTtfa.seconds.toFixed(2)}s` : '--'}
                          </span>
                          {latestTtfa && speechStatus !== 'awaiting_audio' && (
                            <span className="text-[10px] font-sans text-slate-500">
                              ({latestTtfa.ms}ms)
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-sans text-slate-600 truncate mt-0.5">
                          {speechStatus === 'awaiting_audio'
                            ? 'Paused ➔ Audio chunk arrival'
                            : latestTtfa
                              ? (latestTtfa.type === 'greeting' ? 'Initial Greeting' : `Turn #${latestTtfa.turn} reply`)
                              : 'Pause speaking to test'}
                        </span>
                      </div>

                      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded p-2 flex flex-col">
                        <span className="text-[9px] uppercase tracking-wide font-sans text-slate-500">
                          Session Average
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-lg font-bold font-sans tracking-tight text-cyan-700">
                            {averageTtfa ? `${averageTtfa.toFixed(2)}s` : '--'}
                          </span>
                        </div>
                        <span className="text-[9px] font-sans text-slate-600 truncate mt-0.5">
                          {ttfaHistory.length > 0 ? `${ttfaHistory.length} turns sampled` : '0 samples'}
                        </span>
                      </div>
                    </div>

                    {/* Turn-by-Turn History Chips */}
                    {ttfaHistory.length > 0 && (
                      <div className="flex flex-col gap-1 pt-1 border-t border-[#DCE8E4]">
                        <div className="flex items-center justify-between text-[9px] font-sans text-slate-500">
                          <span>Recent Turn Latencies</span>
                          <span>Target: &lt; 1.00s</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                          {ttfaHistory.map((rec, i) => (
                            <div
                              key={i}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-sans border flex items-center gap-1",
                                rec.seconds < 0.85
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                                  : rec.seconds < 1.4
                                    ? "bg-cyan-500/10 text-cyan-700 border-cyan-500/30"
                                    : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                              )}
                              title={`Turn ${rec.turn}: ${rec.seconds}s (${rec.ms}ms)`}
                            >
                              <span className="text-slate-500">{rec.type === 'greeting' ? 'G' : `T${rec.turn}`}:</span>
                              <span className="font-semibold">{rec.formatted}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {micError && (
                    <div className="bg-amber-100/30 border border-amber-500/40 rounded p-2.5 flex flex-col gap-1.5 text-[11px] font-sans text-amber-700">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle size={13} className="text-amber-700 shrink-0" />
                        <span>Microphone Access Notice</span>
                      </div>
                      <p className="text-[10px] text-amber-700/80 leading-relaxed">
                        Browser microphone permission was denied or is restricted in this preview frame. You can enable mic access via browser site settings, or click <strong className="text-amber-700">&quot;Test 8:00 PM (Pivot)&quot;</strong> / <strong className="text-emerald-700">&quot;Test 7:00 PM (Direct)&quot;</strong> above to simulate end-to-end voice workflows without audio hardware.
                      </p>
                    </div>
                  )}
                </div>

                {/* GREEN LIGHT AVAILABILITY FEED (MID-CALL AUDIT TRAIL) */}
                <div className="p-3 border-t border-[#DCE8E4] bg-[#FFFFFF] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <h3 className="text-[11px] uppercase tracking-wider font-sans text-slate-700 font-semibold">
                        Green Light Rule Audits
                      </h3>
                    </div>
                    <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Mid-Call Verifier
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans">
                    Must check availability before confirming table.
                  </p>

                  {recentChecks.length === 0 ? (
                    <div className="py-2 px-2.5 rounded bg-[#FFFFFF] border border-[#DCE8E4] text-[10px] font-sans text-slate-500 text-center">
                      Awaiting caller time inquiry...
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {recentChecks.map((c) => (
                        <div 
                          key={c.id} 
                          className={cn(
                            "p-2 rounded border text-[11px] font-sans flex flex-col gap-1 transition-all",
                            c.status === 'available' 
                              ? "bg-emerald-100/20 border-emerald-500/40 text-emerald-700"
                              : "bg-amber-100/20 border-amber-500/40 text-amber-700"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              Party of {c.partySize} @ {c.targetTime}
                            </span>
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold",
                              c.status === 'available' 
                                ? "bg-emerald-500/20 text-emerald-700 border border-emerald-500/40" 
                                : "bg-amber-500/20 text-amber-700 border border-amber-500/40"
                            )}>
                              {c.status === 'available' ? 'GREEN LIGHT' : 'UNAVAILABLE'}
                            </span>
                          </div>

                          {c.status === 'unavailable' && c.alternatives && c.alternatives.length > 0 && (
                            <div className="text-[10px] text-amber-700/80 bg-amber-100/40 px-1.5 py-0.5 rounded">
                              Pivoted to alternatives: {c.alternatives.join(', ')}
                            </div>
                          )}
                          {c.status === 'available' && (
                            <div className="text-[10px] text-emerald-700/80">
                              Verified in 15-min grid. Locked for booking.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* BOTTOM: INCOMING STREAM & CONCURRENCY LOCK FEED */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-[#DCE8E4] bg-[#FFFFFF] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs uppercase tracking-widest font-sans text-slate-600">
                      Floor Locks & Streams
                    </h3>
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-bold">
                      {incoming.filter(r => r.status === 'LOCKED').length}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans">30s TTL Lock</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {incoming.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#FFFFFF] border border-[#DCE8E4] flex items-center justify-center">
                        <Utensils size={18} className="opacity-40" />
                      </div>
                      <p className="text-xs font-sans text-slate-600">No active reservation locks.</p>
                      <p className="text-[11px] text-slate-500 max-w-[220px]">
                        Start a voice call or click &quot;Simulate Call&quot; to see real-time Table Tetris solver and 30s locks in action.
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {incoming.map(req => {
                        const secondsRemaining = req.lockExpiresAt && currentTime ? Math.max(0, Math.floor((req.lockExpiresAt - currentTime) / 1000)) : 0;
                        const isLocked = req.status === 'LOCKED';
                        
                        return (
                          <motion.div 
                            key={req.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                              "border rounded-lg p-3 flex flex-col gap-2.5 relative overflow-hidden transition-all shadow-md",
                              isLocked ? "bg-[#FFFFFF] border-amber-500/40" : 
                              req.status === 'SEATED' ? "bg-[#FFFFFF] border-emerald-500/30 opacity-70" :
                              "bg-[#FFFFFF] border-[#DCE8E4]"
                            )}
                          >
                            {/* 30s Countdown progress bar */}
                            {isLocked && (
                              <div className="absolute top-0 left-0 w-full h-1 bg-[#F3F8F7]">
                                <motion.div 
                                  initial={{ width: '100%' }}
                                  animate={{ width: '0%' }}
                                  transition={{ duration: 30, ease: 'linear' }}
                                  className="h-full bg-amber-500"
                                />
                              </div>
                            )}

                            <div className="flex justify-between items-start pt-1">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-sm font-semibold text-slate-800">{req.name}</h4>
                                  {req.source === 'VOICE_CALL' && (
                                    <span className="text-[9px] bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 px-1.5 py-0.2 rounded font-sans">
                                      VOICE
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 font-sans mt-0.5">
                                  Party of {req.partySize} • {req.time} {req.phone ? `• 📞 ${req.phone}` : ''}
                                </p>
                              </div>

                              {isLocked && (
                                <div className="flex items-center gap-1 bg-amber-500/15 text-amber-700 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-sans">
                                  <Lock size={10} />
                                  <span>{secondsRemaining}s</span>
                                </div>
                              )}
                              
                              {req.status === 'SEATED' && (
                                <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-sans">
                                  <CheckCircle size={10} />
                                  <span>SEATED</span>
                                </div>
                              )}

                              {req.status === 'EXPIRED' && (
                                <div className="bg-red-500/10 text-red-700 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-sans">
                                  EXPIRED
                                </div>
                              )}
                            </div>

                            {/* Assigned table info */}
                            {req.lockedTableIds && req.lockedTableIds.length > 0 && (
                              <div className="flex items-center gap-2 text-xs font-sans">
                                <span className="text-slate-500">Hold:</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded font-bold",
                                  req.lockedTableIds.length > 1 
                                    ? "bg-amber-500/20 text-amber-700 border border-amber-500/40" 
                                    : "bg-slate-100 text-slate-800"
                                )}>
                                  {req.lockedTableIds.length > 1 ? `MERGED ${req.lockedTableIds.join(' + ')}` : `Table ${req.lockedTableIds[0]}`}
                                </span>
                              </div>
                            )}

                            {/* Tags */}
                            {req.tags && req.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {req.tags.map((tag, tIdx) => (
                                  <span key={`${req.id}-tag-${tIdx}-${tag}`} className="text-[10px] bg-[#F3F8F7] text-slate-600 px-2 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Action: Seat Party */}
                            {isLocked && (
                              <button 
                                onClick={() => confirmReservation(req.id)}
                                className="w-full mt-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0C] font-semibold text-xs rounded transition-colors flex items-center justify-center gap-2 shadow-lg"
                              >
                                <CheckCircle size={14} />
                                Confirm &amp; Seat Party
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* CENTER: SPATIAL FLOOR CANVAS */}
        <div className="floor-canvas flex-1 relative bg-[#F3F8F7] flex items-center justify-center overflow-auto p-6" onClick={() => setSelectedTableId(null)}>
          <div className="w-full min-w-[560px] max-w-4xl aspect-[4/3] bg-[#FFFFFF] rounded-2xl border border-[#DCE8E4] relative shadow-2xl overflow-hidden">
            
            {/* Grid Blueprint Texture */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none" 
              style={{ backgroundImage: 'radial-gradient(#CCDCD6 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />
            
            {/* Dynamic Merged Bounding Boxes (Table Tetris) */}
            {renderMergedGroups()}

            {/* Individual Tables */}
            {tables.map(table => (
              <motion.div
                key={table.id}
                onClick={(e) => { e.stopPropagation(); setSelectedTableId(table.id); }}
                className={cn(
                  "absolute flex flex-col items-center justify-center cursor-pointer transition-all duration-300 rounded-xl border",
                  getStageColor(table.stage),
                  selectedTableId === table.id && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-white z-20 scale-105"
                )}
                style={{
                  left: `${table.x}%`,
                  top: `${table.y}%`,
                  width: `${table.w}%`,
                  height: `${table.h}%`,
                }}
              >
                <span className="font-sans text-sm font-bold tracking-tight">{table.label}</span>
                <span className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
                  <Users size={10} /> {table.capacity}
                </span>
                
                {/* Active Dining Timer */}
                {table.stage !== 'AVAILABLE' && table.stage !== 'LOCKED' && (
                  <div className="absolute -bottom-2 -right-2 bg-[#F3F8F7] border border-[#DCE8E4] text-slate-700 text-[10px] font-sans px-1.5 py-0.5 rounded shadow-xl whitespace-nowrap">
                    {formatTime(table.timeElapsed || 0)}
                  </div>
                )}
                
                {/* Occupant Badge */}
                {table.occupantName && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F3F8F7] border border-slate-200 text-slate-800 text-[9px] font-medium px-2 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis max-w-[90%] shadow">
                    {table.occupantName.split(' ')[0]}
                  </div>
                )}

                {/* Locked Indicator on Canvas */}
                {table.stage === 'LOCKED' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-[#0A0A0C] text-[9px] font-sans font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow animate-pulse">
                    <Lock size={9} />
                    LOCKED
                  </div>
                )}
              </motion.div>
            ))}

            {/* Architectural Spatial Labels */}
            <div className="absolute bottom-4 left-4 text-slate-500 font-sans text-xs uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block animate-pulse"></span> Host Stand / Main Entrance
            </div>
            <div className="absolute top-4 right-4 text-slate-500 font-sans text-xs uppercase tracking-widest flex items-center gap-2">
              <Utensils size={14} /> Kitchen &amp; Expediter
            </div>
            <div className="absolute top-4 left-6 text-slate-500 font-sans text-xs uppercase tracking-widest">
              Booth Row
            </div>
            <div className="absolute bottom-4 right-6 text-slate-500 font-sans text-xs uppercase tracking-widest">
              Bar Area
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: TURNOVER PIPELINE & WAITLIST */}
        <AnimatePresence>
          {rightDrawerOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="floor-pipeline flex-none h-full border-l border-[#DCE8E4] bg-[#F3F8F7] flex flex-col z-10 shadow-xl"
            >
              <div className="flex border-b border-[#DCE8E4] bg-[#FFFFFF]">
                <button 
                  onClick={() => setRightTab('turnover')}
                  className={cn(
                    "flex-1 p-3 text-xs uppercase tracking-widest font-sans text-center transition-colors border-b-2",
                    rightTab === 'turnover' ? 'border-emerald-400 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  Turnover ({pipelineTables.length})
                </button>
                <button 
                  onClick={() => setRightTab('waitlist')}
                  className={cn(
                    "flex-1 p-3 text-xs uppercase tracking-widest font-sans text-center transition-colors border-b-2 flex items-center justify-center gap-2",
                    rightTab === 'waitlist' ? 'border-emerald-400 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  Waitlist
                  {waitlist.length > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {waitlist.length}
                    </span>
                  )}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {rightTab === 'turnover' && (
                  <div className="space-y-3">
                    {pipelineTables.length === 0 ? (
                      <div className="text-center text-slate-500 mt-12 font-sans text-xs">
                        No tables currently in turnover stages.
                      </div>
                    ) : (
                      pipelineTables.sort((a,b) => (b.timeElapsed||0) - (a.timeElapsed||0)).map(t => (
                        <div 
                          key={t.id} 
                          onClick={() => setSelectedTableId(t.id)}
                          className="bg-[#FFFFFF] border border-[#DCE8E4] hover:border-zinc-500 p-3 rounded-lg flex justify-between items-center cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{t.label} <span className="text-slate-500 text-xs ml-2">({t.occupantName || 'Guest'})</span></p>
                            <p className={cn(
                              "text-[10px] font-sans mt-1",
                              t.stage === 'BUSSING_NEEDED' ? 'text-red-700' : 
                              t.stage === 'CHECK_DROPPED' ? 'text-pink-400' : 'text-purple-700'
                            )}>
                              {t.stage.replace('_', ' ')}
                            </p>
                          </div>
                          <span className="text-xs font-sans text-slate-600">{formatTime(t.timeElapsed || 0)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {rightTab === 'waitlist' && (
                  <div className="space-y-3">
                    {waitlist.length === 0 ? (
                      <div className="text-center text-slate-500 mt-12 font-sans text-xs">
                        Waitlist is clear.
                      </div>
                    ) : (
                      waitlist.map(req => (
                        <div key={req.id} className="bg-[#FFFFFF] border border-[#DCE8E4] p-3 rounded-lg flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-sm font-medium text-slate-800">{req.name}</h3>
                              <p className="text-xs text-slate-500 font-sans">Party of {req.partySize}</p>
                            </div>
                            <span className="text-[10px] text-slate-500">{req.time}</span>
                          </div>
                          <button 
                            onClick={() => {
                              setWaitlist(prev => prev.filter(r => r.id !== req.id));
                              handleNewReservation({ ...req, status: 'PENDING' });
                            }}
                            className="w-full py-1.5 border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 text-xs rounded transition-colors"
                          >
                            Solve with Table Tetris ➔
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* TABLE INSPECTION OVERLAY */}
        <AnimatePresence>
          {selectedTable && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#FFFFFF] border border-[#DCE8E4] shadow-2xl rounded-2xl overflow-hidden z-30"
            >
              <div className={cn("h-1.5 w-full", getStageColor(selectedTable.stage).split(' ')[0].replace('border', 'bg'))} />
              <div className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">{selectedTable.label}</h2>
                      <span className="text-xs font-sans px-2 py-0.5 rounded-full bg-[#F3F8F7] text-slate-600">
                        {selectedTable.type} • {selectedTable.capacity} Guests
                      </span>
                      <span className={cn(
                        "text-[10px] font-sans px-2 py-0.5 rounded",
                        selectedTable.stage === 'AVAILABLE' ? "bg-slate-100 text-slate-600" :
                        selectedTable.stage === 'LOCKED' ? "bg-amber-500/20 text-amber-700" :
                        "bg-emerald-500/20 text-emerald-700"
                      )}>
                        {selectedTable.stage.replace('_', ' ')}
                      </span>
                    </div>
                    {selectedTable.occupantName ? (
                      <p className="text-sm text-slate-700 mt-1">
                        Occupant: <span className="text-slate-900 font-medium">{selectedTable.occupantName}</span> ({formatTime(selectedTable.timeElapsed || 0)})
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500 mt-1">Currently unoccupied</p>
                    )}
                  </div>
                  <button onClick={() => setSelectedTableId(null)} className="p-1 hover:bg-[#F3F8F7] rounded-md text-slate-600">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => advanceStage(selectedTable.id)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0C] font-semibold text-xs py-2.5 rounded transition-colors flex justify-center items-center gap-2"
                  >
                    Advance Stage ➔
                  </button>
                  <button 
                    onClick={() => {
                      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, stage: 'AVAILABLE', occupantName: undefined, timeElapsed: 0, mergedWith: [] } : t));
                      setSelectedTableId(null);
                    }}
                    className="px-3 bg-red-500/10 text-red-700 border border-red-500/30 hover:bg-red-500/20 text-xs rounded transition-colors flex justify-center items-center"
                    title="Reset to Available"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Persistent SQLite Voice Call Vault & Recordings Modal */}
      <VoiceRecordingsModal 
        isOpen={recordingsModalOpen} 
        onClose={() => setRecordingsModalOpen(false)} 
        venueName={selectedVenue} 
      />
    </div>
  );
}
