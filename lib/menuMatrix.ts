export interface MenuItem {
  item_id: string;
  venue: string;
  item_name: string;
  description: string;
  price: number;
  station: 'Noodle Line' | 'Pizza Oven' | 'Grill' | 'Fryer';
  cook_time_minutes: number;
  dietary_tags: string[];
}

export interface TicketItem {
  id: string;
  item_id: string;
  item_name: string;
  description: string;
  price: number;
  station: 'Noodle Line' | 'Pizza Oven' | 'Grill' | 'Fryer';
  cook_time_minutes: number;
  dietary_tags: string[];
  
  // Pacing status per item
  status: 'QUEUED' | 'COOKING' | 'READY';
  delaySeconds: number; // Delay before firing
  timeRemainingSeconds: number; // Active cooking countdown
  isAnchor?: boolean;
}

export type OrderSource = 'VOICE_CALL' | 'DINE_IN' | 'DOORDASH' | 'UBEREATS' | 'SKIPTHEDISHES' | 'TOAST_POS';

export type DeliveryPlatform = 'UBEREATS' | 'DOORDASH' | 'SKIPTHEDISHES';

export interface CourierInfo {
  name: string;
  phone: string;
  vehicle?: string;
  etaMinutes: number;
  etaSecondsRemaining: number;
  status: 'ASSIGNING' | 'EN_ROUTE' | 'ARRIVED';
}

export interface DeliveryOrderItem {
  item_id: string;
  item_name: string;
  quantity: number;
  price: number;
  station: 'Noodle Line' | 'Pizza Oven' | 'Grill' | 'Fryer';
  cook_time_minutes: number;
  special_instructions?: string;
}

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  platform: DeliveryPlatform;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  items: DeliveryOrderItem[];
  subtotal: number;
  status: 'NEW' | 'IN_KITCHEN' | 'READY_FOR_DRIVER' | 'HANDED_OFF';
  isPacked: boolean;
  courier: CourierInfo;
  createdAt: number;
  elapsedSeconds: number;
  specialInstructions?: string;
  kdsTicketId?: string;
  pickupShelf?: string;
}

export interface KDSTicket {
  id: string;
  orderNumber: string;
  source: OrderSource;
  tableNumber?: string;
  guestName: string;
  createdAt: number;
  elapsedSeconds: number;
  targetReadyTime: number; // Target completion timestamp
  totalAnchorMinutes: number;
  items: TicketItem[];
  status: 'QUEUED' | 'IN_PROGRESS' | 'EXPEDITE_READY' | 'COMPLETED' | 'BUMPED';
  notes?: string;
}

export const MENU_MATRIX: MenuItem[] = [
  {
    item_id: "SS_PHO_BO",
    venue: "Sing Sing Main St",
    item_name: "Pho Bo",
    description: "Rare steak, beef brisket, bean sprouts, cilantro, green onion, basil, rice noodles",
    price: 18.25,
    station: "Noodle Line",
    cook_time_minutes: 6,
    dietary_tags: ["Dairy-Free"]
  },
  {
    item_id: "SS_PHO_GA",
    venue: "Sing Sing Main St",
    item_name: "Pho Ga",
    description: "Lemongrass chicken, quail eggs, bean sprouts, cilantro, green onion, basil, rice noodles",
    price: 17.75,
    station: "Noodle Line",
    cook_time_minutes: 6,
    dietary_tags: ["Dairy-Free"]
  },
  {
    item_id: "SS_PIZZA_BRISKET",
    venue: "Sing Sing Main St",
    item_name: "Brisket & Kimchi Pizza",
    description: "Hoisin, mozzarella, green onion, pickled onion, spicy mayo, sesame",
    price: 21.25,
    station: "Pizza Oven",
    cook_time_minutes: 4,
    dietary_tags: []
  },
  {
    item_id: "SS_PIZZA_MARGHERITA",
    venue: "Sing Sing Main St",
    item_name: "Margherita Pizza",
    description: "Mozzarella, tomato sauce, pesto, fresh basil",
    price: 18.75,
    station: "Pizza Oven",
    cook_time_minutes: 3,
    dietary_tags: ["Vegetarian"]
  },
  {
    item_id: "SS_BURG_KATSU",
    venue: "Sing Sing Main St",
    item_name: "Katsu Chicken Burger",
    description: "Crispy fried, bulldog sauce, cabbage, kewpie, potato roll",
    price: 22.25,
    station: "Grill",
    cook_time_minutes: 10,
    dietary_tags: []
  },
  {
    item_id: "SS_SNACK_WINGS",
    venue: "Sing Sing Main St",
    item_name: "Wings",
    description: "Red chili sauce, sriracha parm dip",
    price: 17.75,
    station: "Fryer",
    cook_time_minutes: 12,
    dietary_tags: []
  },
  {
    item_id: "SS_SNACK_CALAMARI",
    venue: "Sing Sing Main St",
    item_name: "Calamari",
    description: "Salsa verde, citrus, smoked paprika",
    price: 18.25,
    station: "Fryer",
    cook_time_minutes: 8,
    dietary_tags: ["Pescatarian"]
  }
];

export const KITCHEN_STATIONS = [
  'Expo',
  'Pizza Oven',
  'Noodle Line',
  'Grill',
  'Fryer'
] as const;

export type KitchenStation = (typeof KITCHEN_STATIONS)[number];
