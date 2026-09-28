import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const seating = db.getSeatingPlan();
    return NextResponse.json({ success: true, seating });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Batch update / save all tables
    if (Array.isArray(body.tables)) {
      db.saveSeatingPlan(body.tables);
      return NextResponse.json({ success: true, message: 'Seating plan saved to SQLite' });
    }

    // Single table update
    if (body.tableId) {
      db.updateTable(body.tableId, {
        stage: body.stage,
        occupant_name: body.occupantName,
        locked_until: body.lockedUntil,
        time_elapsed: body.timeElapsed
      });
      return NextResponse.json({ success: true, message: `Table ${body.tableId} updated in SQLite` });
    }

    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
