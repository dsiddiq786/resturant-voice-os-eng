'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { KDSTicket, MENU_MATRIX, TicketItem, MenuItem, OrderSource } from '@/lib/menuMatrix';

interface KDSContextType {
  tickets: KDSTicket[];
  completedTickets: KDSTicket[];
  totalActiveOrders: number;
  averageTicketTimeMinutes: number;
  isThrottled: boolean; // Capacity warning: active tickets > 25
  bumpTicket: (ticketId: string) => void;
  bumpItem: (ticketId: string, itemId: string) => void;
  fireItemImmediately: (ticketId: string, itemId: string) => void;
  createInboundOrder: (source?: OrderSource, customItems?: MenuItem[], guestName?: string, tableNumber?: string) => KDSTicket;
  clearCompleted: () => void;
}

const KDSContext = createContext<KDSContextType | undefined>(undefined);

// Pacing calculation logic:
// Finds the maximum cook_time_minutes in the order (the Anchor).
// Any item with less cook_time starts in 'QUEUED' with delaySeconds = (anchor - item_time) * 60.
// Once delay reaches 0, the item status changes to 'COOKING' and its cooking countdown begins.
export function buildPacedTicket(
  selectedItems: MenuItem[],
  source: OrderSource = 'DINE_IN',
  guestName = 'Table Guest',
  tableNumber?: string
): KDSTicket {
  const orderNum = 'TKT-' + Math.floor(100 + Math.random() * 900);
  const anchorMinutes = Math.max(...selectedItems.map(i => i.cook_time_minutes), 1);
  const now = Date.now();

  const ticketItems: TicketItem[] = selectedItems.map((item, idx) => {
    const isAnchor = item.cook_time_minutes === anchorMinutes;
    // Delay before firing in seconds
    const delaySeconds = (anchorMinutes - item.cook_time_minutes) * 60;
    const timeRemainingSeconds = item.cook_time_minutes * 60;

    return {
      id: `${orderNum}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      item_id: item.item_id,
      item_name: item.item_name,
      description: item.description,
      price: item.price,
      station: item.station,
      cook_time_minutes: item.cook_time_minutes,
      dietary_tags: item.dietary_tags,
      status: delaySeconds === 0 ? 'COOKING' : 'QUEUED',
      delaySeconds,
      timeRemainingSeconds,
      isAnchor
    };
  });

  return {
    id: 'kds-' + Math.random().toString(36).slice(2, 9),
    orderNumber: orderNum,
    source,
    tableNumber: tableNumber || (source === 'DINE_IN' ? `T${Math.floor(1 + Math.random() * 8)}` : undefined),
    guestName,
    createdAt: now,
    elapsedSeconds: 0,
    targetReadyTime: now + anchorMinutes * 60 * 1000,
    totalAnchorMinutes: anchorMinutes,
    items: ticketItems,
    status: 'IN_PROGRESS'
  };
}

export function KDSProvider({ children }: { children: React.ReactNode }) {
  const [tickets, setTickets] = useState<KDSTicket[]>(() => {
    // Seed with 3 realistic active tickets
    const t1 = buildPacedTicket(
      [MENU_MATRIX[5], MENU_MATRIX[3]], // Wings (12m Anchor) + Margherita Pizza (3m, 9m hold)
      'DINE_IN',
      'Sarah Jenkins',
      'T2'
    );
    const t2 = buildPacedTicket(
      [MENU_MATRIX[0], MENU_MATRIX[6]], // Pho Bo (6m) + Calamari (8m Anchor)
      'DOORDASH',
      'DoorDash #8821'
    );
    const t3 = buildPacedTicket(
      [MENU_MATRIX[4], MENU_MATRIX[2]], // Katsu Burger (10m Anchor) + Brisket Kimchi Pizza (4m, 6m hold)
      'VOICE_CALL',
      'Marcus Brody (Phone Order)'
    );

    return [t1, t2, t3];
  });

  const [completedTickets, setCompletedTickets] = useState<KDSTicket[]>([]);

  // 1-Second Precision Pacing Ticking Engine
  useEffect(() => {
    const timer = setInterval(() => {
      setTickets(prevTickets => {
        return prevTickets.map(ticket => {
          if (ticket.status === 'COMPLETED' || ticket.status === 'BUMPED') {
            return ticket;
          }

          let allItemsReady = true;

          const updatedItems = ticket.items.map(item => {
            if (item.status === 'READY') {
              return item;
            }

            allItemsReady = false;

            // If item is currently QUEUED (held by Pacing Engine)
            if (item.status === 'QUEUED') {
              if (item.delaySeconds > 1) {
                return { ...item, delaySeconds: item.delaySeconds - 1 };
              } else {
                // Hold timer expired! Fire into COOKING
                return {
                  ...item,
                  status: 'COOKING' as const,
                  delaySeconds: 0
                };
              }
            }

            // If item is active COOKING
            if (item.status === 'COOKING') {
              if (item.timeRemainingSeconds > 1) {
                return { ...item, timeRemainingSeconds: item.timeRemainingSeconds - 1 };
              } else {
                // Cook timer completed!
                return {
                  ...item,
                  status: 'READY' as const,
                  timeRemainingSeconds: 0
                };
              }
            }

            return item;
          });

          const newTicketStatus = allItemsReady ? 'EXPEDITE_READY' : 'IN_PROGRESS';

          return {
            ...ticket,
            elapsedSeconds: ticket.elapsedSeconds + 1,
            items: updatedItems,
            status: newTicketStatus
          };
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Capacity Throttling Metric: active tickets > 25
  const totalActiveOrders = tickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'BUMPED').length;
  const isThrottled = totalActiveOrders > 25;

  // Average ticket time calculation using tracked elapsedSeconds
  const averageTicketTimeMinutes = tickets.length > 0
    ? Math.round(
        tickets.reduce((acc, t) => acc + (t.elapsedSeconds / 60), 0) / tickets.length
      )
    : 0;

  // Expediter bumps entire ticket
  const bumpTicket = useCallback((ticketId: string) => {
    setTickets(prev => {
      const ticketToBump = prev.find(t => t.id === ticketId);
      if (ticketToBump) {
        setCompletedTickets(c => [{ ...ticketToBump, status: 'COMPLETED' }, ...c.slice(0, 19)]);
      }
      return prev.filter(t => t.id !== ticketId);
    });
  }, []);

  // Station cook bumps single item as ready
  const bumpItem = useCallback((ticketId: string, itemId: string) => {
    setTickets(prev =>
      prev.map(ticket => {
        if (ticket.id !== ticketId) return ticket;
        const updated = ticket.items.map(it => {
          if (it.id !== itemId) return it;
          return { ...it, status: 'READY' as const, timeRemainingSeconds: 0, delaySeconds: 0 };
        });
        const allReady = updated.every(i => i.status === 'READY');
        return {
          ...ticket,
          items: updated,
          status: allReady ? 'EXPEDITE_READY' : ticket.status
        };
      })
    );
  }, []);

  // Force-fire queued item immediately
  const fireItemImmediately = useCallback((ticketId: string, itemId: string) => {
    setTickets(prev =>
      prev.map(ticket => {
        if (ticket.id !== ticketId) return ticket;
        const updated = ticket.items.map(it => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            status: 'COOKING' as const,
            delaySeconds: 0
          };
        });
        return { ...ticket, items: updated };
      })
    );
  }, []);

  // Create new inbound order (from Voice Concierge, Delivery API, or Simulator)
  const createInboundOrder = useCallback(
    (source: OrderSource = 'DINE_IN', customItems?: MenuItem[], guestName?: string, tableNumber?: string) => {
      const itemsToUse = customItems && customItems.length > 0
        ? customItems
        : [
            MENU_MATRIX[Math.floor(Math.random() * MENU_MATRIX.length)],
            MENU_MATRIX[Math.floor(Math.random() * MENU_MATRIX.length)]
          ];

      const newTicket = buildPacedTicket(itemsToUse, source, guestName, tableNumber);
      setTickets(prev => [newTicket, ...prev]);
      return newTicket;
    },
    []
  );

  const clearCompleted = useCallback(() => {
    setCompletedTickets([]);
  }, []);

  return (
    <KDSContext.Provider
      value={{
        tickets,
        completedTickets,
        totalActiveOrders,
        averageTicketTimeMinutes,
        isThrottled,
        bumpTicket,
        bumpItem,
        fireItemImmediately,
        createInboundOrder,
        clearCompleted
      }}
    >
      {children}
    </KDSContext.Provider>
  );
}

export function useKDS() {
  const context = useContext(KDSContext);
  if (!context) {
    throw new Error('useKDS must be used within a KDSProvider');
  }
  return context;
}
