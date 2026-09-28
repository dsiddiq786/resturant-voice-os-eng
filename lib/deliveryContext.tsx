'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  DeliveryOrder, 
  DeliveryPlatform, 
  DeliveryOrderItem, 
  MENU_MATRIX, 
  MenuItem, 
  CourierInfo 
} from '@/lib/menuMatrix';
import { useKDS } from '@/lib/kdsContext';

interface DeliveryContextType {
  deliveryOrders: DeliveryOrder[];
  completedDeliveries: DeliveryOrder[];
  platformStatus: Record<DeliveryPlatform, 'ACTIVE' | 'PAUSED'>;
  killSwitchEngaged: boolean;
  killSwitchAuditLog: Array<{ timestamp: string; message: string; type: 'AUTO' | 'MANUAL' | 'INFO' }>;
  shiftGMV: number;
  activeDeliveryCount: number;
  togglePlatformStatus: (platform: DeliveryPlatform) => void;
  triggerKillSwitchManual: (engage: boolean) => void;
  simulateWebhook: (platform: DeliveryPlatform, customPayload?: any) => Promise<DeliveryOrder>;
  acceptOrderToKitchen: (orderId: string) => void;
  markPacked: (orderId: string) => void;
  markHandedToDriver: (orderId: string) => void;
  clearDispatched: () => void;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

const SEED_DELIVERIES: DeliveryOrder[] = [
  {
    id: 'del-ub-1029',
    orderNumber: 'UBER-1029',
    platform: 'UBEREATS',
    customerName: 'Marcus Tremblay',
    customerPhone: '+1 (604) 555-8912',
    deliveryAddress: '2840 Main St, Apt 4B',
    items: [
      {
        item_id: 'SS_PHO_BO',
        item_name: 'Pho Bo',
        quantity: 1,
        price: 18.25,
        station: 'Noodle Line',
        cook_time_minutes: 6,
        special_instructions: 'Extra cilantro & lime please'
      },
      {
        item_id: 'SS_PIZZA_MARGHERITA',
        item_name: 'Margherita Pizza',
        quantity: 1,
        price: 18.75,
        station: 'Pizza Oven',
        cook_time_minutes: 3
      }
    ],
    subtotal: 37.00,
    status: 'IN_KITCHEN',
    isPacked: false,
    courier: {
      name: 'Ali M.',
      phone: '+1 (604) 555-4019',
      vehicle: 'Silver Civic • 4.9★',
      etaMinutes: 4,
      etaSecondsRemaining: 240,
      status: 'EN_ROUTE'
    },
    createdAt: Date.now() - 320000,
    elapsedSeconds: 320,
    specialInstructions: 'Door code #4012, leave at front door'
  },
  {
    id: 'del-dd-5481',
    orderNumber: 'DD-5481',
    platform: 'DOORDASH',
    customerName: 'Claire Zhang',
    customerPhone: '+1 (604) 555-2281',
    deliveryAddress: '3105 E Broadway',
    items: [
      {
        item_id: 'SS_SNACK_WINGS',
        item_name: 'Wings',
        quantity: 2,
        price: 17.75,
        station: 'Fryer',
        cook_time_minutes: 12
      },
      {
        item_id: 'SS_BURG_KATSU',
        item_name: 'Katsu Chicken Burger',
        quantity: 1,
        price: 22.25,
        station: 'Grill',
        cook_time_minutes: 10
      }
    ],
    subtotal: 57.75,
    status: 'READY_FOR_DRIVER',
    isPacked: true,
    pickupShelf: 'BAY 2',
    courier: {
      name: 'Darren H.',
      phone: '+1 (604) 555-9014',
      vehicle: 'E-Bike • 5.0★',
      etaMinutes: 1,
      etaSecondsRemaining: 45,
      status: 'ARRIVED'
    },
    createdAt: Date.now() - 650000,
    elapsedSeconds: 650
  },
  {
    id: 'del-ub-8832',
    orderNumber: 'UBER-8832',
    platform: 'UBEREATS',
    customerName: 'Chloe Sutherland',
    customerPhone: '+1 (604) 555-7319',
    deliveryAddress: '155 W 8th Ave',
    items: [
      {
        item_id: 'SS_PIZZA_BRISKET',
        item_name: 'Brisket & Kimchi Pizza',
        quantity: 1,
        price: 21.25,
        station: 'Pizza Oven',
        cook_time_minutes: 4
      }
    ],
    subtotal: 21.25,
    status: 'NEW',
    isPacked: false,
    courier: {
      name: 'Assigning Courier...',
      phone: '',
      etaMinutes: 8,
      etaSecondsRemaining: 480,
      status: 'ASSIGNING'
    },
    createdAt: Date.now() - 45000,
    elapsedSeconds: 45
  }
];

export function DeliveryProvider({ children }: { children: React.ReactNode }) {
  const { totalActiveOrders, isThrottled, createInboundOrder } = useKDS();

  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>(SEED_DELIVERIES);
  const [completedDeliveries, setCompletedDeliveries] = useState<DeliveryOrder[]>([]);
  
  // Platform Status Switches: [UberEats: ACTIVE] [DoorDash: ACTIVE] [SkipTheDishes: PAUSED]
  const [platformStatus, setPlatformStatus] = useState<Record<DeliveryPlatform, 'ACTIVE' | 'PAUSED'>>({
    UBEREATS: 'ACTIVE',
    DOORDASH: 'ACTIVE',
    SKIPTHEDISHES: 'PAUSED'
  });

  const [killSwitchEngaged, setKillSwitchEngaged] = useState(false);
  const [killSwitchAuditLog, setKillSwitchAuditLog] = useState<Array<{ timestamp: string; message: string; type: 'AUTO' | 'MANUAL' | 'INFO' }>>([
    {
      timestamp: '14:05:22 PST',
      message: 'Delivery Gateway initialized. Listening for webhooks on /api/webhooks/delivery.',
      type: 'INFO'
    },
    {
      timestamp: '14:05:23 PST',
      message: 'SkipTheDishes platform set to PAUSED per shift policy.',
      type: 'INFO'
    }
  ]);

  const lastThrottledRef = useRef(false);

  // Auto-Throttling (The Kill Switch):
  // If active_kitchen_tickets > 25 (from Phase 3), the system triggers a simulated outbound API call
  // to toggle restaurant status to PAUSED on all third-party platforms to prevent kitchen crashes.
  useEffect(() => {
    if (isThrottled && !lastThrottledRef.current) {
      lastThrottledRef.current = true;
      setKillSwitchEngaged(true);

      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' PST';
      setKillSwitchAuditLog(prev => [
        {
          timestamp: nowStr,
          message: `KILL SWITCH AUTO-TRIGGERED: Active kitchen tickets exceeded 25 (${totalActiveOrders} active). Dispatched POST /v1/merchant/pause to UberEats, DoorDash, and SkipTheDishes.`,
          type: 'AUTO'
        },
        ...prev
      ]);

      // Outbound API call simulation to pause platforms
      setPlatformStatus({
        UBEREATS: 'PAUSED',
        DOORDASH: 'PAUSED',
        SKIPTHEDISHES: 'PAUSED'
      });
    } else if (!isThrottled && lastThrottledRef.current) {
      lastThrottledRef.current = false;
      setKillSwitchEngaged(false);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' PST';
      setKillSwitchAuditLog(prev => [
        {
          timestamp: nowStr,
          message: `CAPACITY RESTORED: Kitchen load dropped below threshold (${totalActiveOrders} active). Restored UberEats and DoorDash to ACTIVE.`,
          type: 'AUTO'
        },
        ...prev
      ]);

      setPlatformStatus({
        UBEREATS: 'ACTIVE',
        DOORDASH: 'ACTIVE',
        SKIPTHEDISHES: 'PAUSED'
      });
    }
  }, [isThrottled, totalActiveOrders]);

  // 1-Second Precision Timer for Delivery Tracking (Elapsed & Courier ETA)
  useEffect(() => {
    const timer = setInterval(() => {
      setDeliveryOrders(prev => {
        return prev.map(order => {
          if (order.status === 'HANDED_OFF') return order;

          const updatedElapsed = order.elapsedSeconds + 1;
          const remainingSecs = Math.max(0, order.courier.etaSecondsRemaining - 1);
          const minutesLeft = Math.ceil(remainingSecs / 60);

          let updatedCourierStatus = order.courier.status;
          if (remainingSecs <= 0 && order.courier.status !== 'ARRIVED') {
            updatedCourierStatus = 'ARRIVED';
          } else if (remainingSecs > 0 && order.courier.status === 'ASSIGNING' && updatedElapsed > 60) {
            updatedCourierStatus = 'EN_ROUTE';
          }

          return {
            ...order,
            elapsedSeconds: updatedElapsed,
            courier: {
              ...order.courier,
              etaSecondsRemaining: remainingSecs,
              etaMinutes: minutesLeft,
              status: updatedCourierStatus
            }
          };
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Toggle individual platform
  const togglePlatformStatus = useCallback((platform: DeliveryPlatform) => {
    setPlatformStatus(prev => {
      const nextStatus = prev[platform] === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' PST';
      setKillSwitchAuditLog(log => [
        {
          timestamp: nowStr,
          message: `Manual toggle: ${platform} set to ${nextStatus}. Outbound merchant update confirmed.`,
          type: 'MANUAL'
        },
        ...log
      ]);
      return {
        ...prev,
        [platform]: nextStatus
      };
    });
  }, []);

  // Manual kill switch toggle (for testing or emergency override)
  const triggerKillSwitchManual = useCallback((engage: boolean) => {
    setKillSwitchEngaged(engage);
    const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' PST';
    if (engage) {
      setPlatformStatus({
        UBEREATS: 'PAUSED',
        DOORDASH: 'PAUSED',
        SKIPTHEDISHES: 'PAUSED'
      });
      setKillSwitchAuditLog(log => [
        {
          timestamp: nowStr,
          message: 'MANUAL EMERGENCY KILL SWITCH ENGAGED: Dispatched emergency pause to all 3P delivery channels.',
          type: 'MANUAL'
        },
        ...log
      ]);
    } else {
      setPlatformStatus({
        UBEREATS: 'ACTIVE',
        DOORDASH: 'ACTIVE',
        SKIPTHEDISHES: 'PAUSED'
      });
      setKillSwitchAuditLog(log => [
        {
          timestamp: nowStr,
          message: 'MANUAL OVERRIDE DISENGAGED: Normal shift delivery operations resumed.',
          type: 'MANUAL'
        },
        ...log
      ]);
    }
  }, []);

  // Ingestion Engine / Webhook Simulation
  const simulateWebhook = useCallback(async (platform: DeliveryPlatform, customPayload?: any): Promise<DeliveryOrder> => {
    // Generate realistic multi-item order from leed pizza Menu Matrix
    const sampleCustomers = [
      { name: 'Sophie Beaulieu', phone: '+1 (604) 555-1194', addr: '3429 Main St' },
      { name: 'Liam MacIntyre', phone: '+1 (604) 555-4482', addr: '188 E 16th Ave' },
      { name: 'Priya Sharma', phone: '+1 (604) 555-9031', addr: '410 Kingsway' },
      { name: 'Nathaniel Cole', phone: '+1 (604) 555-7762', addr: '198 W 12th Ave' }
    ];
    const customer = sampleCustomers[Math.floor(Math.random() * sampleCustomers.length)];

    // Pick 1-3 items
    const itemCount = Math.random() > 0.5 ? 2 : 1;
    const shuffled = [...MENU_MATRIX].sort(() => 0.5 - Math.random()).slice(0, itemCount);

    const payload = customPayload || {
      platform,
      external_order_id: `${platform === 'UBEREATS' ? 'UBER' : platform === 'DOORDASH' ? 'DD' : 'SKIP'}-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: {
        name: customer.name,
        phone: customer.phone,
        address: customer.addr
      },
      items: shuffled.map(m => ({
        item_id: m.item_id,
        item_name: m.item_name,
        quantity: Math.random() > 0.7 ? 2 : 1
      })),
      driver_info: {
        name: platform === 'UBEREATS' ? 'Ali M.' : platform === 'DOORDASH' ? 'Carlos R.' : 'Sam K.',
        eta_minutes: Math.floor(4 + Math.random() * 6)
      }
    };

    let contract: any = null;

    try {
      // Call actual internal API endpoint to verify contract translation
      const res = await fetch('/api/webhooks/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        contract = json.contract;
      }
    } catch (e) {
      console.warn('Local API call failed, using client-side fallback normalization', e);
    }

    // Fallback normalization if API not reachable
    if (!contract) {
      const itemsMapped = shuffled.map(it => ({
        item_id: it.item_id,
        item_name: it.item_name,
        quantity: 1,
        price: it.price,
        station: it.station,
        cook_time_minutes: it.cook_time_minutes
      }));
      contract = {
        order_number: payload.external_order_id,
        platform,
        customer: payload.customer,
        items: itemsMapped,
        financials: {
          subtotal: itemsMapped.reduce((s, i) => s + i.price, 0)
        },
        courier: {
          name: payload.driver_info.name,
          eta_minutes: payload.driver_info.eta_minutes,
          status: 'EN_ROUTE'
        }
      };
    }

    // Map into DeliveryOrder format
    const deliveryItems: DeliveryOrderItem[] = contract.items.map((i: any) => ({
      item_id: i.item_id,
      item_name: i.item_name,
      quantity: i.quantity || 1,
      price: i.price,
      station: i.station,
      cook_time_minutes: i.cook_time_minutes,
      special_instructions: i.special_instructions
    }));

    const fullMenuItems: MenuItem[] = deliveryItems.flatMap(di => {
      const found = MENU_MATRIX.find(m => m.item_id === di.item_id);
      return found ? Array(di.quantity).fill(found) : [];
    });

    // Seamlessly Push to Phase 3 Kitchen Pacing Engine (KDS)
    const orderSourceMapping = platform as 'UBEREATS' | 'DOORDASH' | 'SKIPTHEDISHES';
    const kdsTicket = createInboundOrder(
      orderSourceMapping,
      fullMenuItems,
      `${contract.customer.name} (${platform})`
    );

    const etaMins = contract.courier?.eta_minutes || 6;

    const newDeliveryOrder: DeliveryOrder = {
      id: 'del-' + Math.random().toString(36).slice(2, 9),
      orderNumber: contract.order_number,
      platform,
      customerName: contract.customer.name,
      customerPhone: contract.customer.phone,
      deliveryAddress: contract.customer.address,
      items: deliveryItems,
      subtotal: contract.financials.subtotal,
      status: 'IN_KITCHEN', // Auto-accepted into kitchen queue
      isPacked: false,
      courier: {
        name: contract.courier.name,
        phone: contract.courier.phone || '+1 (604) 555-8833',
        vehicle: contract.courier.vehicle || 'Vehicle Dispatched',
        etaMinutes: etaMins,
        etaSecondsRemaining: etaMins * 60,
        status: 'EN_ROUTE'
      },
      createdAt: Date.now(),
      elapsedSeconds: 0,
      kdsTicketId: kdsTicket.id,
      specialInstructions: contract.special_instructions
    };

    setDeliveryOrders(prev => [newDeliveryOrder, ...prev]);

    const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' PST';
    setKillSwitchAuditLog(log => [
      {
        timestamp: nowStr,
        message: `WEBHOOK INGESTED: ${platform} order #${newDeliveryOrder.orderNumber} ($${newDeliveryOrder.subtotal.toFixed(2)}) routed to Kitchen Pacing Engine.`,
        type: 'INFO'
      },
      ...log
    ]);

    return newDeliveryOrder;
  }, [createInboundOrder]);

  // Accept Order to Kitchen
  const acceptOrderToKitchen = useCallback((orderId: string) => {
    setDeliveryOrders(prev =>
      prev.map(ord => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          status: 'IN_KITCHEN' as const
        };
      })
    );
  }, []);

  // Mark Packed (takeout packing station tape and shelf allocation)
  const markPacked = useCallback((orderId: string) => {
    const shelfOptions = ['BAY 1', 'BAY 2', 'BAY 3', 'HOT HOLD A', 'HOT HOLD B'];
    const assignedShelf = shelfOptions[Math.floor(Math.random() * shelfOptions.length)];

    setDeliveryOrders(prev =>
      prev.map(ord => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          isPacked: true,
          pickupShelf: assignedShelf,
          status: 'READY_FOR_DRIVER' as const
        };
      })
    );
  }, []);

  // Handed to Driver (dispatched)
  const markHandedToDriver = useCallback((orderId: string) => {
    setDeliveryOrders(prev => {
      const order = prev.find(o => o.id === orderId);
      if (order) {
        setCompletedDeliveries(c => [{ ...order, status: 'HANDED_OFF' }, ...c.slice(0, 19)]);
      }
      return prev.filter(o => o.id !== orderId);
    });
  }, []);

  const clearDispatched = useCallback(() => {
    setCompletedDeliveries([]);
  }, []);

  // Calculate Shift Metrics
  const activeOrdersList = deliveryOrders.filter(o => o.status !== 'HANDED_OFF');
  const activeDeliveryCount = activeOrdersList.length;

  const shiftGMV = Number(
    (
      deliveryOrders.reduce((sum, o) => sum + o.subtotal, 0) +
      completedDeliveries.reduce((sum, o) => sum + o.subtotal, 0) +
      1124.50 // Shift baseline
    ).toFixed(2)
  );

  return (
    <DeliveryContext.Provider
      value={{
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
        markHandedToDriver,
        clearDispatched
      }}
    >
      {children}
    </DeliveryContext.Provider>
  );
}

export function useDelivery() {
  const context = useContext(DeliveryContext);
  if (!context) {
    throw new Error('useDelivery must be used within a DeliveryProvider');
  }
  return context;
}
