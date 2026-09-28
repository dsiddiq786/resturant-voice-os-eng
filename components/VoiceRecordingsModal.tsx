'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Phone, Play, Pause, Clock, User, CheckCircle2, 
  Calendar, FileText, Database, X, RefreshCw, 
  Volume2, Shield, ArrowUpRight, Search, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecording {
  id: string;
  caller_name: string;
  caller_phone: string;
  venue: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  status: string;
  intent: 'reservation' | 'takeout' | 'inquiry';
  transcript: Array<{ role: string; text: string; timestamp?: string }>;
  audio_data?: string | null;
  tool_calls: Array<{ name: string; args?: any; result?: any; timestamp?: string }>;
  reservation_summary?: string;
  order_summary?: string;
  created_at: string;
}

interface VoiceRecordingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  venueName: string;
}

export default function VoiceRecordingsModal({ isOpen, onClose, venueName }: VoiceRecordingsModalProps) {
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<VoiceRecording | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [filterIntent, setFilterIntent] = useState<'all' | 'reservation' | 'takeout' | 'inquiry'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/db/calls');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.calls)) {
          setRecordings(data.calls);
          setSelectedCall(prev => prev || (data.calls.length > 0 ? data.calls[0] : null));
        }
      }
    } catch (err) {
      console.warn('Error loading recordings from SQLite', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    fetch('/api/db/calls')
      .then(res => res.json())
      .then(data => {
        if (active && data.success && Array.isArray(data.calls)) {
          setRecordings(data.calls);
          setSelectedCall(prev => prev || (data.calls.length > 0 ? data.calls[0] : null));
        }
      })
      .catch(err => {
        console.warn('Error loading recordings from SQLite', err);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  // Audio Playback Simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlayProgress(prev => {
        if (prev >= 100) {
          setIsPlaying(null);
          return 0;
        }
        return prev + 5;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!isOpen) return null;

  const filteredRecordings = recordings.filter(rec => {
    const matchesIntent = filterIntent === 'all' || rec.intent === filterIntent;
    const matchesSearch = 
      rec.caller_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.caller_phone && rec.caller_phone.includes(searchQuery)) ||
      (rec.reservation_summary && rec.reservation_summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rec.order_summary && rec.order_summary.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesIntent && matchesSearch;
  });

  const togglePlayback = (id: string) => {
    if (isPlaying === id) {
      setIsPlaying(null);
    } else {
      setIsPlaying(id);
      setPlayProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-6xl h-[85vh] bg-[#FFFFFF] border border-[#DCE8E4] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Top Header */}
        <div className="h-16 px-6 border-b border-[#DCE8E4] bg-[#FFFFFF] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 shadow-sm">
              <Database size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 font-sans">
                  SQLite Voice Call Vault &amp; Audit Logs
                </h2>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 border border-emerald-500/40">
                  node:sqlite Live
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-sans">
                Persistent storage of inbound voice calls, audio streams, tool payloads, and verified transcripts for {venueName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchRecordings}
              disabled={loading}
              className="p-2 rounded-lg bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-slate-200 text-slate-700 transition-colors"
              title="Refresh from SQLite"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter and Stats Subheader */}
        <div className="px-6 py-3 border-b border-[#DCE8E4] bg-[#FFFFFF] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search caller, phone, order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#F3F8F7] border border-slate-200 rounded-lg text-xs font-sans text-slate-800 outline-none focus:border-[#0F766E] w-64"
              />
            </div>

            <div className="flex items-center bg-[#F3F8F7] p-1 rounded-lg border border-slate-200 text-xs font-sans">
              <button
                onClick={() => setFilterIntent('all')}
                className={cn("px-2.5 py-1 rounded transition-colors", filterIntent === 'all' ? "bg-[#F3F8F7] text-slate-900" : "text-slate-600 hover:text-slate-800")}
              >
                All ({recordings.length})
              </button>
              <button
                onClick={() => setFilterIntent('reservation')}
                className={cn("px-2.5 py-1 rounded transition-colors", filterIntent === 'reservation' ? "bg-[#F3F8F7] text-slate-900" : "text-slate-600 hover:text-slate-800")}
              >
                Reservations
              </button>
              <button
                onClick={() => setFilterIntent('takeout')}
                className={cn("px-2.5 py-1 rounded transition-colors", filterIntent === 'takeout' ? "bg-[#F3F8F7] text-slate-900" : "text-slate-600 hover:text-slate-800")}
              >
                Takeout Orders
              </button>
              <button
                onClick={() => setFilterIntent('inquiry')}
                className={cn("px-2.5 py-1 rounded transition-colors", filterIntent === 'inquiry' ? "bg-[#F3F8F7] text-slate-900" : "text-slate-600 hover:text-slate-800")}
              >
                Inquiries
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-sans text-slate-600">
            <span>Total Calls: <strong className="text-slate-900">{recordings.length}</strong></span>
            <span>Venue: <strong className="text-[#0F766E]">{venueName}</strong></span>
          </div>
        </div>

        {/* Content Body: Left Call List + Right Call Detail */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: List of calls */}
          <div className="w-80 border-r border-[#DCE8E4] overflow-y-auto p-3 space-y-2 shrink-0 bg-[#FFFFFF]">
            {loading ? (
              <div className="p-8 text-center text-xs font-sans text-slate-500">
                <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[#0F766E]" />
                Loading SQLite recordings...
              </div>
            ) : filteredRecordings.length === 0 ? (
              <div className="p-8 text-center text-xs font-sans text-slate-500">
                No recorded calls match filter
              </div>
            ) : (
              filteredRecordings.map((call) => {
                const isSelected = selectedCall?.id === call.id;
                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer font-sans text-xs relative",
                      isSelected
                        ? "bg-[#F3F8F7] border-[#0F766E]/50 shadow-sm"
                        : "bg-[#FFFFFF] border-slate-200 hover:border-slate-200 text-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[130px]">
                        {call.caller_name}
                      </span>
                      <span className={cn(
                        "text-[9px] uppercase px-1.5 py-0.5 rounded font-bold",
                        call.intent === 'reservation' ? "bg-emerald-500/20 text-emerald-700" :
                        call.intent === 'takeout' ? "bg-orange-500/20 text-orange-700" :
                        "bg-blue-500/20 text-blue-700"
                      )}>
                        {call.intent}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 truncate mb-1.5">
                      {call.caller_phone || 'Private Caller ID'}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/80">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {call.duration_seconds}s
                      </span>
                      <span>
                        {new Date(call.created_at || call.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Active Call Details */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FFFFFF]">
            {selectedCall ? (
              <div className="space-y-6 max-w-3xl">
                {/* Call Header Card */}
                <div className="p-5 rounded-xl bg-[#FFFFFF] border border-[#DCE8E4] flex flex-col gap-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 font-sans">
                          {selectedCall.caller_name}
                        </h3>
                        <span className="text-xs font-sans text-slate-600">
                          ({selectedCall.caller_phone})
                        </span>
                      </div>
                      <div className="text-xs font-sans text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{selectedCall.venue}</span>
                        <span>•</span>
                        <span>{new Date(selectedCall.start_time).toLocaleString()}</span>
                        <span>•</span>
                        <span>Duration: {selectedCall.duration_seconds}s</span>
                      </div>
                    </div>

                    {/* Audio Playback Controller */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePlayback(selectedCall.id)}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-semibold transition-all shadow-md"
                      >
                        {isPlaying === selectedCall.id ? <Pause size={14} /> : <Play size={14} />}
                        <span>{isPlaying === selectedCall.id ? 'Pause Audio' : 'Play Voice Recording'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Audio Waveform Scrubber Simulation */}
                  <div className="bg-[#FFFFFF] p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-sans text-slate-600">
                      <span className="flex items-center gap-1">
                        <Volume2 size={12} className={isPlaying === selectedCall.id ? "text-emerald-700" : "text-slate-500"} />
                        <span>PCM 24kHz Direct Voice Audio Track</span>
                      </span>
                      <span>{isPlaying === selectedCall.id ? `${playProgress}%` : '0:00 / 0:' + selectedCall.duration_seconds}</span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${playProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Summaries & Outcome */}
                {(selectedCall.reservation_summary || selectedCall.order_summary) && (
                  <div className="p-4 rounded-xl bg-emerald-100/20 border border-emerald-500/30 text-xs font-sans space-y-1.5 text-emerald-700">
                    <div className="flex items-center gap-2 font-bold text-emerald-700">
                      <CheckCircle2 size={15} />
                      <span>Executed Business Outcome</span>
                    </div>
                    {selectedCall.reservation_summary && (
                      <p className="text-slate-800">{selectedCall.reservation_summary}</p>
                    )}
                    {selectedCall.order_summary && (
                      <p className="text-slate-800">{selectedCall.order_summary}</p>
                    )}
                  </div>
                )}

                {/* Tool Calls Executed by Gemini Live */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-sans font-bold uppercase text-slate-600 tracking-wider flex items-center gap-2">
                      <Shield size={14} className="text-[#0F766E]" />
                      <span>Gemini 3.1 Function Calls Executed ({selectedCall.tool_calls.length})</span>
                    </h4>
                  </div>

                  {selectedCall.tool_calls.length === 0 ? (
                    <div className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 text-xs font-sans text-slate-500">
                      General inquiry - no structured tools required.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedCall.tool_calls.map((tc, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 font-sans text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="font-bold text-[#0F766E]">{tc.name}</span>
                            <span className="text-[10px] text-slate-500">{tc.timestamp || 'Call event'}</span>
                          </div>
                          <pre className="text-[11px] text-slate-600 bg-[#FFFFFF] p-2 rounded border border-zinc-850 overflow-x-auto">
                            {JSON.stringify(tc.args || tc, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Complete Transcript Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-sans font-bold uppercase text-slate-600 tracking-wider flex items-center gap-2">
                    <FileText size={14} className="text-slate-700" />
                    <span>Conversation Transcript Timeline</span>
                  </h4>

                  <div className="space-y-2.5 font-sans text-xs">
                    {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                      selectedCall.transcript.map((msg, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "p-3 rounded-xl border flex flex-col gap-1",
                            msg.role === 'agent' 
                              ? "bg-[#FFFFFF] border-slate-200 text-slate-800"
                              : "bg-[#F3F8F7] border-[#0F766E]/30 text-amber-700 ml-6"
                          )}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-bold uppercase tracking-wider">
                              {msg.role === 'agent' ? `Virtual Host (${venueName})` : selectedCall.caller_name}
                            </span>
                            {msg.timestamp && <span>{msg.timestamp}</span>}
                          </div>
                          <p className="leading-relaxed">{msg.text}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 rounded-lg bg-[#FFFFFF] border border-slate-200 text-slate-500">
                        No text transcript recorded.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 font-sans text-xs space-y-2">
                <Database size={28} className="opacity-30" />
                <p>Select a call from the vault to inspect transcript, audio, and tools</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
