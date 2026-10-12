'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { compilePrompt, OwnerPersonaConfig, MenuItemPromptData } from './promptCompiler';

export interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  stage?: 'AVAILABLE' | 'LOCKED' | 'SEATED' | 'APPS_FIRED' | 'MAINS_CLEARED' | 'CHECK_DROPPED' | 'BUSSING_NEEDED';
  type: 'TABLE' | 'BOOTH' | 'BAR';
  table_category: 'Private' | 'Communal' | 'Bar';
  x: number;
  y: number;
  w: number;
  h: number;
  adjacentTo?: string[];
}

export interface OwnerMenuItem {
  item_id: string;
  venue?: string;
  item_name: string;
  description: string;
  price: number;
  station: 'Noodle Line' | 'Pizza Oven' | 'Grill' | 'Fryer' | 'Bar' | 'Salad Pantry';
  cook_time_minutes: number;
  dietary_tags: string[];
  is_86?: boolean;
  ai_description?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  label: string;
  tone: string;
  previewPhrase: string;
  pitch: string;
}

export const GEMINI_LIVE_VOICES: VoiceOption[] = [
  {
    id: 'Leda',
    name: 'Leda',
    gender: 'Female',
    label: 'Leda - Warm Female',
    tone: 'Welcoming, empathetic, lively Canadian host',
    previewPhrase: "Hi there! Welcome to leed pizza on Main. Looking for a table or checking out our fresh hot pizza list?",
    pitch: 'Gentle Warm Alto'
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'Male',
    label: 'Puck - Energetic Male',
    tone: 'Brisk, upbeat, modern hospitality cadence',
    previewPhrase: "Welcome to leed pizza Main St! I've got your table ready or can set up takeout right away.",
    pitch: 'Natural High-Tenor'
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'Female',
    label: 'Aoede - Professional Female',
    tone: 'Crisp, articulate, polished concierge',
    previewPhrase: "Good evening. Welcome to leed pizza. Allow me to assist with dinner reservations and artisan pairings tonight.",
    pitch: 'Polished Alto'
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'Male',
    label: 'Charon - Deep Male',
    tone: 'Calm, authoritative, warm baritone',
    previewPhrase: "Hey there, thanks for checking in with leed pizza on Main. Let's get your party situated.",
    pitch: 'Deep Resonant Baritone'
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'Female',
    label: 'Kore - Calming Female',
    tone: 'Warm, relaxed, friendly neighborhood vibe',
    previewPhrase: "Thanks for calling leed pizza! So happy to help you with dinner or fresh pizza takeout.",
    pitch: 'Warm Melodic Soprano'
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    label: 'Fenrir - Authoritative Male',
    tone: 'Sharp, executive, focused sommelier demeanor',
    previewPhrase: "leed pizza floor command. Let's secure your seating or fire an order into the kitchen.",
    pitch: 'Crisp Mid-Baritone'
  }
];

interface OwnerConfigContextType {
  ownerConfig: OwnerPersonaConfig & { voice_label?: string; last_deployed_at?: string };
  updateOwnerConfig: (partial: Partial<OwnerPersonaConfig>) => void;
  selectedVoice: VoiceOption;
  setSelectedVoice: (voice: VoiceOption) => void;
  
  floorTables: FloorTable[];
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  addTable: (table?: Partial<FloorTable>) => void;
  updateTable: (id: string, partial: Partial<FloorTable>) => void;
  removeTable: (id: string) => void;
  
  menuItems: OwnerMenuItem[];
  addMenuItem: (item: Omit<OwnerMenuItem, 'item_id'>) => void;
  updateMenuItem: (itemId: string, partial: Partial<OwnerMenuItem>) => void;
  removeMenuItem: (itemId: string) => void;
  toggle86: (itemId: string) => void;
  bulkImportMenuItems: (items: OwnerMenuItem[]) => void;
  
  hasUnsavedChanges: boolean;
  isDeploying: boolean;
  deploySuccess: boolean;
  lastDeployedMessage: string | null;
  compiledPrompt: string;
  saveAndDeploy: () => Promise<boolean>;
  resetToDefaults: () => void;
}

const DEFAULT_CONFIG: OwnerPersonaConfig & { voice_label: string; last_deployed_at: string; venue: string } = {
  restaurant_name: 'leed pizza',
  greeting: 'Thanks for calling leed pizza, this is your virtual host, how can I help you today?',
  tone: 'Lively & Casual',
  voice_name: 'Leda',
  voice_label: 'Leda - Warm Female',
  canadian_dialect: true,
  venue: 'leed pizza Main St',
  last_deployed_at: new Date().toISOString()
};

const DEFAULT_TABLES: FloorTable[] = [
  { id: 'B1', label: 'Booth 1', capacity: 6, stage: 'AVAILABLE', type: 'BOOTH', table_category: 'Private', x: 6, y: 10, w: 16, h: 22, adjacentTo: [] },
  { id: 'B2', label: 'Booth 2', capacity: 6, stage: 'SEATED', type: 'BOOTH', table_category: 'Private', x: 6, y: 38, w: 16, h: 22, adjacentTo: [] },
  { id: 'B3', label: 'Booth 3', capacity: 6, stage: 'AVAILABLE', type: 'BOOTH', table_category: 'Private', x: 6, y: 66, w: 16, h: 22, adjacentTo: [] },
  { id: 'T1', label: 'Table 1', capacity: 2, stage: 'AVAILABLE', type: 'TABLE', table_category: 'Private', x: 30, y: 14, w: 12, h: 14, adjacentTo: ['T2'] },
  { id: 'T2', label: 'Table 2', capacity: 2, stage: 'AVAILABLE', type: 'TABLE', table_category: 'Private', x: 46, y: 14, w: 12, h: 14, adjacentTo: ['T1'] },
  { id: 'T3', label: 'Table 3', capacity: 4, stage: 'APPS_FIRED', type: 'TABLE', table_category: 'Private', x: 30, y: 38, w: 13, h: 16, adjacentTo: ['T4'] },
  { id: 'T4', label: 'Table 4', capacity: 4, stage: 'AVAILABLE', type: 'TABLE', table_category: 'Private', x: 46, y: 38, w: 13, h: 16, adjacentTo: ['T3'] },
  { id: 'T5', label: 'Table 5', capacity: 8, stage: 'CHECK_DROPPED', type: 'TABLE', table_category: 'Communal', x: 30, y: 64, w: 28, h: 18, adjacentTo: [] },
  { id: 'Bar1', label: 'Bar 1', capacity: 1, stage: 'SEATED', type: 'BAR', table_category: 'Bar', x: 76, y: 10, w: 9, h: 10, adjacentTo: [] },
  { id: 'Bar2', label: 'Bar 2', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 23, w: 9, h: 10, adjacentTo: [] },
  { id: 'Bar3', label: 'Bar 3', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 36, w: 9, h: 10, adjacentTo: [] },
  { id: 'Bar4', label: 'Bar 4', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 49, w: 9, h: 10, adjacentTo: [] },
  { id: 'Bar5', label: 'Bar 5', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 62, w: 9, h: 10, adjacentTo: [] },
  { id: 'Bar6', label: 'Bar 6', capacity: 1, stage: 'AVAILABLE', type: 'BAR', table_category: 'Bar', x: 76, y: 75, w: 9, h: 10, adjacentTo: [] }
];

const DEFAULT_MENU: OwnerMenuItem[] = [
  {
    item_id: "LP_PEPPERONI",
    venue: "leed pizza Main St",
    item_name: "Classic Pepperoni Pizza",
    description: "Crispy cups, mozzarella, hot honey drizzle, fresh basil on sourdough crust",
    price: 20.50,
    station: "Pizza Oven",
    cook_time_minutes: 4,
    dietary_tags: ["Popular"],
    ai_description: "Our signature pizza with crispy cupping pepperoni, aged mozzarella, and spicy-sweet hot honey."
  },
  {
    item_id: "LP_MARGHERITA",
    venue: "leed pizza Main St",
    item_name: "Margherita Pizza",
    description: "San Marzano DOP tomato sauce, fresh fior di latte mozzarella, sweet basil, EVOO",
    price: 18.75,
    station: "Pizza Oven",
    cook_time_minutes: 3,
    dietary_tags: ["Vegetarian"],
    ai_description: "Traditional wood-fired Neapolitan style with sweet Italian basil and vibrant tomato sauce."
  },
  {
    item_id: "LP_TRUFFLE_MUSHROOM",
    venue: "leed pizza Main St",
    item_name: "Truffle Wild Mushroom Pizza",
    description: "Roasted cremini & oyster mushrooms, fontina, white truffle oil, fresh thyme",
    price: 22.00,
    station: "Pizza Oven",
    cook_time_minutes: 4,
    dietary_tags: ["Vegetarian"],
    ai_description: "Rich, aromatic, and savory with melted fontina cheese and cold-pressed white truffle oil."
  },
  {
    item_id: "LP_HOT_HONEY_WINGS",
    venue: "leed pizza Main St",
    item_name: "Hot Honey Garlic Wings",
    description: "Crispy double-dredged chicken wings tossed in garlic hot honey reduction",
    price: 16.50,
    station: "Fryer",
    cook_time_minutes: 10,
    dietary_tags: ["Gluten-Free Available"],
    ai_description: "Crispy and juicy with the perfect harmony of fiery habanero warmth and clover honey."
  },
  {
    item_id: "LP_CAESAR_SALAD",
    venue: "leed pizza Main St",
    item_name: "Tuscan Caesar Salad",
    description: "Crisp romaine hearts, shaved 24-month pecorino romano, sourdough crisps, house emulsion",
    price: 14.00,
    station: "Salad Pantry",
    cook_time_minutes: 2,
    dietary_tags: ["Vegetarian"],
    ai_description: "Crisp, bright starter salad with savoury umami dressing."
  },
  {
    item_id: "LP_CALAMARI",
    venue: "leed pizza Main St",
    item_name: "Crispy Salt & Pepper Calamari",
    description: "Flash-fried squid with charred citrus aioli, fresh jalapeño rings, and smoked sea salt",
    price: 18.00,
    station: "Fryer",
    cook_time_minutes: 6,
    dietary_tags: ["Pescatarian"],
    ai_description: "Tender flash-fried calamari with crispy coating and tangy house aioli."
  },
  {
    item_id: "LP_CRAFT_IPA",
    venue: "leed pizza Main St",
    item_name: "House Hazy IPA Pint",
    description: "Fresh local draft IPA with tropical citrus notes",
    price: 8.50,
    station: "Bar",
    cook_time_minutes: 1,
    dietary_tags: ["Alcohol"],
    ai_description: "Refreshing and fruity local IPA that cuts through rich cheese and pepperoni."
  }
];

const OwnerConfigContext = createContext<OwnerConfigContextType | null>(null);

export function OwnerConfigProvider({ children }: { children: React.ReactNode }) {
  const [ownerConfig, setOwnerConfig] = useState(DEFAULT_CONFIG);
  const [floorTables, setFloorTables] = useState<FloorTable[]>(DEFAULT_TABLES);
  const [menuItems, setMenuItems] = useState<OwnerMenuItem[]>(DEFAULT_MENU);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [lastDeployedMessage, setLastDeployedMessage] = useState<string | null>(null);

  // Load from API on mount
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await fetch('/api/owner/config');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && isMounted) {
          if (data.config) {
            setOwnerConfig(prev => ({
              ...prev,
              ...data.config,
              restaurant_name: data.config.restaurant_name || 'leed pizza',
              venue: data.config.venue || `${data.config.restaurant_name || 'leed pizza'} Main St`
            }));
          }
          if (Array.isArray(data.floorTables) && data.floorTables.length > 0) {
            setFloorTables(data.floorTables);
          }
          if (Array.isArray(data.menuItems) && data.menuItems.length > 0) {
            setMenuItems(data.menuItems);
          }
        }
      } catch (err) {
        console.warn("Could not fetch remote config, using defaults", err);
      }
    }
    loadConfig();
    return () => { isMounted = false; };
  }, []);

  const selectedVoice = useMemo(() => {
    return GEMINI_LIVE_VOICES.find(v => v.id === ownerConfig.voice_name) || GEMINI_LIVE_VOICES[0];
  }, [ownerConfig.voice_name]);

  const setSelectedVoice = useCallback((voice: VoiceOption) => {
    setOwnerConfig(prev => ({
      ...prev,
      voice_name: voice.id,
      voice_label: voice.label
    }));
    setHasUnsavedChanges(true);
  }, []);

  const updateOwnerConfig = useCallback((partial: Partial<OwnerPersonaConfig>) => {
    setOwnerConfig(prev => {
      const updated = { ...prev, ...partial };
      if (partial.restaurant_name && !partial.venue) {
        updated.venue = `${partial.restaurant_name} Main St`;
      }
      return updated;
    });
    setHasUnsavedChanges(true);
  }, []);

  // Floor Table operations
  const addTable = useCallback((preset?: Partial<FloorTable>) => {
    setFloorTables(prev => {
      const nextIndex = prev.length + 1;
      const type = preset?.type || 'TABLE';
      const category = preset?.table_category || (type === 'BAR' ? 'Bar' : 'Private');
      const defaultCapacity = type === 'BOOTH' ? 6 : type === 'BAR' ? 1 : 4;
      
      const newTable: FloorTable = {
        id: preset?.id || `${type === 'BOOTH' ? 'B' : type === 'BAR' ? 'Bar' : 'T'}${nextIndex}`,
        label: preset?.label || `${type === 'BOOTH' ? 'Booth' : type === 'BAR' ? 'Bar' : 'Table'} ${nextIndex}`,
        capacity: preset?.capacity || defaultCapacity,
        stage: 'AVAILABLE',
        type,
        table_category: category,
        x: preset?.x ?? (20 + (nextIndex % 5) * 12),
        y: preset?.y ?? (20 + Math.floor(nextIndex / 5) * 15),
        w: preset?.w ?? (type === 'BOOTH' ? 16 : type === 'BAR' ? 8 : 12),
        h: preset?.h ?? (type === 'BOOTH' ? 20 : type === 'BAR' ? 10 : 14),
        adjacentTo: preset?.adjacentTo || []
      };
      return [...prev, newTable];
    });
    setHasUnsavedChanges(true);
  }, []);

  const updateTable = useCallback((id: string, partial: Partial<FloorTable>) => {
    setFloorTables(prev => prev.map(table => {
      if (table.id !== id) return table;
      return { ...table, ...partial };
    }));
    setHasUnsavedChanges(true);
  }, []);

  const removeTable = useCallback((id: string) => {
    setFloorTables(prev => prev.filter(t => t.id !== id));
    if (selectedTableId === id) setSelectedTableId(null);
    setHasUnsavedChanges(true);
  }, [selectedTableId]);

  // Menu operations
  const addMenuItem = useCallback((item: Omit<OwnerMenuItem, 'item_id'>) => {
    const slug = item.item_name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 12);
    const newId = `LP_CUSTOM_${slug}_${Math.floor(100 + Math.random() * 900)}`;
    const newItem: OwnerMenuItem = {
      ...item,
      item_id: newId,
      venue: ownerConfig.venue || `${ownerConfig.restaurant_name} Main St`
    };
    setMenuItems(prev => [newItem, ...prev]);
    setHasUnsavedChanges(true);
  }, [ownerConfig.venue, ownerConfig.restaurant_name]);

  const updateMenuItem = useCallback((itemId: string, partial: Partial<OwnerMenuItem>) => {
    setMenuItems(prev => prev.map(i => {
      if (i.item_id !== itemId) return i;
      return { ...i, ...partial };
    }));
    setHasUnsavedChanges(true);
  }, []);

  const removeMenuItem = useCallback((itemId: string) => {
    setMenuItems(prev => prev.filter(i => i.item_id !== itemId));
    setHasUnsavedChanges(true);
  }, []);

  const toggle86 = useCallback((itemId: string) => {
    setMenuItems(prev => prev.map(i => {
      if (i.item_id !== itemId) return i;
      return { ...i, is_86: !i.is_86 };
    }));
    setHasUnsavedChanges(true);
  }, []);

  const bulkImportMenuItems = useCallback((newItems: OwnerMenuItem[]) => {
    setMenuItems(prev => {
      const existingIds = new Set(prev.map(i => i.item_id));
      const filtered = newItems.filter(i => !existingIds.has(i.item_id));
      return [...filtered, ...prev];
    });
    setHasUnsavedChanges(true);
  }, []);

  // Dynamic system instruction compiled in real-time
  const compiledPrompt = useMemo(() => {
    return compilePrompt(ownerConfig, menuItems, floorTables);
  }, [ownerConfig, menuItems, floorTables]);

  // Save & Deploy
  const saveAndDeploy = useCallback(async (): Promise<boolean> => {
    setIsDeploying(true);
    setDeploySuccess(false);
    
    try {
      const res = await fetch('/api/owner/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: ownerConfig,
          floorTables,
          menuItems
        })
      });

      const data = await res.json();
      if (data.success) {
        setHasUnsavedChanges(false);
        setDeploySuccess(true);
        setLastDeployedMessage(`Live Voice AI, Floor Grid (${floorTables.length} tables), and Menu (${menuItems.length} items) compiled successfully into SQLite.`);
        
        setTimeout(() => setDeploySuccess(false), 4000);
        return true;
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err: any) {
      console.error('Deploy error', err);
      setLastDeployedMessage(err?.message || 'Deployment error occurred');
      return false;
    } finally {
      setIsDeploying(false);
    }
  }, [ownerConfig, floorTables, menuItems]);

  const resetToDefaults = useCallback(() => {
    setOwnerConfig(DEFAULT_CONFIG);
    setFloorTables(DEFAULT_TABLES);
    setMenuItems(DEFAULT_MENU);
    setHasUnsavedChanges(true);
  }, []);

  return (
    <OwnerConfigContext.Provider
      value={{
        ownerConfig,
        updateOwnerConfig,
        selectedVoice,
        setSelectedVoice,
        floorTables,
        selectedTableId,
        setSelectedTableId,
        addTable,
        updateTable,
        removeTable,
        menuItems,
        addMenuItem,
        updateMenuItem,
        removeMenuItem,
        toggle86,
        bulkImportMenuItems,
        hasUnsavedChanges,
        isDeploying,
        deploySuccess,
        lastDeployedMessage,
        compiledPrompt,
        saveAndDeploy,
        resetToDefaults
      }}
    >
      {children}
    </OwnerConfigContext.Provider>
  );
}

export function useOwnerConfig() {
  const ctx = useContext(OwnerConfigContext);
  if (!ctx) {
    throw new Error('useOwnerConfig must be used within an OwnerConfigProvider');
  }
  return ctx;
}
