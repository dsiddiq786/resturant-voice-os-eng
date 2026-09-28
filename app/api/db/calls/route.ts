import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const call = db.getCallById(id);
      if (!call) {
        return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, call });
    }

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const calls = db.getCalls(limit);
    return NextResponse.json({ success: true, calls });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      body.id = 'CALL-' + Date.now();
    }

    db.createOrUpdateCall({
      id: body.id,
      caller_name: body.caller_name || body.callerName || 'Guest Caller',
      caller_phone: body.caller_phone || body.callerPhone || 'Caller ID Private',
      venue: body.venue || 'leed pizza Main St',
      start_time: body.start_time || body.startTime || new Date().toISOString(),
      end_time: body.end_time || body.endTime || new Date().toISOString(),
      duration_seconds: body.duration_seconds || body.durationSeconds || 0,
      status: body.status || 'completed',
      intent: body.intent || 'reservation',
      transcript: body.transcript || [],
      audio_data: body.audio_data || body.audioData || null,
      tool_calls: body.tool_calls || body.toolCalls || [],
      reservation_summary: body.reservation_summary || body.reservationSummary || null,
      order_summary: body.order_summary || body.orderSummary || null
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Call session and voice recording saved in SQLite database',
      callId: body.id
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
