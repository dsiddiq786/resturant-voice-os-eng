import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compilePrompt } from '@/lib/promptCompiler';

export async function GET() {
  try {
    const config = db.getMasterPrompt();
    const menu = db.getMenuItems();
    const compiled = compilePrompt(
      {
        restaurant_name: config.restaurant_name,
        tone: config.tone,
        greeting: config.greeting,
        voice_name: config.voice_name,
        voice_label: config.voice_label,
        canadian_dialect: config.canadian_dialect,
        venue: config.venue,
        master_instructions: config.master_instructions,
        custom_rules: config.custom_rules
      },
      menu
    );

    return NextResponse.json({
      success: true,
      config,
      compiledPrompt: compiled
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    db.saveMasterPrompt({
      restaurant_name: body.restaurant_name || body.restaurantName || 'leed pizza',
      tone: body.tone || 'Lively & Casual',
      greeting: body.greeting || 'Thanks for calling leed pizza, this is your virtual host, how can I help you today?',
      voice_name: body.voice_name || body.voiceName || 'Leda',
      voice_label: body.voice_label || body.voiceLabel || 'Leda - Warm Female',
      canadian_dialect: body.canadian_dialect !== false,
      venue: body.venue || `${body.restaurant_name || 'leed pizza'} Main St`,
      master_instructions: body.master_instructions || body.masterInstructions || '',
      boundary_strictness: body.boundary_strictness !== false,
      green_light_enabled: body.green_light_enabled !== false,
      packed_house_policy: body.packed_house_policy || 'Pivot to communal seating, bar seating, or sister venue if 100% full',
      custom_rules: Array.isArray(body.custom_rules) ? body.custom_rules : []
    });

    const updated = db.getMasterPrompt();
    const menu = db.getMenuItems();
    const compiled = compilePrompt(
      {
        restaurant_name: updated.restaurant_name,
        tone: updated.tone,
        greeting: updated.greeting,
        voice_name: updated.voice_name,
        voice_label: updated.voice_label,
        canadian_dialect: updated.canadian_dialect,
        venue: updated.venue,
        master_instructions: updated.master_instructions,
        custom_rules: updated.custom_rules
      },
      menu
    );

    return NextResponse.json({
      success: true,
      message: 'Master system prompt updated in SQLite database',
      config: updated,
      compiledPrompt: compiled
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
