export interface MenuItem {
  item_id: string;
  venue: string;
  item_name: string;
  description: string;
  price: number;
  station: 'Noodle Line' | 'Pizza Oven' | 'Grill' | 'Fryer' | 'Salad Pantry' | 'Bar';
  cook_time_minutes: number;
  dietary_tags: string[];
}

export interface TicketItem {
  id: string;
  item_id: string;
  item_name: string;
  description: string;
  price: number;
  station: 'Noodle Line' | 'Pizza Oven' | 'Grill' | 'Fryer' | 'Salad Pantry' | 'Bar';
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
    item_id: "LP_PEPPERONI",
    venue: "leed pizza Main St",
    item_name: "Classic Pepperoni Pizza",
    description: "Crispy cups, mozzarella, hot honey drizzle, fresh basil on sourdough crust",
    price: 20.50,
    station: "Pizza Oven",
    cook_time_minutes: 4,
    dietary_tags: ["Popular"]
  },
  {
    item_id: "LP_MARGHERITA",
    venue: "leed pizza Main St",
    item_name: "Margherita Pizza",
    description: "San Marzano DOP tomato sauce, fresh fior di latte mozzarella, sweet basil, EVOO",
    price: 18.75,
    station: "Pizza Oven",
    cook_time_minutes: 3,
    dietary_tags: ["Vegetarian"]
  },
  {
    item_id: "LP_TRUFFLE_MUSHROOM",
    venue: "leed pizza Main St",
    item_name: "Truffle Wild Mushroom Pizza",
    description: "Roasted cremini & oyster mushrooms, fontina, white truffle oil, fresh thyme",
    price: 22.00,
    station: "Pizza Oven",
    cook_time_minutes: 4,
    dietary_tags: ["Vegetarian"]
  },
  {
    item_id: "LP_HOT_HONEY_WINGS",
    venue: "leed pizza Main St",
    item_name: "Hot Honey Garlic Wings",
    description: "Crispy double-dredged chicken wings tossed in garlic hot honey reduction",
    price: 16.50,
    station: "Fryer",
    cook_time_minutes: 10,
    dietary_tags: ["Gluten-Free Available"]
  },
  {
    item_id: "LP_CAESAR_SALAD",
    venue: "leed pizza Main St",
    item_name: "Tuscan Caesar Salad",
    description: "Crisp romaine hearts, shaved 24-month pecorino romano, sourdough crisps",
    price: 14.00,
    station: "Salad Pantry",
    cook_time_minutes: 2,
    dietary_tags: ["Vegetarian"]
  },
  {
    item_id: "LP_CALAMARI",
    venue: "leed pizza Main St",
    item_name: "Crispy Salt & Pepper Calamari",
    description: "Flash-fried squid with charred citrus aioli and fresh jalapeño rings",
    price: 18.00,
    station: "Fryer",
    cook_time_minutes: 6,
    dietary_tags: ["Pescatarian"]
  },
  {
    item_id: "LP_CRAFT_IPA",
    venue: "leed pizza Main St",
    item_name: "House Hazy IPA Pint",
    description: "Fresh local draft IPA with tropical citrus notes",
    price: 8.50,
    station: "Bar",
    cook_time_minutes: 1,
    dietary_tags: ["Alcohol"]
  }
];

export const KITCHEN_STATIONS = [
  'Expo',
  'Pizza Oven',
  'Noodle Line',
  'Grill',
  'Fryer',
  'Salad Pantry',
  'Bar'
] as const;

export type KitchenStation = (typeof KITCHEN_STATIONS)[number];
