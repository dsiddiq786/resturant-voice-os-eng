'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Activity, AlertCircle, Gauge, Timer, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOwnerConfig } from '@/lib/ownerConfigContext';

export interface ClientTtfaRecord {
  turn: number;
  seconds: number;
  formatted: string;
  ms: number;
  type: 'greeting' | 'user_turn';
}

export default function LiveAudioClient() {
  const { ownerConfig, selectedVoice } = useOwnerConfig();
  const [callState, setCallState] = useState<'Disconnected' | 'Connecting' | 'Live' | 'Processing'>('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [latency, setLatency] = useState<string>('~85ms (Ultra Low Latency)');
  const venue = ownerConfig.venue || `${ownerConfig.restaurant_name} Main St`;
  const [micError, setMicError] = useState<string | null>(null);

  // TTFA (Time to First Audio) Telemetry State
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'speaking' | 'awaiting_audio' | 'agent_speaking'>('idle');
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [latestTtfa, setLatestTtfa] = useState<ClientTtfaRecord | null>(null);
  const [ttfaHistory, setTtfaHistory] = useState<ClientTtfaRecord[]>([]);

  const averageTtfa = ttfaHistory.length > 0 
    ? (ttfaHistory.reduce((acc, t) => acc + t.seconds, 0) / ttfaHistory.length) 
    : null;

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // TTFA Timing Refs
  const speechStopTimestampRef = useRef<number>(0);
  const waitingForFirstAudioRef = useRef<boolean>(false);
  const callConnectTimeRef = useRef<number>(0);
  const waitingForGreetingRef = useRef<boolean>(false);
  const turnCounterRef = useRef<number>(1);
  const isUserSpeakingRef = useRef<boolean>(false);
  const speechFramesRef = useRef<number>(0);
  const silenceFramesRef = useRef<number>(0);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
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
      console.error("Error playing audio chunk", e);
    }
  };

  const startCall = async () => {
    if (callState !== 'Disconnected') return;
    setMicError(null);
    setCallState('Connecting');
    setExtractedData(null);
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
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live?venue=${encodeURIComponent(venue)}&voice=${encodeURIComponent(ownerConfig.voice_name || selectedVoice.name)}`;
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
      // Low latency buffer: 2048 samples (128ms)
      const processor = inputAudioCtx.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isMuted) {
          const inputData = e.inputBuffer.getChannelData(0);

          // Energy computation for Voice Activity Detection
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
              if (silenceFramesRef.current >= 3) {
                isUserSpeakingRef.current = false;
                speechFramesRef.current = 0;
                silenceFramesRef.current = 0;

                const stopTime = Date.now();
                speechStopTimestampRef.current = stopTime;
                waitingForFirstAudioRef.current = true;
                setSpeechStatus('awaiting_audio');
                setLiveElapsedSeconds(0);

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
            if (waitingForGreetingRef.current && callConnectTimeRef.current > 0) {
              const elapsedMs = Math.round(Date.now() - callConnectTimeRef.current);
              const elapsedSec = (elapsedMs / 1000).toFixed(2);
              waitingForGreetingRef.current = false;
              callConnectTimeRef.current = 0;
              if (elapsedTimerRef.current) {
                clearInterval(elapsedTimerRef.current);
                elapsedTimerRef.current = null;
              }
              const rec: ClientTtfaRecord = {
                turn: 0,
                seconds: parseFloat(elapsedSec),
                formatted: `${elapsedSec}s`,
                ms: elapsedMs,
                type: 'greeting'
              };
              setLatestTtfa(rec);
              setTtfaHistory(prev => [rec, ...prev]);
              setLatency(`TTFA: ${elapsedSec}s (Greeting)`);
              setSpeechStatus('agent_speaking');
            } else if (waitingForFirstAudioRef.current && speechStopTimestampRef.current > 0) {
              const elapsedMs = Math.round(Date.now() - speechStopTimestampRef.current);
              const elapsedSec = (elapsedMs / 1000).toFixed(2);
              waitingForFirstAudioRef.current = false;
              speechStopTimestampRef.current = 0;
              if (elapsedTimerRef.current) {
                clearInterval(elapsedTimerRef.current);
                elapsedTimerRef.current = null;
              }
              const rec: ClientTtfaRecord = {
                turn: turnCounterRef.current++,
                seconds: parseFloat(elapsedSec),
                formatted: `${elapsedSec}s`,
                ms: elapsedMs,
                type: 'user_turn'
              };
              setLatestTtfa(rec);
              setTtfaHistory(prev => [rec, ...prev.slice(0, 9)]);
              setLatency(`TTFA: ${elapsedSec}s (Turn #${rec.turn})`);
              setSpeechStatus('agent_speaking');
            }

            playAudioChunk(outputAudioCtx, msg.audio);
          }
          if (msg.turnComplete) {
            setSpeechStatus('idle');
          }
          if (msg.interrupted) {
            activeSourcesRef.current.forEach(s => {
              try { s.stop(); } catch (e) {}
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
        } catch (e) {
          console.error("Error handling ws message", e);
        }
      };

      ws.onclose = () => {
        endCall();
      };
      
    } catch (err: any) {
      console.warn("Microphone access denied or websocket error", err);
      setCallState('Disconnected');
      const isPermissionDenied = err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied') || err?.name === 'PermissionDeniedError';
      const msg = isPermissionDenied 
        ? 'Microphone permission was denied. Please allow microphone access in your browser or iframe permissions to enable live voice streaming.'
        : (err?.message || 'Unable to access microphone or establish WebSocket audio stream.');
      setMicError(msg);
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
      try {
        wsRef.current.send(JSON.stringify({ end: true }));
        wsRef.current.close();
      } catch (e) {}
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
    <div className="flex h-screen w-full bg-[#F3F8F7] text-slate-800 overflow-hidden font-sans">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full border-r border-[#DCE8E4]">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#DCE8E4] bg-[#F3F8F7]/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#0F766E] to-[#0F766E] flex items-center justify-center text-slate-900 font-bold text-xs">
              LP
            </div>
            <h1 className="font-semibold tracking-wide text-slate-800">{ownerConfig.restaurant_name} Live Concierge</h1>
          </div>
          <div>
            <span className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-md px-3 py-1.5 text-xs font-sans text-slate-700">
              {venue}
            </span>
          </div>
        </header>

        {/* Center Hero */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
          <div className="absolute top-6 right-6 flex items-center gap-2 text-xs font-sans text-slate-500 bg-[#FFFFFF] px-3 py-1 rounded-full border border-[#DCE8E4]">
            <Activity className="w-3 h-3 text-emerald-500" />
            <span>{callState === 'Live' ? latency : 'Voice Gateway Ready'}</span>
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
                callState === 'Live' ? "from-emerald-900 to-[#F4F9F7] shadow-emerald-900/20" : 
                callState === 'Connecting' ? "from-amber-900 to-[#F4F9F7] shadow-amber-900/20" : "from-zinc-800 to-[#F4F9F7]"
              )}>
                {callState === 'Disconnected' && (
                  <PhoneOff className="w-12 h-12 text-slate-500" />
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

          {/* TTFA Latency Gauge Strip */}
          {callState === 'Live' && (
            <div className="mb-6 flex flex-col items-center gap-2 bg-[#FFFFFF]/90 border border-[#DCE8E4] rounded-xl px-5 py-3 shadow-lg max-w-sm w-full">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Gauge size={14} className="text-cyan-700" />
                  <span className="text-[11px] uppercase tracking-wider font-sans text-slate-700 font-semibold">
                    Turn Latency (TTFA)
                  </span>
                </div>
                {speechStatus === 'awaiting_audio' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-amber-500/20 text-amber-700 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                    <Timer size={10} className="animate-spin" />
                    <span>Measuring: {liveElapsedSeconds.toFixed(2)}s</span>
                  </span>
                ) : speechStatus === 'speaking' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-cyan-500/20 text-cyan-700 border border-cyan-500/40 flex items-center gap-1">
                    <Mic size={10} />
                    <span>Caller Speaking...</span>
                  </span>
                ) : speechStatus === 'agent_speaking' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-emerald-500/20 text-emerald-700 border border-emerald-500/40 flex items-center gap-1">
                    <Volume2 size={10} />
                    <span>Agent Responding</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-slate-100 text-slate-600 border border-slate-200">
                    Listening
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between w-full pt-1 border-t border-[#DCE8E4]">
                <div className="flex flex-col">
                  <span className="text-[9px] font-sans text-slate-500 uppercase">Last Turn</span>
                  <span className={cn(
                    "text-sm font-bold font-sans",
                    speechStatus === 'awaiting_audio' ? "text-amber-700 animate-pulse" : latestTtfa ? "text-emerald-700" : "text-slate-500"
                  )}>
                    {speechStatus === 'awaiting_audio' 
                      ? `${liveElapsedSeconds.toFixed(2)}s` 
                      : latestTtfa ? `${latestTtfa.seconds.toFixed(2)}s (${latestTtfa.ms}ms)` : '--'}
                  </span>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-sans text-slate-500 uppercase">Session Average</span>
                  <span className="text-sm font-bold font-sans text-cyan-700">
                    {averageTtfa ? `${averageTtfa.toFixed(2)}s` : '--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-[#FFFFFF] border border-[#DCE8E4] p-2 rounded-full flex items-center gap-2 shadow-xl shrink-0">
            {callState === 'Disconnected' ? (
              <button 
                onClick={startCall}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-full font-medium transition-colors"
              >
                <Phone className="w-4 h-4 fill-current" />
                Start Live Voice Call
              </button>
            ) : (
              <>
                <button 
                  onClick={toggleMute}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                    isMuted ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30" : "bg-[#F3F8F7] hover:bg-[#F3F8F7] text-slate-700"
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

          {micError && (
            <div className="mt-4 max-w-md bg-amber-100/30 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2.5 text-xs font-sans text-amber-700">
              <AlertCircle size={15} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-bold block text-amber-700">Microphone Notice:</span>
                {micError}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Right Drawer (JSON Extraction) */}
      <aside className="w-96 flex flex-col bg-[#F3F8F7] shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-[#DCE8E4] bg-[#F3F8F7]/50 backdrop-blur-md">
          <h2 className="font-medium text-sm text-slate-600 tracking-wide uppercase font-sans">Real-time Call Payload</h2>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg p-4 h-full overflow-y-auto font-sans text-xs text-slate-700 shadow-inner">
            {extractedData ? (
              <pre className="whitespace-pre-wrap break-words">
                <span className="text-pink-400">const</span> <span className="text-blue-700">orderPayload</span> = {JSON.stringify(extractedData, null, 2)}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                <Activity className="w-8 h-8 opacity-20" />
                <p>Waiting for agent tool emission...</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
