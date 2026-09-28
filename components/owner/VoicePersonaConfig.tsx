'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Bot, Mic, Volume2, Sparkles, ShieldCheck, ChevronDown, 
  Play, Square, Check, RefreshCw, Sliders, Info, Zap
} from 'lucide-react';
import { useOwnerConfig, GEMINI_LIVE_VOICES, VoiceOption } from '@/lib/ownerConfigContext';
import { cn } from '@/lib/utils';

export default function VoicePersonaConfig() {
  const { 
    ownerConfig, 
    updateOwnerConfig, 
    selectedVoice, 
    setSelectedVoice, 
    compiledPrompt 
  } = useOwnerConfig();

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [showPromptInspector, setShowPromptInspector] = useState(false);

  // Tone presets
  const TONE_OPTIONS = [
    {
      id: 'Lively & Casual',
      name: 'Lively & Casual',
      desc: 'Brisk, upbeat, casual Gastown gastropub cadence with natural conversational fillers.',
      badge: 'Recommended for Taprooms'
    },
    {
      id: 'High-End Professional',
      name: 'High-End Professional',
      desc: 'Refined, articulate, polished sommelier and fine-dining floor host tone.',
      badge: 'Fine Dining'
    },
    {
      id: 'Warm & Friendly',
      name: 'Warm & Friendly',
      desc: 'Welcoming, relaxed, neighborly hospitality tone with empathetic Canadian warmth.',
      badge: 'Bistro & Family'
    }
  ];

  // Synthesize sample voice playback using Web Speech / Web Audio
  const playSampleAudio = (voice: VoiceOption) => {
    if (typeof window === 'undefined') return;

    if (playingVoiceId === voice.id) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setPlayingVoiceId(null);
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voice.previewPhrase);
      utterance.rate = voice.id === 'Puck' ? 1.05 : voice.id === 'Fenrir' ? 0.95 : 1.0;
      utterance.pitch = voice.gender === 'Female' ? 1.15 : 0.88;

      // Try to find matching voice
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find(v => 
        (voice.gender === 'Female' ? (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria')) : (v.name.includes('Male') || v.name.includes('Alex') || v.name.includes('Daniel')))
      );
      if (matched) utterance.voice = matched;

      utterance.onend = () => setPlayingVoiceId(null);
      utterance.onerror = () => setPlayingVoiceId(null);

      setPlayingVoiceId(voice.id);
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback web audio beep wave
      setPlayingVoiceId(voice.id);
      setTimeout(() => setPlayingVoiceId(null), 2500);
    }
  };

  const handleResetGreeting = () => {
    const defaultGreeting = `Thanks for calling ${ownerConfig.restaurant_name || 'leed pizza'}, this is your virtual host, how can I help you today?`;
    updateOwnerConfig({ greeting: defaultGreeting });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header Description */}
      <div className="border-b border-[#DCE8E4] pb-5">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-8 h-8 rounded-lg bg-[#0F766E]/10 border border-[#0F766E]/30 flex items-center justify-center text-[#0F766E]">
            <Bot size={18} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">AI Voice &amp; Behavior Engine</h2>
          <span className="text-[11px] font-sans uppercase bg-[#F3F8F7] text-[#0F766E] px-2.5 py-0.5 rounded border border-[#0F766E]/20 ml-2">
            Persona Module 1
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Configure how your Gemini Live voice concierge introduces itself to guests, its vocal timbre, and conversation tone. System rules remain immutable.
        </p>
      </div>

      {/* SECTION 1: GEMINI LIVE VOICE SELECTION */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE8E4] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Mic size={16} className="text-[#0F766E]" />
              <h3 className="text-base font-semibold text-slate-900">Voice Model Selection</h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Select the low-latency Gemini Live neural voice model used on incoming phone calls and live audio streams.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-sans text-slate-600">Active:</span>
            <span className="text-xs font-sans font-semibold text-[#0F766E] bg-[#F3F8F7] border border-[#0F766E]/30 px-2.5 py-1 rounded">
              {selectedVoice.label}
            </span>
          </div>
        </div>

        {/* Voice Grid (Male & Female Equivalents) */}
        <div role="radiogroup" aria-label="Voice model" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {GEMINI_LIVE_VOICES.map((v) => {
            const isSelected = selectedVoice.id === v.id;
            const isPlaying = playingVoiceId === v.id;

            return (
              <div
                key={v.id}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${v.name}, ${v.tone}`}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setSelectedVoice(v);
                  }
                }}
                onClick={() => setSelectedVoice(v)}
                className={cn(
                  "relative p-4 rounded-lg border transition-all cursor-pointer select-none text-left group flex flex-col justify-between",
                  isSelected
                    ? "bg-[#F3F8F7] border-[#0F766E] shadow-sm ring-1 ring-[#0F766E]/50"
                    : "bg-[#FFFFFF] border-[#DCE8E4] hover:border-slate-200 hover:bg-[#FFFFFF]"
                )}
              >
                {/* Header row inside card */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        isSelected ? "bg-[#0F766E] animate-pulse" : "bg-zinc-600"
                      )} />
                      <span className="font-semibold text-sm text-slate-900 font-sans">{v.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-sans uppercase",
                        v.gender === 'Female' 
                          ? "bg-purple-100/40 text-purple-700 border border-purple-800/40"
                          : "bg-blue-100/40 text-blue-700 border border-blue-800/40"
                      )}>
                        {v.gender}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#0F766E] text-white flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed mb-3">
                    {v.tone}
                  </p>
                </div>

                {/* Bottom row with pitch info & preview button */}
                <div className="pt-2 border-t border-[#DCE8E4] flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-slate-500 font-sans">
                    {v.pitch}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playSampleAudio(v);
                    }}
                    className={cn(
                      "flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors font-sans",
                      isPlaying
                        ? "bg-red-100/50 text-red-700 border border-red-700/50"
                        : "bg-[#F3F8F7] text-slate-700 hover:text-slate-900 hover:bg-[#F3F8F7]"
                    )}
                  >
                    {isPlaying ? (
                      <>
                        <Square size={11} className="fill-current text-red-700" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={12} className="text-[#0F766E]" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: GREETING & TONE CONFIGURATION */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-6 space-y-6">
        <div className="border-b border-[#DCE8E4] pb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#0F766E]" />
            <h3 className="text-base font-semibold text-slate-900">Greeting &amp; Tone Configuration</h3>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Define the brand presence and mandatory opening sentence when guests connect to the voice agent.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Restaurant Brand Name */}
          <div>
            <label className="block text-xs font-sans text-slate-700 uppercase tracking-wider mb-1.5">
              Restaurant Name
            </label>
            <input
              type="text"
              value={ownerConfig.restaurant_name}
              onChange={(e) => updateOwnerConfig({ restaurant_name: e.target.value })}
              className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3.5 py-2.5 text-sm text-slate-900 font-sans focus:outline-none transition-colors"
              placeholder="e.g., leed pizza"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Referenced dynamically in customer greetings, confirmation SMS, and menu introductions.
            </p>
          </div>

          {/* Tone Selector Dropdown */}
          <div>
            <label className="block text-xs font-sans text-slate-700 uppercase tracking-wider mb-1.5">
              Conversation Tone
            </label>
            <div className="relative">
              <select
                value={ownerConfig.tone}
                onChange={(e) => updateOwnerConfig({ tone: e.target.value })}
                className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3.5 py-2.5 text-sm text-slate-900 font-sans focus:outline-none appearance-none cursor-pointer transition-colors"
              >
                {TONE_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.name} className="bg-[#FFFFFF] text-slate-900">
                    {opt.name} — ({opt.badge})
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                <ChevronDown size={15} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Shapes pacing, phrasing, and lexical selection while preserving operational rules.
            </p>
          </div>
        </div>

        {/* Custom Greeting Sentence Input Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-sans text-slate-700 uppercase tracking-wider">
              Custom Greeting Sentence
            </label>
            <button
              type="button"
              onClick={handleResetGreeting}
              className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-[#0F766E] transition-colors font-sans"
            >
              <RefreshCw size={11} />
              <span>Reset to Default</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              rows={3}
              value={ownerConfig.greeting}
              onChange={(e) => updateOwnerConfig({ greeting: e.target.value })}
              className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg p-3.5 text-sm text-slate-900 focus:outline-none transition-colors leading-relaxed font-sans"
              placeholder="Thanks for calling leed pizza, this is your virtual host, how can I help you today?"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Info size={12} className="text-slate-600" />
              The AI must open the call with this exact sentence before executing conversational tools.
            </span>
            <span className="font-sans">{ownerConfig.greeting?.length || 0} chars</span>
          </div>
        </div>

        {/* Canadian Terminology & Regional Dialect Switch */}
        <div className="bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-900">Canadian Dialect &amp; Hospitality Politeness</span>
              <span className="text-[10px] bg-red-100/40 text-red-700 border border-red-800/40 px-1.5 py-0.2 rounded font-sans">
                Vancouver SSoT
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Enforces natural regional terminology (e.g. &quot;washroom&quot;, &quot;lineup&quot;, &quot;bill&quot;, &quot;right away&quot;).
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateOwnerConfig({ canadian_dialect: !ownerConfig.canadian_dialect })}
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0",
              ownerConfig.canadian_dialect ? "bg-[#0F766E]" : "bg-slate-100"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full bg-black transition-transform",
                ownerConfig.canadian_dialect ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {/* SECTION 3: THE PROMPT COMPILER VERIFICATION INSPECTOR */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-700" />
            <h4 className="text-sm font-semibold text-slate-900">Prompt Compiler Integrity Status</h4>
          </div>
          <button
            type="button"
            onClick={() => setShowPromptInspector(!showPromptInspector)}
            className="text-xs font-sans text-[#0F766E] hover:underline flex items-center gap-1"
          >
            <span>{showPromptInspector ? "Collapse System Prompt" : "Inspect Compiled System Prompt"}</span>
            <ChevronDown size={14} className={cn("transition-transform", showPromptInspector && "rotate-180")} />
          </button>
        </div>

        <p className="text-xs text-slate-600">
          Backend safeguards automatically merge your custom persona (Section 1) with immutable operational rules (Section 2: The Boundary Rule, The Availability Rule, The Menu Truth, and The Final Handoff).
        </p>

        {showPromptInspector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg p-4 font-sans text-xs text-slate-700 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text"
          >
            {compiledPrompt}
          </motion.div>
        )}
      </div>
    </div>
  );
}
