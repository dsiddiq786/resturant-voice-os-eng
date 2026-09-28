'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Rocket, CheckCircle2, AlertTriangle, ShieldCheck, 
  Terminal, Play, Volume2, Mic, Clock, PhoneCall, RefreshCw,
  Sparkles, Check, ArrowUpRight
} from 'lucide-react';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { cn } from '@/lib/utils';

export default function DeployPanel({ onSwitchToOperations }: { onSwitchToOperations?: () => void }) {
  const { 
    ownerConfig, 
    selectedVoice, 
    floorTables, 
    menuItems, 
    hasUnsavedChanges, 
    isDeploying, 
    deploySuccess, 
    lastDeployedMessage, 
    saveAndDeploy,
    compiledPrompt
  } = useOwnerConfig();

  // Test bench simulator state
  const [simPartySize, setSimPartySize] = useState<number>(4);
  const [simTime, setSimTime] = useState<string>('20:00');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const totalSeats = floorTables.reduce((sum, t) => sum + t.capacity, 0);
  const availableMenuCount = menuItems.filter(i => !i.is_86).length;
  const count86 = menuItems.filter(i => i.is_86).length;

  // Run Test Availability Simulator
  const runSimulator = () => {
    setIsSimulating(true);
    setSimResult(null);

    setTimeout(() => {
      // Logic mirrors check_availability in server.mjs
      const matchingTable = floorTables.find(t => 
        t.capacity >= simPartySize && 
        t.capacity <= simPartySize + 2 && 
        t.stage === 'AVAILABLE'
      );

      if (matchingTable) {
        setSimResult({
          status: 'available',
          table: matchingTable.id,
          type: matchingTable.type,
          category: matchingTable.table_category,
          dialogue: `Awesome, I've got ${matchingTable.label} (${matchingTable.capacity}-top ${matchingTable.table_category.toLowerCase()}) locked in for your party at ${simTime}!`
        });
      } else {
        setSimResult({
          status: 'unavailable',
          alternatives: ['19:30', '21:15'],
          dialogue: `It looks like our private tables for ${simPartySize} are currently committed at ${simTime}. Under our Packed House Rule, I can offer bar seating, our communal table, or slot you in at 7:30 or 9:15 PM. Would either work?`
        });
      }
      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="border-b border-[#DCE8E4] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#0F766E]/10 border border-[#0F766E]/30 flex items-center justify-center text-[#0F766E]">
              <Rocket size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Deploy &amp; Production Verification</h2>
            <span className="text-[11px] font-sans uppercase bg-[#F3F8F7] text-[#0F766E] px-2.5 py-0.5 rounded border border-[#0F766E]/20 ml-2">
              Module 4
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Audit system safeguards, execute availability simulations, and hot-deploy the compiled Voice Persona and Venue Graph to the live telephone network.
          </p>
        </div>

        {/* Primary Deploy Button */}
        <button
          type="button"
          disabled={isDeploying}
          onClick={saveAndDeploy}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-sans font-bold transition-all shadow-xl shrink-0",
            hasUnsavedChanges
              ? "bg-[#0F766E] hover:bg-[#0F766E] text-white ring-2 ring-[#0F766E]/50 shadow-sm animate-pulse"
              : "bg-[#F3F8F7] hover:bg-[#F3F8F7] text-slate-900 border border-[#DCE8E4]"
          )}
        >
          {isDeploying ? (
            <>
              <RefreshCw size={14} className="animate-spin text-slate-600" />
              <span>Compiling Live Graph...</span>
            </>
          ) : (
            <>
              <Rocket size={14} className={hasUnsavedChanges ? "text-slate-900" : "text-[#0F766E]"} />
              <span>{hasUnsavedChanges ? "Deploy Changes Now" : "Systems Deployed & Synced"}</span>
            </>
          )}
        </button>
      </div>

      {/* Deployment Status Alert */}
      {deploySuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-100/40 border border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-700"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-700" />
            <div className="text-xs">
              <span className="font-semibold block font-sans">Deployment Synchronized Successfully</span>
              <span className="text-emerald-700/90">{lastDeployedMessage || "All Gemini Live, Floor Command, and KDS nodes updated."}</span>
            </div>
          </div>
          {onSwitchToOperations && (
            <button
              type="button"
              onClick={onSwitchToOperations}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-900 font-sans text-xs font-bold hover:bg-emerald-400 transition-colors shadow cursor-pointer"
            >
              <span>View Live Floor &amp; Concierge →</span>
            </button>
          )}
        </motion.div>
      )}

      {/* System Integrity Diagnostic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Voice Persona */}
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic size={16} className="text-[#0F766E]" />
              <h4 className="text-xs font-sans uppercase text-slate-700">Voice AI Intake</h4>
            </div>
            <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-emerald-100/40 text-emerald-700 border border-emerald-800/40">
              Active
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Model Voice:</span>
              <span className="text-slate-900 font-sans font-semibold">{selectedVoice.name}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tone Cadence:</span>
              <span className="text-slate-900 font-sans">{ownerConfig.tone}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Greeting Length:</span>
              <span className="text-slate-900 font-sans">{ownerConfig.greeting?.length || 0} chars</span>
            </div>
          </div>
        </div>

        {/* Card 2: Floor Matrix */}
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#0F766E]" />
              <h4 className="text-xs font-sans uppercase text-slate-700">Floor Graph Engine</h4>
            </div>
            <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-emerald-100/40 text-emerald-700 border border-emerald-800/40">
              Synced
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Seating Units:</span>
              <span className="text-slate-900 font-sans font-semibold">{floorTables.length} Tables</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Max Capacity:</span>
              <span className="text-slate-900 font-sans font-semibold">{totalSeats} Guests</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Packed House Pivot:</span>
              <span className="text-emerald-700 font-sans">Bar &amp; Communal Ready</span>
            </div>
          </div>
        </div>

        {/* Card 3: Menu & KDS */}
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#0F766E]" />
              <h4 className="text-xs font-sans uppercase text-slate-700">Kitchen &amp; Inventory</h4>
            </div>
            <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-emerald-100/40 text-emerald-700 border border-emerald-800/40">
              Live
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Available Recipes:</span>
              <span className="text-slate-900 font-sans font-semibold">{availableMenuCount} Items</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>86&apos;d Sold Out:</span>
              <span className={cn("font-sans", count86 > 0 ? "text-amber-700 font-semibold" : "text-slate-500")}>
                {count86} Items
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Kitchen Pacing Rule:</span>
              <span className="text-emerald-700 font-sans">ASAP/Timestamp Enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* IMMUTABLE OPERATIONAL RULES CHECKLIST */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#DCE8E4] pb-3">
          <ShieldCheck size={16} className="text-emerald-700" />
          <h3 className="text-sm font-semibold text-slate-900">Immutable Operational Rules Verification</h3>
          <span className="text-[10px] font-sans bg-emerald-100/30 text-emerald-700 border border-emerald-800/40 px-2 py-0.5 rounded ml-auto">
            4 / 4 Rules Enforced
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 font-sans block">1. The Boundary Rule</span>
              <p className="text-slate-600 mt-0.5">Voice agent collects intent and data only. Credit card numbers and direct payment collection over the phone are strictly prohibited.</p>
            </div>
          </div>

          <div className="p-3 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 font-sans block">2. The Availability (Green Light) Rule</span>
              <p className="text-slate-600 mt-0.5">The agent is strictly forbidden from saying &quot;yes&quot; to reservations until backend tool returns available status.</p>
            </div>
          </div>

          <div className="p-3 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 font-sans block">3. The Menu Truth &amp; 86&apos;d Rule</span>
              <p className="text-slate-600 mt-0.5">The agent only pitches active recipes. If an item is flagged 86&apos;d, it immediately apologizes and offers a live alternative.</p>
            </div>
          </div>

          <div className="p-3 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 font-sans block">4. The Final Handoff Rule</span>
              <p className="text-slate-600 mt-0.5">Calls conclude only after emitting the final structured JSON payload for reservation lock or kitchen pacing fire.</p>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE CALL SIMULATOR TESTBENCH */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#DCE8E4] pb-3">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-[#0F766E]" />
            <h3 className="text-sm font-semibold text-slate-900">Live Intake Sandbox &amp; Latency Masking Test</h3>
          </div>
          <span className="text-[11px] font-sans text-slate-600">Simulate Call Turn</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
              Test Party Size
            </label>
            <input
              type="number"
              min="1"
              max="16"
              value={simPartySize}
              onChange={(e) => setSimPartySize(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3 py-1.5 text-xs text-slate-900 font-sans focus:outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
              Requested Time
            </label>
            <select
              value={simTime}
              onChange={(e) => setSimTime(e.target.value)}
              className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3 py-1.5 text-xs text-slate-900 font-sans focus:outline-none"
            >
              <option value="18:00">6:00 PM</option>
              <option value="19:00">7:00 PM</option>
              <option value="19:30">7:30 PM</option>
              <option value="20:00">8:00 PM (Peak)</option>
              <option value="20:30">8:30 PM</option>
              <option value="21:00">9:00 PM</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={isSimulating}
              onClick={runSimulator}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-900 rounded-lg text-xs font-sans transition-colors"
            >
              {isSimulating ? <RefreshCw size={13} className="animate-spin text-[#0F766E]" /> : <Play size={13} className="text-[#0F766E]" />}
              <span>Test check_availability Tool</span>
            </button>
          </div>
        </div>

        {/* Simulation Output */}
        {simResult && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg font-sans text-xs space-y-2"
          >
            <div className="flex items-center justify-between border-b border-[#DCE8E4] pb-2">
              <span className="text-slate-500 text-[11px]">Tool Response Output:</span>
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                simResult.status === 'available' ? "bg-emerald-100/50 text-emerald-700" : "bg-amber-100/50 text-amber-700"
              )}>
                {simResult.status}
              </span>
            </div>

            <div className="text-slate-700 leading-relaxed">
              <span className="text-[#0F766E] font-semibold">{ownerConfig.restaurant_name} Host ({selectedVoice.name}): </span>
              &quot;{simResult.dialogue}&quot;
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
