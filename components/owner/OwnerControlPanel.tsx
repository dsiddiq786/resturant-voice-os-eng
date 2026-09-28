'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, LayoutGrid, UtensilsCrossed, Rocket, 
  Shield, CheckCircle2, RefreshCw, Layers, 
  Sparkles, ExternalLink, ArrowRight, Store, Radio, Sliders
} from 'lucide-react';
import VoicePersonaConfig from './VoicePersonaConfig';
import FloorPlanBuilder from './FloorPlanBuilder';
import MenuBuilder from './MenuBuilder';
import DeployPanel from './DeployPanel';
import MasterPromptControl from './MasterPromptControl';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { cn } from '@/lib/utils';

export type OwnerNavTab = 'voice' | 'prompt' | 'floor' | 'menu' | 'deploy';

interface OwnerControlPanelProps {
  onSwitchToOperations?: () => void;
}

export default function OwnerControlPanel({ onSwitchToOperations }: OwnerControlPanelProps) {
  const [activeTab, setActiveTab] = useState<OwnerNavTab>('voice');
  const { 
    ownerConfig, 
    hasUnsavedChanges, 
    isDeploying, 
    deploySuccess, 
    saveAndDeploy,
    selectedVoice
  } = useOwnerConfig();

  const NAV_ITEMS = [
    {
      id: 'voice' as OwnerNavTab,
      label: 'Voice AI',
      subtitle: 'Voice & personality',
      icon: Bot
    },
    {
      id: 'prompt' as OwnerNavTab,
      label: 'Master Prompt',
      subtitle: 'Instructions & behavior',
      icon: Sliders
    },
    {
      id: 'floor' as OwnerNavTab,
      label: 'Floor Plan',
      subtitle: 'Tables & seating',
      icon: LayoutGrid
    },
    {
      id: 'menu' as OwnerNavTab,
      label: 'Menu Builder',
      subtitle: 'Dishes & availability',
      icon: UtensilsCrossed
    },
    {
      id: 'deploy' as OwnerNavTab,
      label: 'Deploy',
      subtitle: 'Review & publish',
      icon: Rocket
    }
  ];

  return (
    <div className="owner-shell min-h-screen bg-[#F3F8F7] text-slate-800 flex flex-col font-sans selection:bg-[#0F766E] selection:text-white">
      {/* TOP STATUS BAR */}
      <header className="owner-header min-h-20 border-b border-[#DCE8E4] bg-[#FFFFFF]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#0F766E] to-[#0F766E] flex items-center justify-center text-slate-900 font-bold text-xs shadow-sm">
            LP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm tracking-tight">{ownerConfig.restaurant_name}</span>
              <span className="text-[10px] font-sans uppercase bg-[#F3F8F7] text-[#0F766E] px-2 py-0.5 rounded border border-[#0F766E]/30">
                Owner Control Panel
              </span>
            </div>
          </div>
        </div>

        {/* Right side actions: Venue badge, Live switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg text-xs font-sans text-slate-600">
            <Radio size={12} className="text-emerald-700 animate-pulse" />
            <span className="text-slate-700">{ownerConfig.venue || `${ownerConfig.restaurant_name} Main St`}</span>
            <span className="text-slate-500">|</span>
            <span className="text-[#0F766E]">{selectedVoice.name} Voice</span>
          </div>

          {onSwitchToOperations && (
            <button
              type="button"
              onClick={onSwitchToOperations}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-800 rounded-lg text-xs font-sans transition-colors"
            >
              <span>Open operations</span>
              <ArrowRight size={13} className="text-[#0F766E]" />
            </button>
          )}
        </div>
      </header>

      {/* MAIN LAYOUT: FIXED LEFT SIDEBAR + CONTENT AREA */}
      <div className="owner-layout flex-1 flex overflow-hidden">
        {/* FIXED LEFT SIDEBAR NAVIGATION */}
        <aside className="owner-sidebar w-64 shrink-0 bg-[#FFFFFF] border-r border-[#DCE8E4] flex flex-col justify-between p-4 select-none">
          <div className="space-y-6">
            <div className="px-2 pt-1">
              <span className="text-[10px] font-sans uppercase text-slate-500 tracking-wider">
                YOUR WORKSPACE
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all group relative",
                      isActive
                        ? "bg-[#F3F8F7] text-slate-900 border border-[#0F766E]/50 shadow-sm"
                        : "text-slate-600 hover:text-slate-800 hover:bg-[#FFFFFF] border border-transparent"
                    )}
                  >
                    {/* Active Golden Bar */}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className="absolute left-0 top-2 bottom-2 w-1 bg-[#0F766E] rounded-r"
                      />
                    )}

                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      isActive
                        ? "bg-[#0F766E]/15 text-[#0F766E]"
                        : "bg-[#F3F8F7] text-slate-500 group-hover:text-slate-700"
                    )}>
                      <Icon size={17} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={cn("text-xs font-semibold tracking-tight", isActive ? "text-slate-900" : "text-slate-700")}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate font-sans">
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Bottom: Architecture Status */}
          <div className="p-3 bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 font-sans text-[11px]">
              <Shield size={13} />
              <span>Made for your service</span>
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed font-sans">
              A little less admin. A lot more hospitality. Your restaurant, beautifully in sync.
            </p>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="owner-content min-w-0 flex-1 overflow-y-auto bg-[#F3F8F7] p-6 lg:p-8 relative">
          <div className="workspace-intro"><div><span className="eyebrow">RESTAURANT WORKSPACE</span><h1>A smoother service starts here.</h1><p>Thoughtful details. Seamless operations. More time for your guests.</p></div><div className="workspace-status"><span />{hasUnsavedChanges ? 'Changes ready to save' : 'Your workspace is up to date'}</div></div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'voice' && <VoicePersonaConfig />}
              {activeTab === 'prompt' && <MasterPromptControl />}
              {activeTab === 'floor' && <FloorPlanBuilder />}
              {activeTab === 'menu' && <MenuBuilder />}
              {activeTab === 'deploy' && <DeployPanel onSwitchToOperations={onSwitchToOperations} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* FLOATING ACTION BUTTON: Save & Deploy Configuration */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          disabled={isDeploying}
          onClick={saveAndDeploy}
          className={cn(
            "flex items-center gap-2.5 px-5 py-3 rounded-full font-sans text-xs font-bold transition-all shadow-2xl backdrop-blur-md",
            hasUnsavedChanges
              ? "bg-[#0F766E] hover:bg-[#0F766E] text-white shadow-sm ring-2 ring-[#0F766E]"
              : "bg-[#FFFFFF]/90 hover:bg-[#F3F8F7] text-slate-800 border border-[#DCE8E4] shadow-slate-200/60"
          )}
        >
          {isDeploying ? (
            <>
              <RefreshCw size={15} className="animate-spin text-[#0F766E]" />
              <span>Compiling &amp; Deploying...</span>
            </>
          ) : (
            <>
              <Rocket size={15} className={hasUnsavedChanges ? "text-slate-900" : "text-[#0F766E]"} />
              <span>{hasUnsavedChanges ? "Save & Deploy Configuration" : "Configuration Synced"}</span>
            </>
          )}

          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
