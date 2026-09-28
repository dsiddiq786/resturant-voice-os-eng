'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sliders, Shield, Terminal, Sparkles, CheckCircle2, 
  Save, RefreshCw, AlertCircle, Eye, BookOpen, Lock, Wand2, Database
} from 'lucide-react';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { compilePrompt } from '@/lib/promptCompiler';
import { cn } from '@/lib/utils';

export default function MasterPromptControl() {
  const { ownerConfig, updateOwnerConfig, menuItems, saveAndDeploy, isDeploying, deploySuccess, lastDeployedMessage } = useOwnerConfig();
  
  const [masterInstructions, setMasterInstructions] = useState<string>(
    ownerConfig.master_instructions || `// --- MASTER SYSTEM PROMPT OVERRIDES ---
RULE 1: Always highlight the chef's artisan sourdough crust and hot honey finish.
RULE 2: Offer pairing recommendations (like our fresh local draft IPA) when guests order pizzas.
RULE 3: Keep voice answers brisk, punchy, and low-latency.`
  );

  const [canadianDialect, setCanadianDialect] = useState<boolean>(ownerConfig.canadian_dialect !== false);
  const [strictBoundary, setStrictBoundary] = useState<boolean>(true);
  const [greenLightStrictness, setGreenLightStrictness] = useState<boolean>(true);
  const [packedHousePolicy, setPackedHousePolicy] = useState<string>(
    ownerConfig.packed_house_policy || 'Pivot to communal seating, bar seating, or sister venue if 100% full'
  );

  const [activeTab, setActiveTab] = useState<'editor' | 'compiler' | 'db'>('editor');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Load from SQLite on mount
  useEffect(() => {
    async function loadMasterPrompt() {
      try {
        const res = await fetch('/api/db/master-prompt');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.config) {
            if (data.config.master_instructions) {
              setMasterInstructions(data.config.master_instructions);
            }
            if (data.config.canadian_dialect !== undefined) {
              setCanadianDialect(Boolean(data.config.canadian_dialect));
            }
            if (data.config.packed_house_policy) {
              setPackedHousePolicy(data.config.packed_house_policy);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load master prompt from SQLite", err);
      }
    }
    loadMasterPrompt();
  }, []);

  const compiledPrompt = compilePrompt(
    {
      ...ownerConfig,
      master_instructions: masterInstructions,
      canadian_dialect: canadianDialect,
      packed_house_policy: packedHousePolicy
    },
    menuItems
  );

  const handleSaveToDb = async () => {
    setSaveStatus('Saving to SQLite database & compiling...');
    
    updateOwnerConfig({
      master_instructions: masterInstructions,
      canadian_dialect: canadianDialect,
      packed_house_policy: packedHousePolicy
    });

    try {
      const res = await fetch('/api/db/master-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: ownerConfig.restaurant_name,
          tone: ownerConfig.tone,
          greeting: ownerConfig.greeting,
          voice_name: ownerConfig.voice_name,
          voice_label: ownerConfig.voice_label,
          canadian_dialect: canadianDialect,
          venue: ownerConfig.venue,
          master_instructions: masterInstructions,
          boundary_strictness: strictBoundary,
          green_light_enabled: greenLightStrictness,
          packed_house_policy: packedHousePolicy
        })
      });

      if (res.ok) {
        await saveAndDeploy();
        setSaveStatus('Saved in SQLite and deployed to Gemini Live runtime!');
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus('Error saving to SQLite');
      }
    } catch (e: any) {
      setSaveStatus('Error saving: ' + e.message);
    }
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'volume') {
      setMasterInstructions(`// --- PRESET: HIGH-VOLUME PIZZA PACING ---
RULE 1: Ask for takeout timing (ASAP vs Scheduled) immediately upon recognizing a food order.
RULE 2: Highlight our bestselling Classic Pepperoni with hot honey drizzle.
RULE 3: Keep responses under 2 sentences to maximize call turnaround time.`);
    } else if (presetName === 'hospitality') {
      setMasterInstructions(`// --- PRESET: MAXIMUM WARM HOSPITALITY ---
RULE 1: Use warm polite Canadian phrases ("Certainly!", "Right away!", "I would be delighted to arrange that").
RULE 2: Always suggest pairing house craft beers with pizzas and appetizers.
RULE 3: Inquire gently if guests are celebrating any special occasions or have dietary preferences.`);
    } else if (presetName === 'lounge') {
      setMasterInstructions(`// --- PRESET: LATE NIGHT & BAR EMPHASIS ---
RULE 1: If main dining booths are booked, immediately champion Bar Seating and Communal High-Tops.
RULE 2: Highlight our local draft IPA and hot honey garlic wings.
RULE 3: Pivot walk-in parties to sister venues if venue capacity reaches 100%.`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DCE8E4] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-[#0F766E]/10 text-[#0F766E] border border-[#0F766E]/30">
              <Sliders size={20} />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              Master System Prompt Control
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl font-sans">
            Direct master control over the dynamic system instruction compiled and streamed to the Gemini 3.1 Live API. Changes persist in local SQLite and reload synchronously.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#FFFFFF] p-1 rounded-lg border border-[#DCE8E4]">
            <button
              onClick={() => setActiveTab('editor')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors flex items-center gap-1.5",
                activeTab === 'editor' ? "bg-[#F3F8F7] text-slate-900" : "text-slate-600 hover:text-slate-800"
              )}
            >
              <Terminal size={13} />
              <span>Prompt Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('compiler')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors flex items-center gap-1.5",
                activeTab === 'compiler' ? "bg-[#F3F8F7] text-slate-900" : "text-slate-600 hover:text-slate-800"
              )}
            >
              <Eye size={13} />
              <span>Compiled Output</span>
            </button>
          </div>

          <button
            onClick={handleSaveToDb}
            disabled={isDeploying}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#0F766E] to-[#0F766E] hover:from-[#E5C158] hover:to-[#C49E33] text-slate-900 font-sans font-bold text-xs shadow-sm transition-all disabled:opacity-50"
          >
            {isDeploying ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save to SQLite &amp; Deploy</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3 bg-emerald-100/40 border border-emerald-500/40 rounded-lg text-emerald-700 font-sans text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={14} className="text-emerald-700" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Preset Bar */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-[#0F766E]" />
          <span className="text-xs font-sans text-slate-700">Quick Prompt Directives:</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => applyPreset('volume')}
            className="px-2.5 py-1 rounded bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-slate-200 text-slate-700 text-xs font-sans transition-colors"
          >
            High-Volume Pizza Pacing
          </button>
          <button
            onClick={() => applyPreset('hospitality')}
            className="px-2.5 py-1 rounded bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-slate-200 text-slate-700 text-xs font-sans transition-colors"
          >
            Warm Hospitality &amp; Upsell
          </button>
          <button
            onClick={() => applyPreset('lounge')}
            className="px-2.5 py-1 rounded bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-slate-200 text-slate-700 text-xs font-sans transition-colors"
          >
            Late Night &amp; Bar Pivot
          </button>
        </div>
      </div>

      {activeTab === 'editor' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Code Editor */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl overflow-hidden shadow-lg">
              <div className="px-4 py-2.5 bg-[#FFFFFF] border-b border-[#DCE8E4] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-[#0F766E]" />
                  <span className="text-xs font-sans font-semibold text-slate-800">
                    Custom Master Prompt Directives (Injected into Live Agent)
                  </span>
                </div>
                <span className="text-[10px] font-sans text-slate-500 uppercase">
                  Live Sync
                </span>
              </div>
              <textarea
                value={masterInstructions}
                onChange={(e) => setMasterInstructions(e.target.value)}
                rows={14}
                className="w-full bg-transparent p-4 font-sans text-xs text-slate-800 leading-relaxed outline-none resize-y border-none focus:ring-1 focus:ring-[#0F766E]/50"
                placeholder="Write custom system prompt instructions, specific owner policies, or promotional rules here..."
              />
            </div>

            {/* Hardcoded Rules Card */}
            <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-sans text-xs font-bold">
                <Shield size={14} className="text-emerald-700" />
                <span>Immutable System Directives (Hardcoded Guardrails)</span>
              </div>
              <p className="text-[11px] font-sans text-slate-600">
                These guardrails are mathematically enforced by the Prompt Compiler and cannot be bypassed:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-sans">
                <div className="p-2 rounded bg-[#FFFFFF] border border-slate-200 text-slate-700">
                  <span className="text-[#0F766E] font-bold">1. Boundary Rule:</span> Voice AI only collects data; never touches raw credit cards.
                </div>
                <div className="p-2 rounded bg-[#FFFFFF] border border-slate-200 text-slate-700">
                  <span className="text-[#0F766E] font-bold">2. Green Light Rule:</span> Must trigger check_availability before confirming booking.
                </div>
                <div className="p-2 rounded bg-[#FFFFFF] border border-slate-200 text-slate-700">
                  <span className="text-[#0F766E] font-bold">3. 86 Inventory Rule:</span> Strictly forbidden from selling 86&apos;d dishes.
                </div>
                <div className="p-2 rounded bg-[#FFFFFF] border border-slate-200 text-slate-700">
                  <span className="text-[#0F766E] font-bold">4. Kitchen Pacing:</span> Must capture ASAP vs scheduled timestamp for KDS.
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Parameters & Toggles */}
          <div className="space-y-4">
            <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-sans font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={14} className="text-[#0F766E]" />
                <span>Master System Flags</span>
              </h3>

              <div className="space-y-3 font-sans text-xs">
                {/* Canadian Dialect Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#FFFFFF] border border-slate-200">
                  <div>
                    <div className="text-slate-800 font-semibold">Canadian Dialect</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">washroom, lineup, bill, warm fillers</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={canadianDialect}
                    onChange={(e) => setCanadianDialect(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#D4AF37] cursor-pointer"
                  />
                </div>

                {/* Strict Boundary Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#FFFFFF] border border-slate-200">
                  <div>
                    <div className="text-slate-800 font-semibold">Strict Payment Boundary</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">Enforce SMS payment link statement</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={strictBoundary}
                    onChange={(e) => setStrictBoundary(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#D4AF37] cursor-pointer"
                  />
                </div>

                {/* Green Light Strictness */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#FFFFFF] border border-slate-200">
                  <div>
                    <div className="text-slate-800 font-semibold">Green Light Latency Mask</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">Conversational filler during turn-time math</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={greenLightStrictness}
                    onChange={(e) => setGreenLightStrictness(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#D4AF37] cursor-pointer"
                  />
                </div>
              </div>

              {/* Packed House Policy */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="text-xs font-sans text-slate-700 font-semibold block">
                  Packed House Pivot Policy:
                </label>
                <input
                  type="text"
                  value={packedHousePolicy}
                  onChange={(e) => setPackedHousePolicy(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-slate-200 rounded-lg px-3 py-2 text-xs font-sans text-slate-800 focus:ring-1 focus:ring-[#0F766E]"
                />
              </div>

              {/* Database Status Info */}
              <div className="p-3 bg-[#FFFFFF] border border-slate-200 rounded-lg text-xs font-sans text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <Database size={12} className="text-[#0F766E]" />
                  <span>SQLite Synchronized</span>
                </div>
                <div className="text-[10px]">
                  Table: <span className="text-[#0F766E]">master_prompt_config</span>
                </div>
                <div className="text-[10px]">
                  Storage: <span className="text-slate-700">/data/leed_pizza.db</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Compiled View */
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl overflow-hidden shadow-xl">
          <div className="px-4 py-3 bg-[#FFFFFF] border-b border-[#DCE8E4] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-emerald-700" />
              <span className="text-xs font-sans font-semibold text-slate-800">
                Exact Gemini 3.1 Live Compiled System Instruction
              </span>
            </div>
            <span className="text-xs font-sans text-slate-600">
              {compiledPrompt.length} characters
            </span>
          </div>
          <pre className="p-5 font-sans text-xs text-slate-700 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[650px] overflow-y-auto selection:bg-emerald-800">
            {compiledPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
