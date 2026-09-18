'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LiveAudioClient() {
  const [callState, setCallState] = useState<'Disconnected' | 'Connecting' | 'Live' | 'Processing'>('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [latency, setLatency] = useState<string>('< 120ms');
  const [venue, setVenue] = useState('Lamplighter (Gastown)');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Helper to convert Float32Array to Base64 PCM 16kHz
  const pcmToBase64 = (f32Array: Float32Array) => {
    const pcm = new Int16Array(f32Array.length);
    for (let i = 0; i < f32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, f32Array[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const buffer = new ArrayBuffer(pcm.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(i * 2, pcm[i], true); // little endian
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Helper to play audio chunk (Base64 PCM 24kHz)
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
      // If we've fallen behind, catch up to current time
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
      console.error("Error playing audio chunk", e);
    }
  };

  const startCall = async () => {
    if (callState !== 'Disconnected') return;
    setCallState('Connecting');
    setExtractedData(null);
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
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live?venue=${encodeURIComponent(venue)}`;
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
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.audio) {
          playAudioChunk(outputAudioCtx, msg.audio);
        }
        if (msg.interrupted) {
          activeSourcesRef.current.forEach(source => {
            try {
              source.stop();
            } catch (e) {
              // Ignore if already stopped
            }
          });
          activeSourcesRef.current = [];
          nextPlayTimeRef.current = outputAudioCtx.currentTime;
        }
        if (msg.functionCall) {
          setExtractedData(msg.functionCall.arguments);
        }
        if (msg.status === 'disconnected') {
          endCall();
        }
      };

      ws.onclose = () => {
        endCall();
      };
      
    } catch (err) {
      console.error("Microphone access denied or websocket error", err);
      setCallState('Disconnected');
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
      wsRef.current.send(JSON.stringify({ end: true }));
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

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#0A0A0C] text-zinc-100 overflow-hidden font-sans">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full border-r border-[#22242A]">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#22242A] bg-[#0A0A0C]/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <span className="font-bold text-sm">FC</span>
            </div>
            <h1 className="font-semibold tracking-wide text-zinc-100">Freehouse Collective</h1>
          </div>
          <div>
            <select 
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="bg-[#131418] border border-[#22242A] rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-300"
            >
              <option value="Lamplighter (Gastown)">Lamplighter (Gastown)</option>
              <option value="Clough Club">Clough Club</option>
              <option value="Sing Sing (Main St)">Sing Sing (Main St)</option>
            </select>
          </div>
        </header>

        {/* Center Hero */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
          <div className="absolute top-6 right-6 flex items-center gap-2 text-xs font-mono text-zinc-500 bg-[#131418] px-3 py-1 rounded-full border border-[#22242A]">
            <Activity className="w-3 h-3 text-emerald-500" />
            <span>{callState === 'Live' ? latency : '--'}</span>
          </div>

          <div className="flex-1 flex items-center justify-center w-full">
            {/* Orb/Waveform representation */}
            <div className="relative flex items-center justify-center">
              <div className={cn(
                "absolute inset-0 rounded-full blur-3xl opacity-20 transition-all duration-1000",
                callState === 'Live' ? "bg-emerald-500 scale-150" : 
                callState === 'Connecting' ? "bg-amber-500 animate-pulse scale-110" : "bg-zinc-600 scale-100"
              )} />
              <div className={cn(
                "relative z-10 w-48 h-48 rounded-full bg-gradient-to-br border border-white/10 flex items-center justify-center shadow-2xl transition-all duration-700",
                callState === 'Live' ? "from-emerald-900 to-[#131418] shadow-emerald-900/20" : 
                callState === 'Connecting' ? "from-amber-900 to-[#131418] shadow-amber-900/20" : "from-zinc-800 to-[#131418]"
              )}>
                {callState === 'Disconnected' && (
                  <PhoneOff className="w-12 h-12 text-zinc-600" />
                )}
                {callState === 'Connecting' && (
                  <Activity className="w-12 h-12 text-amber-500/70 animate-pulse" />
                )}
                {callState === 'Live' && (
                  <div className="flex gap-1 items-center justify-center h-12">
                    {[35, 80, 50, 100, 60].map((heightPct, i) => (
                      <div 
                        key={i} 
                        className="w-2 bg-emerald-400 rounded-full animate-pulse"
                        style={{ 
                          height: `${heightPct}%`,
                          animationDelay: `${i * 0.15}s`,
                          animationDuration: '0.8s'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-[#131418] border border-[#22242A] p-2 rounded-full flex items-center gap-2 shadow-xl shrink-0">
            {callState === 'Disconnected' ? (
              <button 
                onClick={startCall}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-full font-medium transition-colors"
              >
                <Phone className="w-4 h-4 fill-current" />
                Start Call
              </button>
            ) : (
              <>
                <button 
                  onClick={toggleMute}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                    isMuted ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30" : "bg-[#22242A] hover:bg-[#2A2D35] text-zinc-300"
                  )}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button 
                  onClick={endCall}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 px-6 py-3 rounded-full font-medium transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </button>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Right Drawer (JSON Extraction) */}
      <aside className="w-96 flex flex-col bg-[#0A0A0C] shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-[#22242A] bg-[#0A0A0C]/50 backdrop-blur-md">
          <h2 className="font-medium text-sm text-zinc-400 tracking-wide uppercase">Live Extraction</h2>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-[#131418] border border-[#22242A] rounded-lg p-4 h-full overflow-y-auto font-mono text-xs text-zinc-300 shadow-inner">
            {extractedData ? (
              <pre className="whitespace-pre-wrap break-words">
                <span className="text-pink-400">const</span> <span className="text-blue-400">reservationData</span> = {JSON.stringify(extractedData, null, 2)}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4">
                <Activity className="w-8 h-8 opacity-20" />
                <p>Waiting for agent handoff...</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
