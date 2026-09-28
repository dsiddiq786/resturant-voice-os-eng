'use client';

import React, { useState } from 'react';
import FloorCommand from '@/components/FloorCommand';
import KDSExpediter from '@/components/KDSExpediter';
import DeliveryDispatch from '@/components/DeliveryDispatch';
import OwnerControlPanel from '@/components/owner/OwnerControlPanel';
import { useKDS } from '@/lib/kdsContext';
import { useDelivery } from '@/lib/deliveryContext';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { cn } from '@/lib/utils';
import { LayoutGrid, Flame, AlertTriangle, Truck } from 'lucide-react';

function NavigationBar({ 
  currentTab, 
  setCurrentTab,
  onSwitchToOwner
}: { 
  currentTab: 'floor' | 'kds' | 'delivery'; 
  setCurrentTab: (tab: 'floor' | 'kds' | 'delivery') => void;
  onSwitchToOwner: () => void;
}) {
  const { totalActiveOrders, isThrottled } = useKDS();
  const { activeDeliveryCount, killSwitchEngaged } = useDelivery();
  const { ownerConfig } = useOwnerConfig();

  return (
    <div className="min-h-16 bg-[#F3F8F7] border-b border-[#DCE8E4] px-4 sm:px-5 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSwitchToOwner}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FFFFFF] hover:bg-[#F3F8F7] border border-[#0F766E]/40 text-[#0F766E] text-xs font-sans font-bold transition-all shadow-sm"
        >
          <span>← Owner Control Panel</span>
        </button>
        <span className="text-xs font-black tracking-widest font-sans text-slate-700 uppercase hidden md:inline">
          {ownerConfig.restaurant_name.toUpperCase()} OS
        </span>
      </div>

      {/* Screen Switcher - 3 Modular Phases */}
      <div className="flex items-center bg-[#FFFFFF] p-0.5 rounded-lg border border-[#DCE8E4]">
        <button
          onClick={() => setCurrentTab('floor')}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-sans font-semibold transition-all",
            currentTab === 'floor'
              ? "bg-[#F3F8F7] text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          <LayoutGrid size={13} className={currentTab === 'floor' ? "text-emerald-700" : "text-slate-500"} />
          <span className="hidden sm:inline">Floor &amp; voice</span>
          <span className="sm:hidden">Floor</span>
        </button>

        <button
          onClick={() => setCurrentTab('kds')}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-sans font-semibold transition-all relative",
            currentTab === 'kds'
              ? "bg-orange-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          <Flame size={13} className={currentTab === 'kds' ? "text-slate-900" : "text-orange-700"} />
          <span className="hidden sm:inline">Kitchen</span>
          <span className="sm:hidden">Kitchen</span>

          {/* Active KDS Order Badge */}
          {totalActiveOrders > 0 && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded-full font-bold font-sans ml-0.5",
              isThrottled 
                ? "bg-red-500 text-slate-900 animate-pulse" 
                : "bg-black/40 text-orange-700"
            )}>
              {totalActiveOrders}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentTab('delivery')}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-sans font-semibold transition-all relative",
            currentTab === 'delivery'
              ? "bg-[#06C167] text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          <Truck size={13} className={currentTab === 'delivery' ? "text-slate-900" : "text-emerald-700"} />
          <span className="hidden sm:inline">Delivery</span>
          <span className="sm:hidden">Dispatch</span>

          {/* Active Delivery Badge */}
          {activeDeliveryCount > 0 && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.2 rounded-full font-bold font-sans ml-0.5",
              currentTab === 'delivery'
                ? "bg-black/30 text-slate-900 font-black"
                : "bg-[#06C167]/20 text-[#147D52] border border-[#06C167]/40"
            )}>
              {activeDeliveryCount}
            </span>
          )}
        </button>
      </div>

      {/* Real-time Status Badge */}
      <div className="hidden md:flex items-center gap-2 font-sans text-[11px]">
        {isThrottled || killSwitchEngaged ? (
          <span className="flex items-center gap-1.5 text-red-700 bg-red-100/40 border border-red-500/40 px-2 py-0.5 rounded animate-pulse">
            <AlertTriangle size={12} />
            <span>THROTTLED / 3P PAUSED</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100/30 border border-emerald-500/30 px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>GATEWAY ONLINE</span>
          </span>
        )}
      </div>
    </div>
  );
}

function MainContent({ initialMode = 'owner' }: { initialMode?: 'owner' | 'operations' }) {
  const [appMode, setAppMode] = useState<'owner' | 'operations'>(initialMode);
  const [currentTab, setCurrentTab] = useState<'floor' | 'kds' | 'delivery'>('floor');
  const { ownerConfig, floorTables } = useOwnerConfig();

  if (appMode === 'owner') {
    return <OwnerControlPanel onSwitchToOperations={() => setAppMode('operations')} />;
  }

  const syncKey = `${ownerConfig.restaurant_name}-${ownerConfig.last_deployed_at || floorTables.length}`;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F3F8F7]">
      <NavigationBar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        onSwitchToOwner={() => setAppMode('owner')}
      />
      <div className="operations-content flex-1 overflow-hidden relative">
        {currentTab === 'floor' ? (
          <div className="h-full w-full overflow-hidden">
            <FloorCommand key={`floor-${syncKey}`} />
          </div>
        ) : currentTab === 'kds' ? (
          <div className="h-full w-full overflow-hidden">
            <KDSExpediter key={`kds-${syncKey}`} />
          </div>
        ) : (
          <div className="h-full w-full overflow-hidden">
            <DeliveryDispatch key={`dispatch-${syncKey}`} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function RestaurantApp({ initialMode = 'owner' }: { initialMode?: 'owner' | 'operations' }) {
  return <MainContent initialMode={initialMode} />;
}
