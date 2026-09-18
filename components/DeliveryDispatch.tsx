'use client';

import React, { useState } from 'react';
import { 
  useDelivery 
} from '@/lib/deliveryContext';
import { 
  DeliveryOrder, 
  DeliveryPlatform 
} from '@/lib/menuMatrix';
import { 
  Bike, 
  Car, 
  Clock, 
  PackageCheck, 
  CheckCircle2, 
  Send, 
  Flame, 
  Zap, 
  AlertOctagon, 
  Radio, 
  Sparkles, 
  FileCode2, 
  Phone, 
  MapPin, 
  Layers, 
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKDS } from '@/lib/kdsContext';

// Brand styling helper
function getPlatformStyle(platform: DeliveryPlatform) {
  switch (platform) {
    case 'UBEREATS':
      return {
        brandName: 'Uber Eats',
        colorHex: '#06C167',
        borderTopClass: 'border-t-2 border-[#06C167]',
        badgeBg: 'bg-[#06C167]/15 text-[#06C167] border-[#06C167]/30',
        activeToggleBg: 'bg-[#06C167] text-black hover:bg-[#05a859]',
        accentText: 'text-[#06C167]',
        glowClass: 'shadow-[0_0_15px_rgba(6,193,103,0.15)]'
      };
    case 'DOORDASH':
      return {
        brandName: 'DoorDash',
        colorHex: '#FF3008',
        borderTopClass: 'border-t-2 border-[#FF3008]',
        badgeBg: 'bg-[#FF3008]/15 text-[#FF3008] border-[#FF3008]/30',
        activeToggleBg: 'bg-[#FF3008] text-white hover:bg-[#e02905]',
        accentText: 'text-[#FF3008]',
        glowClass: 'shadow-[0_0_15px_rgba(255,48,8,0.15)]'
      };
    case 'SKIPTHEDISHES':
      return {
        brandName: 'SkipTheDishes',
        colorHex: '#FF8000',
        borderTopClass: 'border-t-2 border-[#FF8000]',
        badgeBg: 'bg-[#FF8000]/15 text-[#FF8000] border-[#FF8000]/30',
        activeToggleBg: 'bg-[#FF8000] text-black hover:bg-[#e67300]',
        accentText: 'text-[#FF8000]',
        glowClass: 'shadow-[0_0_15px_rgba(255,128,0,0.15)]'
      };
  }
}

// Single Dispatch Order Card
function DispatchOrderCard({ 
  order, 
  onMarkPacked, 
  onHandedToDriver,
  onAcceptToKitchen,
  onInspect
}: { 
  order: DeliveryOrder;
  onMarkPacked: (id: string) => void;
  onHandedToDriver: (id: string) => void;
  onAcceptToKitchen: (id: string) => void;
  onInspect: (order: DeliveryOrder) => void;
}) {
  const pStyle = getPlatformStyle(order.platform);
  const isCourierArrived = order.courier.status === 'ARRIVED';
  const isCourierEnRoute = order.courier.status === 'EN_ROUTE';

  const elapsedMins = Math.floor(order.elapsedSeconds / 60);

  return (
    <div 
      id={`order-card-${order.id}`}
      className={cn(
        "bg-[#131418] rounded-xl border border-[#22242C] overflow-hidden flex flex-col transition-all duration-200",
        pStyle.borderTopClass,
        isCourierArrived && order.status === 'READY_FOR_DRIVER' ? "ring-1 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.12)]" : ""
      )}
    >
      {/* 1. Header: Platform Logo/Color (Uber/DoorDash), Order #, and Customer Name */}
      <div className="p-3.5 bg-[#171920]/80 border-b border-[#20232B] flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Platform Tag / Color */}
            <span className={cn(
              "text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded border tracking-wider",
              pStyle.badgeBg
            )}>
              {pStyle.brandName}
            </span>
            <span className="text-sm font-black font-mono text-zinc-100 tracking-tight">
              #{order.orderNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 bg-[#0E0F13] px-2 py-0.5 rounded border border-[#20222A]">
              <Clock size={11} className="text-zinc-500" />
              {elapsedMins}m ago
            </span>
            <button
              onClick={() => onInspect(order)}
              title="Inspect Raw Ingested Contract"
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-[#20232D]"
            >
              <FileCode2 size={13} />
            </button>
          </div>
        </div>

        {/* Customer Name & Subtotal */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <h4 className="text-base font-bold text-zinc-100 tracking-tight">
              {order.customerName}
            </h4>
            {order.deliveryAddress && (
              <p className="text-[11px] text-zinc-400 font-mono truncate max-w-[220px] flex items-center gap-1 mt-0.5">
                <MapPin size={10} className="text-zinc-500 shrink-0" />
                <span>{order.deliveryAddress}</span>
              </p>
            )}
          </div>
          <span className="text-xs font-mono font-bold text-zinc-300 bg-[#0D0E12] px-2 py-0.5 rounded border border-[#1E2028]">
            ${order.subtotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 2. Body: Item list (matched to Menu Matrix) */}
      <div className="px-3.5 py-2.5 space-y-1.5 flex-1">
        {order.items.map((item, idx) => (
          <div 
            key={`${item.item_id}-${idx}`}
            className="flex items-start justify-between text-xs py-1 border-b border-[#1E2028]/50 last:border-0"
          >
            <div className="flex items-start gap-2">
              <span className="font-mono font-bold text-zinc-300 bg-[#1C1E26] px-1.5 py-0.2 rounded text-[11px]">
                {item.quantity}×
              </span>
              <div>
                <span className="font-medium text-zinc-200">
                  {item.item_name}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono ml-1.5">
                  ({item.station} • {item.cook_time_minutes}m)
                </span>
                {item.special_instructions && (
                  <p className="text-[10px] text-amber-400/90 font-mono italic mt-0.5">
                    Note: {item.special_instructions}
                  </p>
                )}
              </div>
            </div>
            <span className="text-[11px] font-mono text-zinc-400 shrink-0">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}

        {order.specialInstructions && (
          <div className="mt-2 p-2 bg-[#1A1813] border border-amber-900/30 rounded text-[11px] text-amber-300 font-mono">
            <strong>Special Instructions:</strong> {order.specialInstructions}
          </div>
        )}
      </div>

      {/* Pickup Shelf Location (if packed) */}
      {order.pickupShelf && (
        <div className="mx-3.5 mb-2 px-2.5 py-1.5 bg-[#0D2319] border border-emerald-500/40 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck size={14} className="text-emerald-400" />
            <span className="text-xs font-mono font-bold text-emerald-300 tracking-wide">
              PACKED SHELF:
            </span>
          </div>
          <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-400/40">
            {order.pickupShelf}
          </span>
        </div>
      )}

      {/* 3. Footer: Courier Status (`Assigning...`, `Driver: Ali - 4 mins away`, `Arrived`) */}
      <div className={cn(
        "px-3.5 py-2.5 bg-[#0F1014] border-t border-[#1E2028] flex items-center justify-between",
        isCourierArrived ? "bg-emerald-950/40 border-emerald-500/40" : ""
      )}>
        <div className="flex items-center gap-2">
          {order.courier.vehicle?.toLowerCase().includes('bike') ? (
            <Bike size={15} className={isCourierArrived ? "text-emerald-400" : "text-zinc-400"} />
          ) : (
            <Car size={15} className={isCourierArrived ? "text-emerald-400" : "text-zinc-400"} />
          )}

          <div className="text-xs font-mono font-medium">
            {order.courier.status === 'ASSIGNING' ? (
              <span className="text-zinc-400">Assigning...</span>
            ) : isCourierArrived ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Arrived ({order.courier.name})
              </span>
            ) : (
              <span className="text-amber-300 font-semibold">
                Driver: {order.courier.name} - {order.courier.etaMinutes} mins away
              </span>
            )}
          </div>
        </div>

        <div>
          {isCourierArrived ? (
            <span className="text-[10px] font-mono font-black uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
              Arrived
            </span>
          ) : isCourierEnRoute ? (
            <span className="text-[10px] font-mono text-zinc-400 bg-[#16171E] px-2 py-0.5 rounded border border-[#232532]">
              {order.courier.vehicle || 'En Route'}
            </span>
          ) : null}
        </div>
      </div>

      {/* 4. Action Buttons: Large touch targets for Mark Packed and Handed to Driver */}
      <div className="p-2.5 bg-[#171920] border-t border-[#20232B] flex gap-2">
        {order.status === 'NEW' && (
          <button
            id={`btn-accept-${order.id}`}
            onClick={() => onAcceptToKitchen(order.id)}
            className="w-full min-h-[44px] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
          >
            <Flame size={15} />
            <span>Send to Kitchen (Prep)</span>
          </button>
        )}

        {order.status === 'IN_KITCHEN' && (
          <button
            id={`btn-pack-${order.id}`}
            onClick={() => onMarkPacked(order.id)}
            className="w-full min-h-[44px] py-2.5 bg-[#252834] hover:bg-[#323646] text-zinc-100 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 border border-[#3A3F50] shadow-sm active:scale-[0.98]"
          >
            <PackageCheck size={16} className="text-emerald-400" />
            <span>Mark Packed</span>
          </button>
        )}

        {order.status === 'READY_FOR_DRIVER' && (
          <button
            id={`btn-dispatch-${order.id}`}
            onClick={() => onHandedToDriver(order.id)}
            className="w-full min-h-[44px] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
          >
            <CheckCircle2 size={16} />
            <span>Handed to Driver</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Ingestion Contract Inspector Modal
function WebhookInspectorModal({
  order,
  onClose
}: {
  order: DeliveryOrder | null;
  onClose: () => void;
}) {
  if (!order) return null;

  const contractJson = {
    contract_version: "2.1",
    ingested_via: "/api/webhooks/delivery",
    venue: "Sing Sing Main St",
    order_number: order.orderNumber,
    platform: order.platform,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      address: order.deliveryAddress
    },
    items: order.items,
    subtotal_cad: order.subtotal,
    courier: order.courier,
    dispatch_shelf: order.pickupShelf || "Awaiting Packing",
    created_at_timestamp: order.createdAt,
    kds_pacing_sync_id: order.kdsTicketId || "kds-synced"
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#101115] border border-[#232530] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#20232D] flex items-center justify-between bg-[#14161D]">
          <div className="flex items-center gap-2">
            <FileCode2 size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold font-mono text-zinc-100 uppercase">
              Unified Ingestion Contract • #{order.orderNumber}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <pre className="text-[12px] font-mono text-emerald-400/90 bg-[#08090C] p-4 rounded-lg border border-[#1B1D25] leading-relaxed overflow-x-auto">
            {JSON.stringify(contractJson, null, 2)}
          </pre>
        </div>

        <div className="px-5 py-3 border-t border-[#20232D] bg-[#14161D] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#252834] hover:bg-[#323646] text-xs font-mono text-white"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

// Kill Switch Audit Log Modal
function AuditLogModal({
  isOpen,
  onClose,
  auditLog
}: {
  isOpen: boolean;
  onClose: () => void;
  auditLog: Array<{ timestamp: string; message: string; type: 'AUTO' | 'MANUAL' | 'INFO' }>;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#101115] border border-[#232530] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#20232D] flex items-center justify-between bg-[#14161D]">
          <div className="flex items-center gap-2">
            <AlertOctagon size={16} className="text-red-400" />
            <h3 className="text-sm font-bold font-mono text-zinc-100 uppercase">
              Delivery Kill-Switch &amp; Gateway Audit Stream
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {auditLog.map((entry, idx) => (
            <div 
              key={idx}
              className={cn(
                "p-3 rounded-lg border text-xs font-mono leading-relaxed",
                entry.type === 'AUTO' 
                  ? "bg-red-950/30 border-red-500/40 text-red-200" 
                  : entry.type === 'MANUAL'
                  ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
                  : "bg-[#161820] border-[#252834] text-zinc-300"
              )}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                <span>{entry.timestamp}</span>
                <span className="font-bold uppercase tracking-wider">{entry.type} EVENT</span>
              </div>
              <div>{entry.message}</div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#20232D] bg-[#14161D] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#252834] hover:bg-[#323646] text-xs font-mono text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// MAIN EXPORT: Delivery Dispatch Dashboard (Takeout Packing Station)
export default function DeliveryDispatch() {
  const { totalActiveOrders, isThrottled } = useKDS();
  const {
    deliveryOrders,
    completedDeliveries,
    platformStatus,
    killSwitchEngaged,
    killSwitchAuditLog,
    shiftGMV,
    activeDeliveryCount,
    togglePlatformStatus,
    triggerKillSwitchManual,
    simulateWebhook,
    acceptOrderToKitchen,
    markPacked,
    markHandedToDriver
  } = useDelivery();

  const [inspectingOrder, setInspectingOrder] = useState<DeliveryOrder | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Filter into the 3 board vertical columns
  const newOrders = deliveryOrders.filter(o => o.status === 'NEW');
  const inKitchenOrders = deliveryOrders.filter(o => o.status === 'IN_KITCHEN');
  const readyOrders = deliveryOrders.filter(o => o.status === 'READY_FOR_DRIVER');

  // Trigger simulated webhook
  const handleSimulate = async (platform: DeliveryPlatform) => {
    setIsSimulating(true);
    try {
      await simulateWebhook(platform);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#000000] text-zinc-100 overflow-hidden select-none">
      
      {/* SECTION A: GLOBAL HEADER */}
      <header className="px-6 py-4 bg-[#08090C] border-b border-[#1A1C24] shrink-0 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Station Context */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black font-mono tracking-wider text-zinc-100 uppercase">
                TAKEOUT DISPATCH &amp; PACKING STATION
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                PHASE 4 GATEWAY
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Sing Sing Main St • Aggregated Delivery Dispatch &amp; Courier Tracking
            </p>
          </div>

          {/* Core Shift Metrics: Active Orders & GMV */}
          <div className="flex items-center gap-4">
            {/* Active Delivery Orders Counter */}
            <div className="bg-[#121318] border border-[#22242D] px-4 py-2 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-950/40 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <PackageCheck size={18} />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                  Active Delivery
                </div>
                <div className="text-lg font-black font-mono text-zinc-100 leading-none">
                  {activeDeliveryCount} <span className="text-xs text-zinc-500 font-normal">orders</span>
                </div>
              </div>
            </div>

            {/* Shift GMV */}
            <div className="bg-[#121318] border border-[#22242D] px-4 py-2 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                  Shift GMV
                </div>
                <div className="text-lg font-black font-mono text-emerald-400 leading-none">
                  ${shiftGMV.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Ingestion & Audit Stream Trigger */}
            <button
              onClick={() => setShowAuditLog(true)}
              className="px-3 py-2 rounded-xl bg-[#161820] hover:bg-[#20222C] border border-[#262834] text-xs font-mono text-zinc-300 flex items-center gap-2 transition-all"
              title="View Kill Switch & Ingestion Logs"
            >
              <AlertOctagon size={14} className={killSwitchEngaged ? "text-red-400 animate-pulse" : "text-zinc-500"} />
              <span className="hidden sm:inline">Gateway Audit</span>
              <span className="text-[10px] font-bold bg-[#090A0D] px-1.5 py-0.2 rounded border border-[#262834] text-zinc-400">
                {killSwitchAuditLog.length}
              </span>
            </button>
          </div>
        </div>

        {/* CONTROLS ROW: 3 Large Platform Toggles & Webhook Simulators */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#161822]">
          
          {/* THREE LARGE TOGGLE SWITCHES: [UberEats: ACTIVE] [DoorDash: ACTIVE] [SkipTheDishes: PAUSED] */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-bold mr-1 hidden md:inline">
              Platform Status:
            </span>

            {/* UberEats Switch */}
            <button
              id="btn-toggle-ubereats"
              onClick={() => togglePlatformStatus('UBEREATS')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all flex items-center gap-2",
                platformStatus.UBEREATS === 'ACTIVE'
                  ? "bg-[#06C167]/15 border-[#06C167] text-[#06C167] shadow-[0_0_12px_rgba(6,193,103,0.2)]"
                  : "bg-[#15161D] border-[#262834] text-zinc-500 hover:text-zinc-400"
              )}
            >
              <span className={cn(
                "w-2 h-2 rounded-full",
                platformStatus.UBEREATS === 'ACTIVE' ? "bg-[#06C167] animate-pulse" : "bg-zinc-600"
              )} />
              <span>UberEats: {platformStatus.UBEREATS}</span>
            </button>

            {/* DoorDash Switch */}
            <button
              id="btn-toggle-doordash"
              onClick={() => togglePlatformStatus('DOORDASH')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all flex items-center gap-2",
                platformStatus.DOORDASH === 'ACTIVE'
                  ? "bg-[#FF3008]/15 border-[#FF3008] text-[#FF3008] shadow-[0_0_12px_rgba(255,48,8,0.2)]"
                  : "bg-[#15161D] border-[#262834] text-zinc-500 hover:text-zinc-400"
              )}
            >
              <span className={cn(
                "w-2 h-2 rounded-full",
                platformStatus.DOORDASH === 'ACTIVE' ? "bg-[#FF3008] animate-pulse" : "bg-zinc-600"
              )} />
              <span>DoorDash: {platformStatus.DOORDASH}</span>
            </button>

            {/* SkipTheDishes Switch */}
            <button
              id="btn-toggle-skipthedishes"
              onClick={() => togglePlatformStatus('SKIPTHEDISHES')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all flex items-center gap-2",
                platformStatus.SKIPTHEDISHES === 'ACTIVE'
                  ? "bg-[#FF8000]/15 border-[#FF8000] text-[#FF8000] shadow-[0_0_12px_rgba(255,128,0,0.2)]"
                  : "bg-[#15161D] border-[#262834] text-zinc-500 hover:text-zinc-400"
              )}
            >
              <span className={cn(
                "w-2 h-2 rounded-full",
                platformStatus.SKIPTHEDISHES === 'ACTIVE' ? "bg-[#FF8000] animate-pulse" : "bg-zinc-600"
              )} />
              <span>SkipTheDishes: {platformStatus.SKIPTHEDISHES}</span>
            </button>
          </div>

          {/* SIMULATE WEBHOOK BUTTONS */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500 hidden xl:inline">
              Test Ingestion:
            </span>

            {/* Simulate UberEats Webhook */}
            <button
              id="btn-sim-uber-webhook"
              onClick={() => handleSimulate('UBEREATS')}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-lg bg-[#06C167] hover:bg-[#05a759] text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              <Send size={12} />
              <span>Simulate UberEats Webhook</span>
            </button>

            {/* Simulate DoorDash Webhook */}
            <button
              id="btn-sim-dd-webhook"
              onClick={() => handleSimulate('DOORDASH')}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-lg bg-[#FF3008] hover:bg-[#e02905] text-white font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              <Send size={12} />
              <span>Simulate DoorDash Webhook</span>
            </button>
          </div>
        </div>

        {/* AUTO-THROTTLING ALERT BANNER (If Kitchen Load > 25 tickets or manual kill switch engaged) */}
        {(isThrottled || killSwitchEngaged) && (
          <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl flex items-center justify-between text-xs font-mono text-red-200 animate-pulse">
            <div className="flex items-center gap-2.5">
              <AlertOctagon size={18} className="text-red-400 shrink-0" />
              <div>
                <span className="font-bold text-red-300 uppercase">
                  AUTOMATIC KILL SWITCH ENGAGED (KITCHEN LOAD EXCEEDED):
                </span>{" "}
                Active kitchen tickets exceed 25 ({totalActiveOrders} tickets). All 3P delivery channels are automatically set to PAUSED via simulated outbound merchant API.
              </div>
            </div>

            <button
              onClick={() => triggerKillSwitchManual(false)}
              className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-100 text-[11px] font-bold shrink-0 border border-red-500/40 ml-4"
            >
              Override / Resume
            </button>
          </div>
        )}
      </header>

      {/* SECTION B: THE DISPATCH BOARD (3 Vertical Columns) */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-[#000000]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-w-[960px]">
          
          {/* COLUMN 1: NEW ORDERS */}
          <div className="flex flex-col bg-[#0A0B0E] border border-[#1C1E26] rounded-2xl overflow-hidden shadow-sm">
            {/* Column Header */}
            <div className="px-4 py-3.5 bg-[#121319] border-b border-[#1E212B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <h2 className="text-xs font-bold font-mono tracking-widest text-zinc-100 uppercase">
                  NEW ORDERS
                </h2>
              </div>
              <span className="text-xs font-mono font-bold bg-[#1C1E26] text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
                {newOrders.length}
              </span>
            </div>

            {/* Column Body / Scrollable Cards */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5">
              {newOrders.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 border border-dashed border-[#1E2028] rounded-xl font-mono text-xs">
                  <PackageCheck size={28} className="text-zinc-600 mb-2" />
                  <p className="text-zinc-400 font-semibold">No New Inbound Orders</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Click &quot;Simulate UberEats Webhook&quot; above to generate an inbound order.
                  </p>
                </div>
              ) : (
                newOrders.map(order => (
                  <DispatchOrderCard
                    key={order.id}
                    order={order}
                    onMarkPacked={markPacked}
                    onHandedToDriver={markHandedToDriver}
                    onAcceptToKitchen={acceptOrderToKitchen}
                    onInspect={setInspectingOrder}
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: IN KITCHEN (Prep) */}
          <div className="flex flex-col bg-[#0A0B0E] border border-[#1C1E26] rounded-2xl overflow-hidden shadow-sm">
            {/* Column Header */}
            <div className="px-4 py-3.5 bg-[#121319] border-b border-[#1E212B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-orange-400" />
                <h2 className="text-xs font-bold font-mono tracking-widest text-zinc-100 uppercase">
                  IN KITCHEN (PREP)
                </h2>
              </div>
              <span className="text-xs font-mono font-bold bg-[#1C1E26] text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/20">
                {inKitchenOrders.length}
              </span>
            </div>

            {/* Column Body / Scrollable Cards */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5">
              {inKitchenOrders.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 border border-dashed border-[#1E2028] rounded-xl font-mono text-xs">
                  <Flame size={28} className="text-zinc-600 mb-2" />
                  <p className="text-zinc-400 font-semibold">No Orders in Kitchen Prep</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Orders accepted or paced from Phase 3 will appear here.
                  </p>
                </div>
              ) : (
                inKitchenOrders.map(order => (
                  <DispatchOrderCard
                    key={order.id}
                    order={order}
                    onMarkPacked={markPacked}
                    onHandedToDriver={markHandedToDriver}
                    onAcceptToKitchen={acceptOrderToKitchen}
                    onInspect={setInspectingOrder}
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: READY FOR DRIVER */}
          <div className="flex flex-col bg-[#0A0B0E] border border-[#1C1E26] rounded-2xl overflow-hidden shadow-sm">
            {/* Column Header */}
            <div className="px-4 py-3.5 bg-[#121319] border-b border-[#1E212B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck size={15} className="text-emerald-400" />
                <h2 className="text-xs font-bold font-mono tracking-widest text-zinc-100 uppercase">
                  READY FOR DRIVER
                </h2>
              </div>
              <span className="text-xs font-mono font-bold bg-[#1C1E26] text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {readyOrders.length}
              </span>
            </div>

            {/* Column Body / Scrollable Cards */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5">
              {readyOrders.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 border border-dashed border-[#1E2028] rounded-xl font-mono text-xs">
                  <CheckCircle2 size={28} className="text-zinc-600 mb-2" />
                  <p className="text-zinc-400 font-semibold">No Packed Orders Awaiting Pickup</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    When packed, orders display designated shelf bays ready for courier handoff.
                  </p>
                </div>
              ) : (
                readyOrders.map(order => (
                  <DispatchOrderCard
                    key={order.id}
                    order={order}
                    onMarkPacked={markPacked}
                    onHandedToDriver={markHandedToDriver}
                    onAcceptToKitchen={acceptOrderToKitchen}
                    onInspect={setInspectingOrder}
                  />
                ))
              )}
            </div>
          </div>

        </div>
      </main>

      {/* MODALS */}
      <WebhookInspectorModal
        order={inspectingOrder}
        onClose={() => setInspectingOrder(null)}
      />

      <AuditLogModal
        isOpen={showAuditLog}
        onClose={() => setShowAuditLog(false)}
        auditLog={killSwitchAuditLog}
      />

    </div>
  );
}
