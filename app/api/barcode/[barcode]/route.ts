import { NextResponse } from 'next/server';
import taxonomy from '../../../../data/taxonomy.json';

export const dynamic = 'force-dynamic';

// Helper to map Open Food Facts categories string to our taxonomy
function inferTaxonomyCategory(rawCategories: string[] = [], productName: string = ''): { category: string; sub: string } {
  const categoriesStr = (rawCategories.join(' ') + ' ' + productName).toLowerCase();

  if (categoriesStr.includes('fruit') || categoriesStr.includes('vegetable') || categoriesStr.includes('herb') || categoriesStr.includes('produce')) {
    if (categoriesStr.includes('fruit')) return { category: 'Produce', sub: 'Fresh Fruit' };
    if (categoriesStr.includes('herb') || categoriesStr.includes('spice')) return { category: 'Produce', sub: 'Herbs' };
    return { category: 'Produce', sub: 'Fresh Vegetables' };
  }

  if (categoriesStr.includes('milk') || categoriesStr.includes('dairy') || categoriesStr.includes('cheese') || categoriesStr.includes('yogurt') || categoriesStr.includes('egg')) {
    if (categoriesStr.includes('cheese')) return { category: 'Dairy & Eggs', sub: 'Cheese' };
    if (categoriesStr.includes('yogurt')) return { category: 'Dairy & Eggs', sub: 'Yogurt' };
    if (categoriesStr.includes('egg')) return { category: 'Dairy & Eggs', sub: 'Eggs' };
    return { category: 'Dairy & Eggs', sub: 'Milk' };
  }

  if (categoriesStr.includes('meat') || categoriesStr.includes('poultry') || categoriesStr.includes('chicken') || categoriesStr.includes('beef') || categoriesStr.includes('pork') || categoriesStr.includes('fish') || categoriesStr.includes('seafood')) {
    if (categoriesStr.includes('chicken') || categoriesStr.includes('poultry')) return { category: 'Meat & Seafood', sub: 'Poultry' };
    if (categoriesStr.includes('beef')) return { category: 'Meat & Seafood', sub: 'Beef' };
    if (categoriesStr.includes('pork')) return { category: 'Meat & Seafood', sub: 'Pork' };
    if (categoriesStr.includes('fish') || categoriesStr.includes('salmon') || categoriesStr.includes('tuna')) return { category: 'Meat & Seafood', sub: 'Fish' };
    return { category: 'Meat & Seafood', sub: 'Poultry' };
  }

  if (categoriesStr.includes('household') || categoriesStr.includes('clean') || categoriesStr.includes('paper') || categoriesStr.includes('bag')) {
    if (categoriesStr.includes('paper')) return { category: 'Household', sub: 'Paper Goods' };
    if (categoriesStr.includes('trash') || categoriesStr.includes('bag')) return { category: 'Household', sub: 'Trash Bags' };
    return { category: 'Household', sub: 'Cleaning Supplies' };
  }

  // Default fallback to Pantry Staples
  if (categoriesStr.includes('pasta') || categoriesStr.includes('rice') || categoriesStr.includes('grain')) return { category: 'Pantry Staples', sub: 'Pasta & Grains' };
  if (categoriesStr.includes('canned') || categoriesStr.includes('can')) return { category: 'Pantry Staples', sub: 'Canned Goods' };
  if (categoriesStr.includes('oil') || categoriesStr.includes('sauce')) return { category: 'Pantry Staples', sub: 'Oils & Sauces' };
  return { category: 'Pantry Staples', sub: 'Canned Goods' };
}

export async function GET(
  request: Request,
  { params }: { params: { barcode: string } }
) {
  const barcode = params.barcode?.trim();

  if (!barcode) {
    return NextResponse.json({ error: 'Barcode parameter is required' }, { status: 400 });
  }

  try {
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const res = await fetch(offUrl, {
      headers: {
        'User-Agent': 'SGTracker-PantryApp/1.0 (https://github.com/rishi/SGTracker)',
      },
      next: { revalidate: 86400 }, // Cache lookup for 24h
    });

    if (!res.ok) {
      return NextResponse.json({ found: false, error: 'Open Food Facts request failed' }, { status: 404 });
    }

    const data = await res.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      const productName = p.product_name || p.product_name_en || p.abbreviated_product_name || 'Scanned Pantry Item';
      const imageUrl = p.image_front_small_url || p.image_front_url || p.image_small_url || p.image_url || '';
      const rawCategories: string[] = p.categories_tags || (p.categories ? p.categories.split(',') : []);

      const { category, sub } = inferTaxonomyCategory(rawCategories, productName);

      return NextResponse.json({
        found: true,
        product: {
          barcode,
          product_name: productName,
          category: `${category} > ${sub}`,
          main_category: category,
          sub_category: sub,
          image_url: imageUrl,
          brand: p.brands || '',
          quantity_str: p.quantity || '',
        },
      });
    }

    return NextResponse.json({ found: false, barcode, message: 'Product not found in Open Food Facts' });
  } catch (error: any) {
    console.error(`[Barcode API Error for ${barcode}]:`, error);
    return NextResponse.json(
      { found: false, error: 'Failed to query barcode from Open Food Facts', details: error?.message },
      { status: 500 }
    );
  }
}
