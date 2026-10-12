import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requested = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 500) : 100;
    return NextResponse.json({ success: true, reservations: db.getReservations(limit) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Could not load reservations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action !== 'cancel' || typeof body?.id !== 'string') {
      return NextResponse.json({ success: false, error: 'Expected { action: "cancel", id }' }, { status: 400 });
    }
    const cancelled = db.cancelReservationById(body.id);
    if (!cancelled) {
      return NextResponse.json({ success: false, error: 'Reservation not found or already cancelled' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Could not update reservation' }, { status: 500 });
  }
}
