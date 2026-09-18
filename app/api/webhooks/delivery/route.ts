import { NextRequest, NextResponse } from 'next/server';
import menuMatrixData from '@/menu_matrix.json';

interface InboundWebhookPayload {
  platform?: 'UBEREATS' | 'DOORDASH' | 'SKIPTHEDISHES';
  external_order_id?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  items?: Array<{
    item_id?: string;
    item_name?: string;
    name?: string;
    quantity?: number;
    special_instructions?: string;
  }>;
  driver_info?: {
    name?: string;
    phone?: string;
    vehicle?: string;
    eta_minutes?: number;
  };
  special_instructions?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: InboundWebhookPayload = await req.json();

    const platform = (body.platform || 'UBEREATS').toUpperCase() as 'UBEREATS' | 'DOORDASH' | 'SKIPTHEDISHES';
    const orderId = body.external_order_id || `${platform.slice(0, 2)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const customer = {
      name: body.customer?.name || 'Third-Party Delivery Guest',
      phone: body.customer?.phone || '+1 (604) 555-0199',
      address: body.customer?.address || 'Main St Corridor, Vancouver, BC'
    };

    // Parse and match items against Single Source of Truth: menu_matrix.json
    const rawItems = body.items || [{ item_id: 'SS_PHO_BO', quantity: 1 }];
    const matchedItems = rawItems.map((rawItem, idx) => {
      const targetId = rawItem.item_id || '';
      const targetName = (rawItem.item_name || rawItem.name || '').toLowerCase();

      // Find in menuMatrixData
      const found = menuMatrixData.find(
        m => m.item_id === targetId || m.item_name.toLowerCase() === targetName || targetName.includes(m.item_name.toLowerCase())
      ) || menuMatrixData[idx % menuMatrixData.length];

      const qty = Math.max(1, rawItem.quantity || 1);

      return {
        item_id: found.item_id,
        item_name: found.item_name,
        quantity: qty,
        price: found.price,
        line_total: Number((found.price * qty).toFixed(2)),
        station: found.station,
        cook_time_minutes: found.cook_time_minutes,
        dietary_tags: found.dietary_tags,
        special_instructions: rawItem.special_instructions || ''
      };
    });

    const subtotal = Number(matchedItems.reduce((sum, it) => sum + it.line_total, 0).toFixed(2));
    const maxCookTime = Math.max(...matchedItems.map(i => i.cook_time_minutes), 1);
    const anchorItem = matchedItems.find(i => i.cook_time_minutes === maxCookTime) || matchedItems[0];

    const driverEta = body.driver_info?.eta_minutes ?? (Math.floor(4 + Math.random() * 8));
    const courier = {
      name: body.driver_info?.name || (platform === 'UBEREATS' ? 'Ali M. (UberEats)' : platform === 'DOORDASH' ? 'Carlos R. (DoorDash)' : 'Sam K. (Skip)'),
      phone: body.driver_info?.phone || '+1 (604) 555-7721',
      vehicle: body.driver_info?.vehicle || 'Toyota Corolla (Silver)',
      eta_minutes: driverEta,
      status: driverEta <= 1 ? 'ARRIVED' : 'EN_ROUTE'
    };

    // Unified Internal Order Contract
    const unifiedContract = {
      contract_version: "2.1",
      ingested_at: new Date().toISOString(),
      venue: "Sing Sing Main St",
      platform,
      order_number: orderId,
      customer,
      items: matchedItems,
      financials: {
        currency: "CAD",
        subtotal,
        tax: Number((subtotal * 0.05).toFixed(2)),
        platform_commission_estimated: Number((subtotal * 0.20).toFixed(2)),
        total_payout: Number((subtotal * 0.85).toFixed(2))
      },
      pacing_metadata: {
        anchor_station: anchorItem.station,
        anchor_item: anchorItem.item_name,
        longest_cook_minutes: maxCookTime,
        target_hand_off_time: new Date(Date.now() + maxCookTime * 60 * 1000).toISOString()
      },
      courier,
      special_instructions: body.special_instructions || ''
    };

    return NextResponse.json({
      success: true,
      message: `Delivery webhook successfully normalized from ${platform}`,
      contract: unifiedContract
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'Invalid webhook payload structure',
      details: err?.message
    }, { status: 400 });
  }
}
