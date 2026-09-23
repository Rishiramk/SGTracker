import { NextResponse } from 'next/server';
import dictionary from '../../../data/dictionary.json';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';

  if (!q || q.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  // 1. Local dictionary matches
  const localMatches = dictionary.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.sub.toLowerCase().includes(q)
  );

  const suggestions: Array<{
    name: string;
    category: string;
    sub: string;
    default_unit?: string;
    image_url?: string;
    barcode?: string;
    source: string;
  }> = localMatches.map((item) => ({
    name: item.name,
    category: item.category,
    sub: item.sub,
    default_unit: item.default_unit,
    image_url: item.image_url || '',
    source: 'dictionary',
  }));

  // 2. Fetch live Open Food Facts API search results if q >= 3
  if (q.length >= 3) {
    try {
      const offRes = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          q
        )}&search_simple=1&action=process&json=1&page_size=6`,
        {
          headers: {
            'User-Agent': 'SGTracker-PantryApp/1.0 (https://github.com/rishi/SGTracker)',
          },
          next: { revalidate: 3600 },
        }
      );
      if (offRes.ok) {
        const offData = await offRes.json();
        if (offData.products && Array.isArray(offData.products)) {
          const existingNames = new Set(suggestions.map((s) => s.name.toLowerCase()));
          
          for (const p of offData.products) {
            const name = (p.product_name || p.product_name_en || '').trim();
            if (!name || existingNames.has(name.toLowerCase())) continue;

            const imageUrl = p.image_front_small_url || p.image_small_url || p.image_url || '';
            const brand = p.brands ? p.brands.split(',')[0].trim() : 'Global Product';

            existingNames.add(name.toLowerCase());
            suggestions.push({
              name,
              category: 'Pantry Staples',
              sub: brand,
              default_unit: p.quantity || 'pcs',
              image_url: imageUrl,
              barcode: p.code || '',
              source: 'open_food_facts',
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Autocomplete OFF Fetch Warning]:', err);
    }
  }

  return NextResponse.json({
    query: q,
    suggestions: suggestions.slice(0, 10),
  });
}
