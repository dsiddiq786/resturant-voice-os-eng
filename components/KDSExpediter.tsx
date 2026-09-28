'use client';

import React, { useState } from 'react';
import { useKDS } from '@/lib/kdsContext';
import { useOwnerConfig } from '@/lib/ownerConfigContext';
import { 
  KitchenStation, 
  KITCHEN_STATIONS, 
  KDSTicket, 
  TicketItem, 
  MENU_MATRIX,
  MenuItem,
  OrderSource 
} from '@/lib/menuMatrix';
import { cn } from '@/lib/utils';
import { 
  Flame, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Sparkles, 
  Play, 
  Check, 
  Utensils, 
  Truck, 
  PhoneCall, 
  ChevronRight,
  RefreshCw,
  Plus,
  Info
} from 'lucide-react';

export default function KDSExpediter() {
  const { 
    tickets, 
    completedTickets,
    totalActiveOrders, 
    averageTicketTimeMinutes, 
    isThrottled, 
    bumpTicket, 
    bumpItem, 
    fireItemImmediately, 
    createInboundOrder 
  } = useKDS();

  const { ownerConfig, menuItems } = useOwnerConfig();
  const activeMenu: MenuItem[] = (menuItems && menuItems.length > 0) ? (menuItems as unknown as MenuItem[]) : MENU_MATRIX;

  const [activeStation, setActiveStation] = useState<KitchenStation>('Expo');
  const [showSimModal, setShowSimModal] = useState(false);
  const [showCompletedTray, setShowCompletedTray] = useState(false);
  const [selectedMenuItems, setSelectedMenuItems] = useState<MenuItem[]>([
    activeMenu[0] || MENU_MATRIX[0],
    activeMenu[1] || MENU_MATRIX[1] || MENU_MATRIX[0]
  ]);
  const [simSource, setSimSource] = useState<OrderSource>('DINE_IN');
  const [simGuestName, setSimGuestName] = useState('Alex Henderson');

  // Filter tickets based on active station view
  const displayTickets = tickets.filter(ticket => {
    if (activeStation === 'Expo') return true;
    // Station view: only show tickets that have at least one item for this station
    return ticket.items.some(item => item.station === activeStation);
  });

  // Calculate station load
  const getStationItemCount = (station: KitchenStation) => {
    if (station === 'Expo') return tickets.reduce((acc, t) => acc + t.items.length, 0);
    return tickets.reduce((acc, t) => {
      return acc + t.items.filter(i => i.station === station && i.status !== 'READY').length;
    }, 0);
  };

  const handleSimulateRandomOrder = () => {
    // Pick 2-3 random items
    const count = Math.random() > 0.5 ? 3 : 2;
    const shuffled = [...activeMenu].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count);

    const sources: OrderSource[] = ['DINE_IN', 'DOORDASH', 'UBEREATS', 'VOICE_CALL'];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    const names = ['Jordan Reed', 'Taylor Swift', 'Devon Vance', 'Chef Counter T4', 'UberEats #9102'];
    const randomName = names[Math.floor(Math.random() * names.length)];

    createInboundOrder(randomSource, picked, randomName);
  };

  const handleSimulateCustom = () => {
    if (selectedMenuItems.length === 0) return;
    createInboundOrder(simSource, selectedMenuItems, simGuestName);
    setShowSimModal(false);
  };

  const toggleMenuItemSelection = (item: MenuItem) => {
    setSelectedMenuItems(prev => {
      const exists = prev.some(i => i.item_id === item.item_id);
      if (exists) {
        return prev.filter(i => i.item_id !== item.item_id);
      } else {
        return [...prev, item];
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#F3F8F7] text-slate-900 font-sans select-none overflow-hidden">
      {/* 1. GLOBAL EXPEDITER HEADER */}
      <header className="px-5 py-3.5 bg-[#F3F8F7] border-b border-[#DCE8E4] flex flex-wrap items-center justify-between gap-4 shrink-0">
        {/* Left: Venue & System Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-700">
              <Flame size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-wide uppercase text-slate-900">{ownerConfig.restaurant_name.toUpperCase()} KDS &amp; PACING ENGINE</h1>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-sans border border-slate-200">
                  Phase 3 Expo
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-sans">
                Single Source of Truth: <span className="text-slate-800 font-semibold">{ownerConfig.venue || 'Main St'}</span>
              </p>
            </div>
          </div>

          {/* Massive Station / Capacity Status Indicator */}
          <div className={cn(
            "flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border font-sans transition-all",
            isThrottled 
              ? "bg-red-100/60 border-red-500 text-red-700 animate-pulse" 
              : "bg-emerald-100/40 border-emerald-500/50 text-emerald-700"
          )}>
            <span className={cn(
              "w-2.5 h-2.5 rounded-full",
              isThrottled ? "bg-red-500 animate-ping" : "bg-emerald-400"
            )} />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {isThrottled ? "THROTTLE WARNING (>25 ORDERS)" : "KITCHEN CAPACITY: NORMAL"}
              </span>
              <span className="text-[9px] text-slate-600">
                {isThrottled ? "Voice Agent Quoting +20m Delay" : "Cook Pace Sync Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Stats */}
        <div className="flex items-center gap-5 text-xs font-sans">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg">
            <Utensils size={14} className="text-slate-600" />
            <span className="text-slate-600">Active Orders:</span>
            <span className="font-bold text-slate-900 text-sm">{totalActiveOrders}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg">
            <Clock size={14} className="text-amber-700" />
            <span className="text-slate-600">Avg Ticket Age:</span>
            <span className="font-bold text-slate-900 text-sm">{averageTicketTimeMinutes}m</span>
          </div>

          {completedTickets.length > 0 && (
            <button
              onClick={() => setShowCompletedTray(!showCompletedTray)}
              className="text-xs text-slate-600 hover:text-slate-800 underline font-sans flex items-center gap-1"
            >
              <CheckCircle size={13} className="text-emerald-700" />
              {completedTickets.length} Bumped
            </button>
          )}
        </div>

        {/* Right: Simulation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateRandomOrder}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg text-xs tracking-wide transition-all shadow-lg shadow-orange-950/50"
            title="Simulate random order and demonstrate synchronized pacing"
          >
            <Sparkles size={14} />
            <span>Simulate Inbound Order</span>
          </button>

          <button
            onClick={() => setShowSimModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F3F8F7] hover:bg-[#F3F8F7] text-slate-800 border border-[#DCE8E4] rounded-lg text-xs font-sans transition-colors"
            title="Open custom order builder"
          >
            <Plus size={14} />
            <span>Custom Ticket</span>
          </button>
        </div>
      </header>

      {/* 2. STATION-SPECIFIC VIEW TOGGLE BAR */}
      <div className="px-5 py-2.5 bg-[#FFFFFF] border-b border-[#DCE8E4] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] uppercase font-sans text-slate-500 mr-2 flex items-center gap-1">
            Station View:
          </span>
          {KITCHEN_STATIONS.map(station => {
            const count = getStationItemCount(station);
            const isActive = activeStation === station;
            return (
              <button
                key={station}
                onClick={() => setActiveStation(station)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-sans font-bold transition-all",
                  isActive 
                    ? "bg-white text-slate-900 shadow-md shadow-white/10" 
                    : "bg-[#F3F8F7] text-slate-700 hover:bg-[#F3F8F7] border border-[#DCE8E4]"
                )}
              >
                <span>{station === 'Expo' ? 'Full Expo (All Stations)' : station}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded font-bold",
                  isActive ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legend / Pacing Rules Pill */}
        <div className="hidden lg:flex items-center gap-3 text-[11px] font-sans text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-zinc-600"></span> 0-10m Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500"></span> 10-15m Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-red-600 animate-pulse"></span> 15m+ Critical
          </span>
        </div>
      </div>

      {/* 3. THE TICKET BOARD (KANBAN STYLE EXPEDITER CANVAS) */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-5 flex gap-4 items-start scrollbar-thin">
        {displayTickets.length === 0 ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[#DCE8E4] rounded-xl">
            <Utensils size={40} className="text-slate-500 mb-3" />
            <h3 className="text-base font-bold text-slate-700 font-sans uppercase">
              No Active Tickets in {activeStation}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-4 font-sans">
              The station queue is clear. All tickets have been bumped, or no items match this station filter.
            </p>
            <button
              onClick={handleSimulateRandomOrder}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-sans font-semibold"
            >
              Simulate Inbound Order
            </button>
          </div>
        ) : (
          displayTickets.map((ticket, index) => (
            <KDSTicketCard 
              key={ticket.id} 
              ticket={ticket} 
              index={index}
              activeStation={activeStation}
              onBumpTicket={bumpTicket}
              onBumpItem={bumpItem}
              onFireItem={fireItemImmediately}
            />
          ))
        )}
      </main>

      {/* 4. COMPLETED TICKETS TRAY (OPTIONAL DRAWER) */}
      {showCompletedTray && (
        <div className="h-44 bg-[#F3F8F7] border-t border-[#DCE8E4] p-4 flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-sans text-slate-600 font-bold">
              Recently Bumped / Expedited Tickets ({completedTickets.length})
            </span>
            <button 
              onClick={() => setShowCompletedTray(false)}
              className="text-xs text-slate-500 hover:text-slate-700 font-sans"
            >
              Close
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto py-1">
            {completedTickets.map(t => (
              <div key={t.id} className="min-w-[200px] p-2.5 bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg text-xs font-sans">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-bold text-slate-900">{t.orderNumber}</span>
                  <span className="text-[10px] text-emerald-700">READY</span>
                </div>
                <div className="text-[11px] text-slate-700 truncate mt-1">{t.guestName}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {t.items.length} items • Anchor {t.totalAnchorMinutes}m
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CUSTOM SIMULATION MODAL */}
      {showSimModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#DCE8E4]">
              <div>
                <h3 className="text-sm font-bold uppercase font-sans text-slate-900">Create Custom Paced Order</h3>
                <p className="text-[11px] text-slate-600 font-sans">
                  Test the Pacing Engine: select items with different cook times to observe automatic hold queues.
                </p>
              </div>
              <button 
                onClick={() => setShowSimModal(false)}
                className="text-slate-500 hover:text-slate-700 text-sm font-sans px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Source & Guest Name */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] font-sans uppercase text-slate-600 block mb-1">Order Source</label>
                <select
                  value={simSource}
                  onChange={(e) => setSimSource(e.target.value as OrderSource)}
                  className="w-full bg-[#F3F8F7] border border-[#DCE8E4] text-xs rounded-lg px-3 py-2 text-slate-800 outline-none"
                >
                  <option value="DINE_IN">Dine-In (Table)</option>
                  <option value="VOICE_CALL">Voice Concierge (Phone Order)</option>
                  <option value="DOORDASH">DoorDash Delivery</option>
                  <option value="UBEREATS">UberEats Delivery</option>
                  <option value="TOAST_POS">Toast POS</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-sans uppercase text-slate-600 block mb-1">Guest / Order Ref</label>
                <input
                  type="text"
                  value={simGuestName}
                  onChange={(e) => setSimGuestName(e.target.value)}
                  className="w-full bg-[#F3F8F7] border border-[#DCE8E4] text-xs rounded-lg px-3 py-2 text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Menu Matrix Item Picker */}
            <div className="mb-4">
              <label className="text-[10px] font-sans uppercase text-slate-600 block mb-1.5">
                Select Items from {ownerConfig.restaurant_name} Menu Matrix ({selectedMenuItems.length} selected)
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activeMenu.map(item => {
                  const isSelected = selectedMenuItems.some(i => i.item_id === item.item_id);
                  return (
                    <div
                      key={item.item_id}
                      onClick={() => toggleMenuItemSelection(item)}
                      className={cn(
                        "p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between",
                        isSelected 
                          ? "bg-orange-100/30 border-orange-500/50 text-slate-900" 
                          : "bg-[#F3F8F7] border-[#DCE8E4] text-slate-700 hover:border-zinc-500"
                      )}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          <span>{item.item_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-sans">
                            {item.station}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-1">{item.description}</div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <span className="text-amber-700 font-sans font-bold block">{item.cook_time_minutes}m Cook</span>
                        <span className="text-[10px] text-slate-500">${item.price.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Anchor Calculation Summary */}
            {selectedMenuItems.length > 0 && (
              <div className="p-3 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg mb-4 text-xs font-sans text-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Pacing Engine Anchor</span>
                  <span className="font-bold text-orange-700">
                    {Math.max(...selectedMenuItems.map(i => i.cook_time_minutes))} Minutes
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-600">
                  Faster items will hold in <span className="text-amber-700">QUEUED</span> state
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSimModal(false)}
                className="px-4 py-2 bg-transparent hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-sans"
              >
                Cancel
              </button>
              <button
                onClick={handleSimulateCustom}
                disabled={selectedMenuItems.length === 0}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-xs font-sans font-bold transition-colors"
              >
                Fire Paced Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// INDIVIDUAL TICKET COMPONENT WITH DYNAMIC VISUAL AGING
// ---------------------------------------------------------
interface TicketProps {
  ticket: KDSTicket;
  index: number;
  activeStation: KitchenStation;
  onBumpTicket: (id: string) => void;
  onBumpItem: (ticketId: string, itemId: string) => void;
  onFireItem: (ticketId: string, itemId: string) => void;
}

function KDSTicketCard({ 
  ticket, 
  index, 
  activeStation, 
  onBumpTicket, 
  onBumpItem, 
  onFireItem 
}: TicketProps) {
  // Visual Aging Calculation:
  // 0-10 mins: Grey header (#20222B)
  // 10-15 mins: Yellow header (#B45309)
  // 15+ mins: Flashing Red header (#B91C1C)
  const ageSeconds = ticket.elapsedSeconds;
  const ageMinutes = Math.floor(ageSeconds / 60);

  let agingStyle = "bg-[#F3F8F7] text-slate-800 border-[#DCE8E4]";
  let agingBadge = "text-slate-600 bg-slate-100";

  if (ageMinutes >= 15) {
    agingStyle = "bg-red-700 text-white border-red-500 animate-pulse";
    agingBadge = "text-slate-900 bg-red-100 border border-red-400";
  } else if (ageMinutes >= 10) {
    agingStyle = "bg-amber-600 text-slate-900 border-amber-400";
    agingBadge = "text-slate-900 bg-amber-800 border border-amber-400";
  }

  // Filter items for station display if viewing specific station
  const visibleItems = activeStation === 'Expo' 
    ? ticket.items 
    : ticket.items.filter(i => i.station === activeStation);

  const allVisibleReady = visibleItems.every(i => i.status === 'READY');
  const allTicketReady = ticket.items.every(i => i.status === 'READY');

  const formatSource = (source: OrderSource) => {
    switch (source) {
      case 'DOORDASH':
        return { label: 'DoorDash', icon: <Truck size={12} className="text-red-700" /> };
      case 'UBEREATS':
        return { label: 'UberEats', icon: <Truck size={12} className="text-emerald-700" /> };
      case 'VOICE_CALL':
        return { label: 'Phone / AI Voice', icon: <PhoneCall size={12} className="text-amber-700" /> };
      case 'TOAST_POS':
        return { label: 'Toast POS', icon: <Utensils size={12} className="text-blue-700" /> };
      default:
        return { label: 'Dine-In', icon: <Utensils size={12} className="text-slate-600" /> };
    }
  };

  const srcInfo = formatSource(ticket.source);

  return (
    <div className="w-[340px] shrink-0 bg-[#FFFFFF] border-2 border-[#DCE8E4] rounded-xl flex flex-col shadow-2xl overflow-hidden transition-all">
      {/* TICKET HEADER: VISUAL AGING DYNAMIC BAR */}
      <div className={cn("p-3 border-b flex items-center justify-between transition-colors", agingStyle)}>
        <div className="flex items-center gap-2">
          <span className="font-sans text-sm font-black tracking-wider">
            #{ticket.orderNumber}
          </span>
          {ticket.tableNumber && (
            <span className="text-[11px] font-sans px-1.5 py-0.5 rounded bg-white/70 text-slate-800 font-bold border border-white/20">
              {ticket.tableNumber}
            </span>
          )}
        </div>

        {/* Live Elapsed Age Timer */}
        <div className="flex items-center gap-1.5 font-sans">
          <Clock size={14} />
          <span className="font-bold text-sm">
            {String(ageMinutes).padStart(2, '0')}:{String(ageSeconds % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* SUB-HEADER: GUEST & SOURCE META */}
      <div className="px-3.5 py-2 bg-[#FFFFFF] border-b border-[#DCE8E4] flex items-center justify-between text-xs font-sans">
        <div className="flex items-center gap-1.5 text-slate-700 font-semibold truncate max-w-[190px]">
          {srcInfo.icon}
          <span className="truncate">{ticket.guestName}</span>
        </div>
        <span className="text-[10px] text-slate-600 uppercase font-sans px-1.5 py-0.5 rounded bg-[#F3F8F7] border border-[#DCE8E4]">
          {srcInfo.label}
        </span>
      </div>

      {/* ANCHOR & PACING SYNC SUMMARY */}
      <div className="px-3.5 py-1.5 bg-[#F3F8F7] border-b border-[#DCE8E4] flex items-center justify-between text-[11px] font-sans text-slate-600">
        <span>Anchor: <strong className="text-orange-700">{ticket.totalAnchorMinutes}m</strong></span>
        <span>
          {ticket.items.filter(i => i.status === 'READY').length}/{ticket.items.length} Ready
        </span>
      </div>

      {/* TICKET BODY: LIST OF ITEMS WITH MASSIVE READABILITY */}
      <div className="p-3.5 flex-1 space-y-3 overflow-y-auto max-h-[460px]">
        {visibleItems.map(item => (
          <TicketItemRow 
            key={item.id} 
            item={item} 
            onBumpItem={() => onBumpItem(ticket.id, item.id)}
            onFireItem={() => onFireItem(ticket.id, item.id)}
          />
        ))}
      </div>

      {/* TICKET FOOTER: BUMP & ACTIONS */}
      <div className="p-3 bg-[#FFFFFF] border-t border-[#DCE8E4] flex items-center gap-2">
        <button
          onClick={() => onBumpTicket(ticket.id)}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md",
            allTicketReady 
              ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-bounce" 
              : "bg-[#F3F8F7] hover:bg-[#F3F8F7] text-slate-800 border border-[#DCE8E4]"
          )}
        >
          <Check size={16} />
          <span>{allTicketReady ? 'EXPEDITE / BUMP ORDER' : 'BUMP TICKET'}</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// ITEM ROW WITHIN TICKET (PACING ENGINE IN ACTION)
// ---------------------------------------------------------
interface ItemRowProps {
  item: TicketItem;
  onBumpItem: () => void;
  onFireItem: () => void;
}

function TicketItemRow({ item, onBumpItem, onFireItem }: ItemRowProps) {
  const isReady = item.status === 'READY';
  const isQueued = item.status === 'QUEUED';
  const isCooking = item.status === 'COOKING';

  return (
    <div 
      className={cn(
        "p-3 rounded-lg border transition-all relative overflow-hidden",
        isReady && "bg-emerald-100/20 border-emerald-500/50 text-emerald-700 opacity-90",
        isCooking && "bg-[#F3F8F7] border-[#DCE8E4] text-slate-900",
        isQueued && "bg-[#FFFFFF] border-dashed border-[#DCE8E4] text-slate-600"
      )}
    >
      {/* Item Title & Station Pill with Massive Legibility */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className={cn(
              "text-sm font-black tracking-tight",
              isReady ? "line-through text-slate-500" : "text-slate-900"
            )}>
              {item.item_name}
            </h4>
            {item.isAnchor && (
              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-orange-600/30 border border-orange-500/40 text-orange-700 font-bold uppercase">
                Anchor ({item.cook_time_minutes}m)
              </span>
            )}
          </div>
          
          {/* Precise toast description */}
          <p className="text-[11px] text-slate-600 mt-1 leading-snug font-sans">
            {item.description}
          </p>
        </div>

        <span className="text-[10px] font-sans uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0 border border-slate-200">
          {item.station}
        </span>
      </div>

      {/* Pacing State Display */}
      <div className="mt-2.5 pt-2 border-t border-[#DCE8E4] flex items-center justify-between text-xs font-sans">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isQueued && (
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock size={13} className="animate-spin text-amber-700" />
              <span>HELD: Fire in {Math.floor(item.delaySeconds / 60)}m {item.delaySeconds % 60}s</span>
            </div>
          )}

          {isCooking && (
            <div className="flex items-center gap-1.5 text-orange-700 font-bold">
              <Flame size={13} className="text-orange-500 animate-pulse" />
              <span>COOKING: {Math.floor(item.timeRemainingSeconds / 60)}m {item.timeRemainingSeconds % 60}s</span>
            </div>
          )}

          {isReady && (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle size={13} />
              <span>READY AT PASS</span>
            </div>
          )}
        </div>

        {/* Action Buttons: Force Fire (if held) or Bump Ready */}
        <div className="flex items-center gap-1.5">
          {isQueued && (
            <button
              onClick={onFireItem}
              className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-700 border border-amber-500/40 rounded text-[10px] font-bold uppercase transition-colors"
              title="Skip pacing delay and fire into cooking immediately"
            >
              Fire Now
            </button>
          )}

          {!isReady && (
            <button
              onClick={onBumpItem}
              className="px-2.5 py-1 bg-[#F3F8F7] hover:bg-emerald-600 hover:text-white text-slate-700 border border-[#DCE8E4] rounded text-[10px] font-bold uppercase transition-colors"
              title="Mark item as ready"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
