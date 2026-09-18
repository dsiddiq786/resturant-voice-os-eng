'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Clock, CheckCircle, AlertCircle, Utensils, 
  CreditCard, Trash2, ChevronRight, Phone, PhoneOff, 
  Coffee, Lock, Menu, X, Activity, Mic, MicOff, Volume2, Sparkles, Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKDS } from '@/lib/kdsContext';
import { MENU_MATRIX } from '@/lib/menuMatrix';

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
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
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
  const [recentChecks, setRecentChecks] = useState<AvailabilityCheck[]>([]);
  const selectedVenue = 'Sing Sing (Main St)';
  const [lastLiveMessage, setLastLiveMessage] = useState<string>('Voice Concierge ready for Sing Sing. The Green Light rule ensures backend availability checks before confirmation.');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

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
    setCallState('Connecting');
    setLastLiveMessage('Connecting to Freehouse Voice Concierge (Gemini 3.1 Live)...');
    nextPlayTimeRef.current = 0;
    activeSourcesRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      mediaStreamRef.current = stream;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live?venue=${encodeURIComponent(selectedVenue)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputAudioCtx;

      const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputAudioCtx;
      
      const source = inputAudioCtx.createMediaStreamSource(stream);
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isMuted) {
          const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      source.connect(processor);
      processor.connect(inputAudioCtx.destination);
      processorRef.current = processor;

      ws.onopen = () => {
        setCallState('Live');
        setLastLiveMessage('Live with Voice Concierge. Speak to request a table or order.');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            playAudioChunk(outputAudioCtx, msg.audio);
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
              tags: ['GREEN_LIGHT_VERIFIED', customerPhone ? `SMS: ${customerPhone}` : 'PostgreSQL Lock'],
              status: 'PENDING',
              source: 'VOICE_CALL',
            };

            handleNewReservation(voiceReq);
            setLastLiveMessage(`FINAL LOCK: Contract approved. Party of ${partySize} @ ${confirmedTime} locked in PostgreSQL for ${customerName}. SMS queued.`);
          }

          // Tool Event 3: Real Food Order Handoff to Phase 3 KDS Pacing Engine
          if (msg.functionCall && msg.functionCall.name === 'submit_food_order') {
            const args = msg.functionCall.arguments || {};
            const customerName = args.customer_name || 'Phone Guest';
            const customerPhone = args.customer_phone || '';
            const timing = args.timing || 'ASAP';
            const itemsList = args.items || [];

            // Match ordered item names to Menu Matrix
            const matchedItems = itemsList.map((reqItem: any) => {
              const reqName = String(reqItem.item_name || '').toLowerCase();
              const found = MENU_MATRIX.find(m => 
                m.item_name.toLowerCase().includes(reqName) || reqName.includes(m.item_name.toLowerCase())
              );
              return found || MENU_MATRIX[0];
            });

            if (matchedItems.length > 0) {
              createInboundOrder('VOICE_CALL', matchedItems, `${customerName} (${timing})`);
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
      
    } catch (err) {
      console.error('Microphone or WebSocket error', err);
      setCallState('Disconnected');
      setLastLiveMessage('Microphone access denied or connection error.');
    }
  };

  const endCall = () => {
    setCallState('Disconnected');
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

    // 2. Customer accepts 19:30 slot -> Green Light check fires
    setTimeout(() => {
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
        setLastLiveMessage('FINAL LOCK: submit_reservation_data executed! Table locked in PostgreSQL for Alexander Wright (4 @ 19:30).');
      }, 1000);
    }, 1500);
  };

  // Test Simulation 2: Direct Green Light (7:00 PM Available -> Final Lock)
  const simulateDirectFlow = () => {
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
      setLastLiveMessage('FINAL LOCK: submit_reservation_data executed for Elena Rostova (2 @ 19:00). Table locked!');
    }, 900);
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
      case 'LOCKED': return 'border-amber-500 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/50 shadow-lg shadow-amber-950/30';
      case 'SEATED': return 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400';
      case 'APPS_FIRED': return 'border-blue-500/60 bg-blue-500/10 text-blue-400';
      case 'MAINS_CLEARED': return 'border-purple-500/60 bg-purple-500/10 text-purple-400';
      case 'CHECK_DROPPED': return 'border-pink-500/60 bg-pink-500/10 text-pink-400';
      case 'BUSSING_NEEDED': return 'border-red-500/70 bg-red-500/15 text-red-400 animate-pulse';
      default: return 'border-[#22242A] bg-[#131418] text-zinc-500 hover:border-zinc-600';
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
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0A0A0C] border border-amber-400/60 px-2 py-0.5 rounded text-[10px] text-amber-300 font-mono font-bold tracking-wider whitespace-nowrap shadow-lg flex items-center gap-1">
            <Sparkles size={10} className="text-amber-400 animate-spin" />
            TETRIS MERGED {totalCap}-TOP
          </div>
        </div>
      );
    });
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0C] text-zinc-100 font-sans overflow-hidden select-none">
      
      {/* EXECUTIVE HEADER */}
      <header className="flex-none h-16 border-b border-[#22242A] bg-[#0A0A0C] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)} 
            className="p-2 -ml-2 text-zinc-400 hover:text-emerald-400 hover:bg-[#131418] rounded-md transition-colors"
            title="Toggle Voice Concierge Sidebar"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#131418] border border-[#22242A] flex items-center justify-center shadow-inner">
              <span className="text-emerald-400 font-serif font-bold text-sm tracking-wider">FC</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-wide">Sing Sing Beer &amp; Pizza</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                  Floor Command &amp; Voice Concierge
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                Location: <span className="text-zinc-200">Main St, Vancouver • Freehouse Collective</span>
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-5">
          {/* Key Floor Metrics */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center justify-center px-3.5 py-1 bg-[#131418] border border-[#22242A] rounded-md min-w-[70px]">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Occupancy</span>
              <span className="text-sm font-semibold text-emerald-400">{occupancyRate}%</span>
            </div>
            
            <div className="flex flex-col items-center justify-center px-3.5 py-1 bg-[#131418] border border-[#22242A] rounded-md min-w-[70px]">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Active</span>
              <span className="text-sm font-semibold">{activeCount} / {tables.length}</span>
            </div>

            {lockedCount > 0 && (
              <div className="flex flex-col items-center justify-center px-3.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md min-w-[70px] animate-pulse">
                <span className="text-[10px] text-amber-400 font-mono uppercase">Locked</span>
                <span className="text-sm font-semibold text-amber-300">{lockedCount}</span>
              </div>
            )}
          </div>
          
          {/* Call Status Pill in Header */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#131418] border border-[#22242A] rounded-full text-xs font-mono">
            <span className={cn(
              "w-2 h-2 rounded-full",
              callState === 'Live' ? "bg-emerald-400 animate-ping" : 
              callState === 'Connecting' ? "bg-amber-400 animate-pulse" : "bg-zinc-600"
            )} />
            <span className="text-zinc-400">
              {callState === 'Live' ? 'AI Call Active' : callState === 'Connecting' ? 'Connecting...' : 'AI Voice Standby'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={simulatePivotFlow}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#181920] hover:bg-[#20222A] text-amber-300 border border-amber-500/30 hover:border-amber-400/60 rounded-lg text-xs font-mono transition-colors"
              title="Test Green Light Rule: 8:00 PM Unavailable -> Pivot to 7:30 PM -> Green Light Verified -> Final Lock"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Test 8:00 PM (Pivot)</span>
            </button>
            <button 
              onClick={simulateDirectFlow}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#181920] hover:bg-[#20222A] text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/60 rounded-lg text-xs font-mono transition-colors"
              title="Test Direct Green Light: 7:00 PM Available -> Final Lock"
            >
              <CheckCircle size={13} className="text-emerald-400" />
              <span>Test 7:00 PM (Direct)</span>
            </button>
          </div>
        </div>
      </header>

      {/* SYSTEM WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT SIDEBAR: UNIFIED VOICE CONCIERGE & INCOMING RESERVATION STREAM */}
        <AnimatePresence>
          {leftDrawerOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-none h-full border-r border-[#22242A] bg-[#0E0F13] flex flex-col z-10 overflow-hidden shadow-2xl"
            >
              
              {/* TOP: LIVE VOICE CONCIERGE UNIT (PHASE 1) */}
              <div className="p-4 border-b border-[#22242A] bg-[#131418] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={14} className={callState === 'Live' ? "text-emerald-400 animate-pulse" : "text-zinc-500"} />
                    <h2 className="text-xs uppercase tracking-widest font-mono text-zinc-300 font-semibold">
                      Voice Concierge
                    </h2>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                    callState === 'Live' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                    callState === 'Connecting' ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                    "bg-[#1C1D24] text-zinc-500 border-[#22242A]"
                  )}>
                    {callState.toUpperCase()}
                  </span>
                </div>

                {/* Focused Single Venue Display */}
                <div className="flex items-center justify-between px-3 py-2 bg-[#0A0A0C] border border-[#22242A] rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-mono text-zinc-500">Active Location</span>
                    <span className="text-xs font-semibold text-zinc-200">Sing Sing Beer &amp; Pizza</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Main St • 2,400 sq ft
                  </span>
                </div>

                {/* Live Call Controller & Audio Waveform */}
                <div className="bg-[#0A0A0C] border border-[#22242A] rounded-lg p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Mini Pulsing Orb */}
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border",
                        callState === 'Live' ? "bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-950" :
                        callState === 'Connecting' ? "bg-amber-950/80 border-amber-500 text-amber-400 animate-pulse" :
                        "bg-[#181920] border-[#22242A] text-zinc-600"
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
                        <p className="text-xs font-medium text-zinc-200">
                          {callState === 'Live' ? 'Gemini 3.1 Multimodal Live' : 'Autonomous Voice Agent'}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-mono">
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
                            isMuted ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-[#181920] text-zinc-400 border-[#22242A] hover:text-white"
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
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 rounded-md text-xs font-medium transition-colors"
                        >
                          <PhoneOff size={13} />
                          <span>End Call</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Operational Status Text */}
                  <div className="text-[11px] font-mono text-zinc-400 bg-[#131418] border border-[#22242A] rounded p-2 flex items-start gap-2">
                    <Activity size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                    <p className="leading-tight line-clamp-2">{lastLiveMessage}</p>
                  </div>
                </div>

                {/* GREEN LIGHT AVAILABILITY FEED (MID-CALL AUDIT TRAIL) */}
                <div className="p-3 border-t border-[#22242A] bg-[#0C0D11] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <h3 className="text-[11px] uppercase tracking-wider font-mono text-zinc-300 font-semibold">
                        Green Light Rule Audits
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Mid-Call Verifier
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Must check availability before confirming table.
                  </p>

                  {recentChecks.length === 0 ? (
                    <div className="py-2 px-2.5 rounded bg-[#131418] border border-[#22242A] text-[10px] font-mono text-zinc-500 text-center">
                      Awaiting caller time inquiry...
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {recentChecks.map((c) => (
                        <div 
                          key={c.id} 
                          className={cn(
                            "p-2 rounded border text-[11px] font-mono flex flex-col gap-1 transition-all",
                            c.status === 'available' 
                              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                              : "bg-amber-950/20 border-amber-500/40 text-amber-300"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              Party of {c.partySize} @ {c.targetTime}
                            </span>
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold",
                              c.status === 'available' 
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" 
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            )}>
                              {c.status === 'available' ? 'GREEN LIGHT' : 'UNAVAILABLE'}
                            </span>
                          </div>

                          {c.status === 'unavailable' && c.alternatives && c.alternatives.length > 0 && (
                            <div className="text-[10px] text-amber-200/80 bg-amber-950/40 px-1.5 py-0.5 rounded">
                              Pivoted to alternatives: {c.alternatives.join(', ')}
                            </div>
                          )}
                          {c.status === 'available' && (
                            <div className="text-[10px] text-emerald-200/80">
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
                <div className="p-3 border-b border-[#22242A] bg-[#111216] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs uppercase tracking-widest font-mono text-zinc-400">
                      Floor Locks & Streams
                    </h3>
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      {incoming.filter(r => r.status === 'LOCKED').length}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">30s TTL Lock</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {incoming.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 p-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#131418] border border-[#22242A] flex items-center justify-center">
                        <Utensils size={18} className="opacity-40" />
                      </div>
                      <p className="text-xs font-mono text-zinc-400">No active reservation locks.</p>
                      <p className="text-[11px] text-zinc-600 max-w-[220px]">
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
                              isLocked ? "bg-[#16171D] border-amber-500/40" : 
                              req.status === 'SEATED' ? "bg-[#111613] border-emerald-500/30 opacity-70" :
                              "bg-[#131418] border-[#22242A]"
                            )}
                          >
                            {/* 30s Countdown progress bar */}
                            {isLocked && (
                              <div className="absolute top-0 left-0 w-full h-1 bg-[#22242A]">
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
                                  <h4 className="text-sm font-semibold text-zinc-100">{req.name}</h4>
                                  {req.source === 'VOICE_CALL' && (
                                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                                      VOICE
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                                  Party of {req.partySize} • {req.time} {req.phone ? `• 📞 ${req.phone}` : ''}
                                </p>
                              </div>

                              {isLocked && (
                                <div className="flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-mono">
                                  <Lock size={10} />
                                  <span>{secondsRemaining}s</span>
                                </div>
                              )}
                              
                              {req.status === 'SEATED' && (
                                <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                                  <CheckCircle size={10} />
                                  <span>SEATED</span>
                                </div>
                              )}

                              {req.status === 'EXPIRED' && (
                                <div className="bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                                  EXPIRED
                                </div>
                              )}
                            </div>

                            {/* Assigned table info */}
                            {req.lockedTableIds && req.lockedTableIds.length > 0 && (
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-zinc-500">Hold:</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded font-bold",
                                  req.lockedTableIds.length > 1 
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" 
                                    : "bg-zinc-800 text-zinc-200"
                                )}>
                                  {req.lockedTableIds.length > 1 ? `MERGED ${req.lockedTableIds.join(' + ')}` : `Table ${req.lockedTableIds[0]}`}
                                </span>
                              </div>
                            )}

                            {/* Tags */}
                            {req.tags && req.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {req.tags.map(tag => (
                                  <span key={tag} className="text-[10px] bg-[#22242A] text-zinc-400 px-2 py-0.5 rounded">
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
        <div className="flex-1 relative bg-[#0A0A0C] flex items-center justify-center overflow-hidden p-6" onClick={() => setSelectedTableId(null)}>
          <div className="w-full max-w-4xl aspect-[4/3] bg-[#131418] rounded-2xl border border-[#22242A] relative shadow-2xl overflow-hidden">
            
            {/* Grid Blueprint Texture */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none" 
              style={{ backgroundImage: 'radial-gradient(#2E323D 1px, transparent 1px)', backgroundSize: '24px 24px' }}
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
                  selectedTableId === table.id && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#131418] z-20 scale-105"
                )}
                style={{
                  left: `${table.x}%`,
                  top: `${table.y}%`,
                  width: `${table.w}%`,
                  height: `${table.h}%`,
                }}
              >
                <span className="font-mono text-sm font-bold tracking-tight">{table.label}</span>
                <span className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
                  <Users size={10} /> {table.capacity}
                </span>
                
                {/* Active Dining Timer */}
                {table.stage !== 'AVAILABLE' && table.stage !== 'LOCKED' && (
                  <div className="absolute -bottom-2 -right-2 bg-[#0A0A0C] border border-[#22242A] text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xl whitespace-nowrap">
                    {formatTime(table.timeElapsed || 0)}
                  </div>
                )}
                
                {/* Occupant Badge */}
                {table.occupantName && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#22242A] border border-zinc-700 text-zinc-100 text-[9px] font-medium px-2 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis max-w-[90%] shadow">
                    {table.occupantName.split(' ')[0]}
                  </div>
                )}

                {/* Locked Indicator on Canvas */}
                {table.stage === 'LOCKED' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-[#0A0A0C] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow animate-pulse">
                    <Lock size={9} />
                    LOCKED
                  </div>
                )}
              </motion.div>
            ))}

            {/* Architectural Spatial Labels */}
            <div className="absolute bottom-4 left-4 text-zinc-600 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block animate-pulse"></span> Host Stand / Main Entrance
            </div>
            <div className="absolute top-4 right-4 text-zinc-600 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
              <Utensils size={14} /> Kitchen &amp; Expediter
            </div>
            <div className="absolute top-4 left-6 text-zinc-600 font-mono text-xs uppercase tracking-widest">
              Booth Row
            </div>
            <div className="absolute bottom-4 right-6 text-zinc-600 font-mono text-xs uppercase tracking-widest">
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
              className="flex-none h-full border-l border-[#22242A] bg-[#0A0A0C] flex flex-col z-10 shadow-xl"
            >
              <div className="flex border-b border-[#22242A] bg-[#131418]">
                <button 
                  onClick={() => setRightTab('turnover')}
                  className={cn(
                    "flex-1 p-3 text-xs uppercase tracking-widest font-mono text-center transition-colors border-b-2",
                    rightTab === 'turnover' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Turnover ({pipelineTables.length})
                </button>
                <button 
                  onClick={() => setRightTab('waitlist')}
                  className={cn(
                    "flex-1 p-3 text-xs uppercase tracking-widest font-mono text-center transition-colors border-b-2 flex items-center justify-center gap-2",
                    rightTab === 'waitlist' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Waitlist
                  {waitlist.length > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {waitlist.length}
                    </span>
                  )}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {rightTab === 'turnover' && (
                  <div className="space-y-3">
                    {pipelineTables.length === 0 ? (
                      <div className="text-center text-zinc-500 mt-12 font-mono text-xs">
                        No tables currently in turnover stages.
                      </div>
                    ) : (
                      pipelineTables.sort((a,b) => (b.timeElapsed||0) - (a.timeElapsed||0)).map(t => (
                        <div 
                          key={t.id} 
                          onClick={() => setSelectedTableId(t.id)}
                          className="bg-[#131418] border border-[#22242A] hover:border-zinc-500 p-3 rounded-lg flex justify-between items-center cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{t.label} <span className="text-zinc-500 text-xs ml-2">({t.occupantName || 'Guest'})</span></p>
                            <p className={cn(
                              "text-[10px] font-mono mt-1",
                              t.stage === 'BUSSING_NEEDED' ? 'text-red-400' : 
                              t.stage === 'CHECK_DROPPED' ? 'text-pink-400' : 'text-purple-400'
                            )}>
                              {t.stage.replace('_', ' ')}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-zinc-400">{formatTime(t.timeElapsed || 0)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {rightTab === 'waitlist' && (
                  <div className="space-y-3">
                    {waitlist.length === 0 ? (
                      <div className="text-center text-zinc-500 mt-12 font-mono text-xs">
                        Waitlist is clear.
                      </div>
                    ) : (
                      waitlist.map(req => (
                        <div key={req.id} className="bg-[#131418] border border-[#22242A] p-3 rounded-lg flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-sm font-medium text-zinc-100">{req.name}</h3>
                              <p className="text-xs text-zinc-500 font-mono">Party of {req.partySize}</p>
                            </div>
                            <span className="text-[10px] text-zinc-500">{req.time}</span>
                          </div>
                          <button 
                            onClick={() => {
                              setWaitlist(prev => prev.filter(r => r.id !== req.id));
                              handleNewReservation({ ...req, status: 'PENDING' });
                            }}
                            className="w-full py-1.5 border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 text-xs rounded transition-colors"
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
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#131418] border border-[#22242A] shadow-2xl rounded-2xl overflow-hidden z-30"
            >
              <div className={cn("h-1.5 w-full", getStageColor(selectedTable.stage).split(' ')[0].replace('border', 'bg'))} />
              <div className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">{selectedTable.label}</h2>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#22242A] text-zinc-400">
                        {selectedTable.type} • {selectedTable.capacity} Guests
                      </span>
                      <span className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded",
                        selectedTable.stage === 'AVAILABLE' ? "bg-zinc-800 text-zinc-400" :
                        selectedTable.stage === 'LOCKED' ? "bg-amber-500/20 text-amber-300" :
                        "bg-emerald-500/20 text-emerald-400"
                      )}>
                        {selectedTable.stage.replace('_', ' ')}
                      </span>
                    </div>
                    {selectedTable.occupantName ? (
                      <p className="text-sm text-zinc-300 mt-1">
                        Occupant: <span className="text-white font-medium">{selectedTable.occupantName}</span> ({formatTime(selectedTable.timeElapsed || 0)})
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-500 mt-1">Currently unoccupied</p>
                    )}
                  </div>
                  <button onClick={() => setSelectedTableId(null)} className="p-1 hover:bg-[#22242A] rounded-md text-zinc-400">
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
                    className="px-3 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-xs rounded transition-colors flex justify-center items-center"
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
    </div>
  );
}
