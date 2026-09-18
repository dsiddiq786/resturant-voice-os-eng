'use client';

import React, { useState } from 'react';
import FloorCommand from '@/components/FloorCommand';
import KDSExpediter from '@/components/KDSExpediter';
import DeliveryDispatch from '@/components/DeliveryDispatch';
import { useKDS } from '@/lib/kdsContext';
import { useDelivery } from '@/lib/deliveryContext';
import { cn } from '@/lib/utils';
import { LayoutGrid, Flame, AlertTriangle, Truck } from 'lucide-react';

function NavigationBar({ 
  currentTab, 
  setCurrentTab 
}: { 
  currentTab: 'floor' | 'kds' | 'delivery'; 
  setCurrentTab: (tab: 'floor' | 'kds' | 'delivery') => void;
}) {
  const { totalActiveOrders, isThrottled } = useKDS();
  const { activeDeliveryCount, killSwitchEngaged } = useDelivery();

  return (
    <div className="h-11 bg-[#060709] border-b border-[#1C1E26] px-4 sm:px-5 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-black tracking-widest font-mono text-zinc-300 uppercase">
          SING SING RESTAURANT OS
        </span>
        <span className="text-[10px] text-zinc-500 font-mono hidden lg:inline">
          Main St • Menu Matrix SSoT
        </span>
      </div>

      {/* Screen Switcher - 3 Modular Phases */}
      <div className="flex items-center bg-[#101116] p-0.5 rounded-lg border border-[#232530]">
        <button
          onClick={() => setCurrentTab('floor')}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all",
            currentTab === 'floor'
              ? "bg-[#252834] text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <LayoutGrid size={13} className={currentTab === 'floor' ? "text-emerald-400" : "text-zinc-500"} />
          <span className="hidden sm:inline">Floor &amp; Voice (Ph. 1+2)</span>
          <span className="sm:hidden">Floor</span>
        </button>

        <button
          onClick={() => setCurrentTab('kds')}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all relative",
            currentTab === 'kds'
              ? "bg-orange-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Flame size={13} className={currentTab === 'kds' ? "text-white" : "text-orange-400"} />
          <span className="hidden sm:inline">Kitchen Pacing (Ph. 3)</span>
          <span className="sm:hidden">Kitchen</span>

          {/* Active KDS Order Badge */}
          {totalActiveOrders > 0 && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded-full font-bold font-mono ml-0.5",
              isThrottled 
                ? "bg-red-500 text-white animate-pulse" 
                : "bg-black/40 text-orange-200"
            )}>
              {totalActiveOrders}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentTab('delivery')}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all relative",
            currentTab === 'delivery'
              ? "bg-[#06C167] text-black shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Truck size={13} className={currentTab === 'delivery' ? "text-black" : "text-emerald-400"} />
          <span className="hidden sm:inline">Delivery Dispatch (Ph. 4)</span>
          <span className="sm:hidden">Dispatch</span>

          {/* Active Delivery Badge */}
          {activeDeliveryCount > 0 && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded-full font-bold font-mono ml-0.5",
              currentTab === 'delivery'
                ? "bg-black/30 text-black font-black"
                : "bg-[#06C167]/20 text-[#06C167] border border-[#06C167]/40"
            )}>
              {activeDeliveryCount}
            </span>
          )}
        </button>
      </div>

      {/* Real-time Status Badge */}
      <div className="hidden md:flex items-center gap-2 font-mono text-[11px]">
        {isThrottled || killSwitchEngaged ? (
          <span className="flex items-center gap-1.5 text-red-400 bg-red-950/40 border border-red-500/40 px-2 py-0.5 rounded animate-pulse">
            <AlertTriangle size={12} />
            <span>THROTTLED / 3P PAUSED</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>GATEWAY ONLINE</span>
          </span>
        )}
      </div>
    </div>
  );
}

function MainContent() {
  const [currentTab, setCurrentTab] = useState<'floor' | 'kds' | 'delivery'>('delivery');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#000000]">
      <NavigationBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <div className="flex-1 overflow-hidden relative">
        {currentTab === 'floor' ? (
          <div className="h-full w-full overflow-hidden">
            <FloorCommand />
          </div>
        ) : currentTab === 'kds' ? (
          <div className="h-full w-full overflow-hidden">
            <KDSExpediter />
          </div>
        ) : (
          <div className="h-full w-full overflow-hidden">
            <DeliveryDispatch />
          </div>
        )}
      </div>
    </div>
  );
}

export default function RestaurantApp() {
  return <MainContent />;
}
