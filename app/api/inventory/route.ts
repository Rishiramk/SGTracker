import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface InventoryItem {
  id: string;
  barcode?: string;
  name: string;
  category?: string;
  quantity: number;
  unit?: string;
  expiry?: string;
  image_url?: string;
  notes?: string;
}

// In-memory fallback store for development/demo when Google credentials are not configured
let demoStore: InventoryItem[] = [
  { id: '1', barcode: '5449000000996', name: 'Coca-Cola Zero Sugar 1.5L', category: 'Pantry Staples > Oils & Sauces', quantity: 2, unit: 'bottle', expiry: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0], image_url: 'https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.3.200.jpg', notes: 'Keep chilled' },
  { id: '2', barcode: '', name: 'Fresh Milk', category: 'Dairy & Eggs > Milk', quantity: 3, unit: 'L', expiry: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0], notes: 'Whole milk' },
  { id: '3', barcode: '', name: 'Greek Yogurt', category: 'Dairy & Eggs > Yogurt', quantity: 500, unit: 'g', expiry: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0], notes: 'High protein' },
  { id: '4', barcode: '', name: 'Chicken Breast', category: 'Meat & Seafood > Poultry', quantity: 1, unit: 'kg', expiry: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], notes: 'Freezer tray' },
  { id: '5', barcode: '', name: 'Avocados', category: 'Produce > Fresh Fruit', quantity: 4, unit: 'pcs', expiry: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], notes: 'Ripe' },
];

function getGoogleSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim();

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.warn('[SGTracker API] Missing required env vars:', {
      hasEmail: !!clientEmail,
      hasKey: !!privateKey,
      hasSheetId: !!spreadsheetId,
    });
    return null;
  }

  // Strip leading and trailing double or single quotes if present (common when pasting into Vercel UI)
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1).trim();
  }

  // Replace literal '\n' characters with actual linebreaks
  const formattedKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: formattedKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    spreadsheetId,
  };
}

export async function GET() {
  try {
    const googleClient = getGoogleSheetsClient();

    if (!googleClient) {
      console.warn('[SGTracker API] GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, or GOOGLE_PRIVATE_KEY missing. Returning demo inventory.');
      return NextResponse.json({ items: demoStore, source: 'demo' });
    }

    const { sheets, spreadsheetId } = googleClient;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Inventory!A2:I',
    });

    const rows = response.data.values || [];

    const items: InventoryItem[] = rows.map((row, index) => {
      const id = row[0] ? String(row[0]) : `item-${index + 1}`;
      const barcode = row[1] ? String(row[1]) : '';
      const name = row[2] ? String(row[2]) : 'Unnamed Item';
      const category = row[3] ? String(row[3]) : 'Pantry Staples';
      const quantity = row[4] ? parseFloat(String(row[4])) || 0 : 0;
      const unit = row[5] ? String(row[5]) : '';
      const expiry = row[6] ? String(row[6]) : '';
      const image_url = row[7] ? String(row[7]) : '';
      const notes = row[8] ? String(row[8]) : '';

      return { id, barcode, name, category, quantity, unit, expiry, image_url, notes };
    });

    return NextResponse.json({ items, source: 'google_sheets' });
  } catch (error: any) {
    console.error('[SGTracker API GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory from Google Sheets', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: InventoryItem[] = Array.isArray(body) ? body : body.items || [];

    const googleClient = getGoogleSheetsClient();

    if (!googleClient) {
      console.warn('[SGTracker API] GOOGLE credentials missing. Updating demo memory store.');
      demoStore = items;
      return NextResponse.json({ success: true, count: items.length, source: 'demo' });
    }

    const { sheets, spreadsheetId } = googleClient;

    // Clear existing range Inventory!A2:I
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Inventory!A2:I',
    });

    // Bulk write new items if any exist
    if (items.length > 0) {
      const values = items.map((item) => [
        item.id || String(Date.now()),
        item.barcode || '',
        item.name || '',
        item.category || 'Pantry Staples',
        String(item.quantity ?? 0),
        item.unit || '',
        item.expiry || '',
        item.image_url || '',
        item.notes || '',
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Inventory!A2:I',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    }

    return NextResponse.json({ success: true, count: items.length, source: 'google_sheets' });
  } catch (error: any) {
    console.error('[SGTracker API POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory in Google Sheets', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
