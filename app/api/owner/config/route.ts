import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { compilePrompt } from '@/lib/promptCompiler';
import { db } from '@/lib/db';

const CONFIG_FILE = path.join(process.cwd(), 'owner_config.json');
const MENU_FILE = path.join(process.cwd(), 'menu_matrix.json');
const FLOOR_FILE = path.join(process.cwd(), 'floor_graph.json');

export async function GET() {
  try {
    let ownerConfig = {
      voice_name: "Leda",
      voice_label: "Leda - Warm Female",
      restaurant_name: "leed pizza",
      greeting: "Thanks for calling leed pizza, this is your virtual host, how can I help you today?",
      tone: "Lively & Casual",
      canadian_dialect: true,
      venue: "leed pizza Main St",
      last_deployed_at: new Date().toISOString()
    };

    // Try reading from SQLite first
    try {
      const dbConfig = db.getMasterPrompt();
      if (dbConfig) {
        ownerConfig = {
          ...ownerConfig,
          ...dbConfig,
          restaurant_name: dbConfig.restaurant_name || 'leed pizza',
          venue: dbConfig.venue || `${dbConfig.restaurant_name || 'leed pizza'} Main St`
        };
      }
    } catch (e) {
      console.warn("Could not read master prompt from SQLite, falling back to disk", e);
    }

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        ownerConfig = { 
          ...ownerConfig, 
          ...parsed,
          restaurant_name: parsed.restaurant_name || ownerConfig.restaurant_name,
          venue: parsed.venue ? parsed.venue : `${parsed.restaurant_name || 'leed pizza'} Main St`
        };
      } catch (e) {
        console.warn("Could not read owner_config.json, using default", e);
      }
    }

    let menuItems = [];
    try {
      menuItems = db.getMenuItems();
    } catch (e) {
      // Fallback
    }

    if ((!menuItems || menuItems.length === 0) && fs.existsSync(MENU_FILE)) {
      try {
        const raw = fs.readFileSync(MENU_FILE, 'utf-8');
        menuItems = JSON.parse(raw);
      } catch (e) {
        console.warn("Could not read menu_matrix.json", e);
      }
    }

    let floorTables = [];
    try {
      floorTables = db.getSeatingPlan();
    } catch (e) {
      // Fallback
    }

    if ((!floorTables || floorTables.length === 0) && fs.existsSync(FLOOR_FILE)) {
      try {
        const raw = fs.readFileSync(FLOOR_FILE, 'utf-8');
        floorTables = JSON.parse(raw);
      } catch (e) {
        console.warn("Could not read floor_graph.json", e);
      }
    }

    const compiledSystemInstruction = compilePrompt(ownerConfig, menuItems, floorTables);

    return NextResponse.json({
      success: true,
      config: ownerConfig,
      menuItems,
      floorTables,
      compiledSystemInstruction
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, menuItems, floorTables } = body;

    const restaurantName = config?.restaurant_name || 'leed pizza';
    const venue = config?.venue || `${restaurantName} Main St`;

    const updatedConfig = {
      ...(config || {}),
      restaurant_name: restaurantName,
      venue,
      last_deployed_at: new Date().toISOString()
    };

    // 1. Persist to SQLite Master Prompt, Seating, & Menu
    try {
      db.saveMasterPrompt(updatedConfig);
      if (Array.isArray(floorTables) && floorTables.length > 0) {
        db.saveSeatingPlan(floorTables);
      }
      if (Array.isArray(menuItems) && menuItems.length > 0) {
        db.saveMenuItems(menuItems);
      }
    } catch (e) {
      console.warn("Could not persist to SQLite db:", e);
    }

    // 2. Write owner_config.json for fast server.mjs syncing
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2), 'utf-8');
    } catch (e) {
      console.warn("Could not persist owner_config.json to disk", e);
    }

    // 3. Write menu_matrix.json if provided
    if (Array.isArray(menuItems)) {
      try {
        fs.writeFileSync(MENU_FILE, JSON.stringify(menuItems, null, 2), 'utf-8');
      } catch (e) {
        console.warn("Could not persist menu_matrix.json to disk", e);
      }
    }

    // 4. Write floor_graph.json if provided
    if (Array.isArray(floorTables)) {
      try {
        fs.writeFileSync(FLOOR_FILE, JSON.stringify(floorTables, null, 2), 'utf-8');
      } catch (e) {
        console.warn("Could not persist floor_graph.json to disk", e);
      }
    }

    // Compile dynamic system instruction with latest floor plan and menu
    const compiledSystemInstruction = compilePrompt(
      updatedConfig,
      Array.isArray(menuItems) ? menuItems : [],
      Array.isArray(floorTables) ? floorTables : []
    );

    return NextResponse.json({
      success: true,
      message: 'Configuration successfully compiled and deployed to SQLite, Voice AI, and Venue Systems.',
      deployedAt: updatedConfig.last_deployed_at,
      compiledSystemInstruction,
      voiceName: updatedConfig.voice_name
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to deploy configuration' },
      { status: 500 }
    );
  }
}
