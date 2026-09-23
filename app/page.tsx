'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Minus,
  Calendar,
  Package,
  Search,
  RefreshCw,
  X,
  ShoppingBag,
  FileText,
  Camera,
  Barcode,
  Tag,
  Sparkles,
  AlertTriangle,
  Globe,
  ChevronRight,
  Filter,
  Trash2,
  Edit2,
  Edit,
  Check,
  Combine,
  Layers,
  Save,
  Boxes,
  Carrot,
  Milk,
  Beef,
  Utensils,
  Clock,
  Sparkle,
} from 'lucide-react';
import { InventoryItem } from './api/inventory/route';
import BarcodeScanner from './components/BarcodeScanner';
import ProductAutocomplete, { Suggestion, getProductMockImage } from './components/ProductAutocomplete';
import taxonomy from '../data/taxonomy.json';

const UNIT_OPTIONS = ['no unit', 'kg', 'g', 'mg', 'L', 'ml', 'pcs', 'pack', 'box', 'bottle', 'can', 'dozen'];

const CATEGORY_FILTERS = [
  { id: 'All', label: 'All', Icon: Boxes, color: 'text-indigo-600' },
  { id: 'Produce', label: 'Produce', Icon: Carrot, color: 'text-emerald-600' },
  { id: 'Dairy & Eggs', label: 'Dairy & Eggs', Icon: Milk, color: 'text-sky-600' },
  { id: 'Meat & Seafood', label: 'Meat & Seafood', Icon: Beef, color: 'text-rose-600' },
  { id: 'Pantry Staples', label: 'Pantry Staples', Icon: Utensils, color: 'text-amber-600' },
  { id: 'Household', label: 'Household', Icon: Sparkles, color: 'text-purple-600' },
  { id: 'Expiring Soon', label: 'Expiring Soon', Icon: Clock, color: 'text-amber-600' },
  { id: 'Expired', label: 'Expired', Icon: AlertTriangle, color: 'text-rose-600' },
];

export default function SGTrackerPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSource, setSyncSource] = useState<'google_sheets' | 'demo' | 'offline'>('demo');

  // Dual Search State
  const [searchQuery, setSearchQuery] = useState(''); // Search Bar 1: Local Inventory
  const [globalSearchQuery, setGlobalSearchQuery] = useState(''); // Search Bar 2: Global API Search
  const [globalResults, setGlobalResults] = useState<Suggestion[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'global'>('inventory');

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [barcodeFetching, setBarcodeFetching] = useState(false);

  // Form & CRUD State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemBarcode, setNewItemBarcode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Produce');
  const [newItemSubCategory, setNewItemSubCategory] = useState('Fresh Vegetables');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('no unit');
  const [newItemExpiry, setNewItemExpiry] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');

  // Inline Editable Notes State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState<string>('');

  // Toast / Banner notice for Merge Duplicates
  const [mergeNotice, setMergeNotice] = useState<string | null>(null);

  // Debounce ref for backend sync
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial inventory
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      if (!res.ok) throw new Error('API fetch failed');
      const data = await res.json();
      setItems(data.items || []);
      if (data.source) setSyncSource(data.source);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Global API search effect
  useEffect(() => {
    if (!globalSearchQuery.trim() || globalSearchQuery.length < 2) {
      setGlobalResults([]);
      return;
    }

    setGlobalSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(globalSearchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setGlobalResults(data.suggestions || []);
        }
      } catch (err) {
        console.error('Global API search error:', err);
      } finally {
        setGlobalSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [globalSearchQuery]);

  // Background Sync function
  const triggerBackendSync = (updatedItems: InventoryItem[]) => {
    setSyncing(true);
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedItems),
        });
        const data = await res.json();
        if (data.source) setSyncSource(data.source);
      } catch (err) {
        console.error('Background sync failed:', err);
      } finally {
        setSyncing(false);
      }
    }, 400);
  };

  // Optimistic Quantity Adjustment
  const handleAdjustQuantity = (id: string, delta: number) => {
    setItems((prevItems) => {
      const updated = prevItems
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);

      triggerBackendSync(updated);
      return updated;
    });
  };

  // Inline Note Editing Handlers
  const handleStartEditNote = (item: InventoryItem) => {
    setEditingNoteId(item.id);
    setEditingNoteValue(item.notes || '');
  };

  const handleSaveNote = (id: string) => {
    setItems((prevItems) => {
      const updated = prevItems.map((item) =>
        item.id === id ? { ...item, notes: editingNoteValue.trim() } : item
      );
      triggerBackendSync(updated);
      return updated;
    });
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  // Remove Item Handler (CRUD Delete)
  const handleDeleteItem = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from your pantry?`)) {
      setItems((prevItems) => {
        const updated = prevItems.filter((item) => item.id !== id);
        triggerBackendSync(updated);
        return updated;
      });
    }
  };

  // Edit Existing Item Handler (CRUD Edit)
  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setNewItemName(item.name);
    setNewItemBarcode(item.barcode || '');

    const catParts = (item.category || '').split('>').map((s) => s.trim());
    setNewItemCategory(catParts[0] || 'Produce');
    setNewItemSubCategory(catParts[1] || 'Fresh Vegetables');

    setNewItemQuantity(item.quantity);
    setNewItemUnit(item.unit || 'no unit');
    setNewItemExpiry(item.expiry || '');
    setNewItemImageUrl(item.image_url || getProductMockImage(item.name, item.category));
    setNewItemNotes(item.notes || '');
    setIsModalOpen(true);
  };

  // Merge Duplicate Items Option
  const handleMergeDuplicates = () => {
    if (items.length <= 1) {
      setMergeNotice('No items to merge.');
      setTimeout(() => setMergeNotice(null), 3000);
      return;
    }

    const mergedMap = new Map<string, InventoryItem>();
    let mergeCount = 0;

    for (const item of items) {
      const key =
        item.barcode && item.barcode.trim()
          ? `barcode:${item.barcode.trim()}`
          : `name:${item.name.toLowerCase().trim()}`;

      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        mergeCount += 1;

        const newQuantity = existing.quantity + item.quantity;

        const notesSet = new Set<string>();
        if (existing.notes) notesSet.add(existing.notes);
        if (item.notes) notesSet.add(item.notes);
        const newNotes = Array.from(notesSet).join('; ');

        const newImageUrl = existing.image_url || item.image_url || getProductMockImage(item.name, item.category);
        const newUnit = existing.unit || item.unit || '';

        let newExpiry = existing.expiry || item.expiry || '';
        if (existing.expiry && item.expiry) {
          newExpiry = existing.expiry < item.expiry ? existing.expiry : item.expiry;
        }

        mergedMap.set(key, {
          ...existing,
          quantity: newQuantity,
          notes: newNotes,
          image_url: newImageUrl,
          unit: newUnit,
          expiry: newExpiry,
        });
      } else {
        mergedMap.set(key, {
          ...item,
          image_url: item.image_url || getProductMockImage(item.name, item.category),
        });
      }
    }

    if (mergeCount > 0) {
      const updated = Array.from(mergedMap.values());
      setItems(updated);
      triggerBackendSync(updated);
      setMergeNotice(`Merged ${mergeCount} duplicate item${mergeCount > 1 ? 's' : ''} successfully!`);
      setTimeout(() => setMergeNotice(null), 4000);
    } else {
      setMergeNotice('No duplicate items found to merge.');
      setTimeout(() => setMergeNotice(null), 3000);
    }
  };

  // Fetch product from Open Food Facts API by barcode
  const fetchOpenFoodFactsBarcode = async (barcode: string) => {
    if (!barcode.trim()) return;
    setBarcodeFetching(true);
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcode.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.product) {
          const p = data.product;
          if (p.product_name) setNewItemName(p.product_name);
          setNewItemImageUrl(p.image_url || getProductMockImage(p.product_name || '', p.main_category));
          if (p.main_category) setNewItemCategory(p.main_category);
          if (p.sub_category) setNewItemSubCategory(p.sub_category);
        }
      }
    } catch (err) {
      console.error('Failed to lookup barcode:', err);
    } finally {
      setBarcodeFetching(false);
    }
  };

  // Open Camera Scanner cleanly
  const handleOpenScanner = () => {
    setIsModalOpen(false);
    setIsCameraScannerOpen(true);
  };

  // Handle successful camera scan
  const handleScanSuccess = (code: string) => {
    setNewItemBarcode(code);
    setIsCameraScannerOpen(false);
    setIsModalOpen(true);
    fetchOpenFoodFactsBarcode(code);
  };

  // Handle scanner close without scanning
  const handleScannerClose = () => {
    setIsCameraScannerOpen(false);
    setIsModalOpen(true);
  };

  // Handle autocomplete suggestion select
  const handleSelectAutocomplete = (suggestion: Suggestion) => {
    setNewItemName(suggestion.name);
    if (suggestion.category) setNewItemCategory(suggestion.category);
    if (suggestion.sub) setNewItemSubCategory(suggestion.sub);
    if (suggestion.default_unit) setNewItemUnit(suggestion.default_unit);
    setNewItemImageUrl(suggestion.image_url || getProductMockImage(suggestion.name, suggestion.category));
    if (suggestion.barcode) setNewItemBarcode(suggestion.barcode);
  };

  // Quick Add from Global API Search Result
  const handleQuickAddFromGlobal = (suggestion: Suggestion) => {
    setEditingItemId(null);
    handleSelectAutocomplete(suggestion);
    setIsModalOpen(true);
  };

  // Add or Update Pantry Item
  const handleAddOrUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const fullCategory = `${newItemCategory}${newItemSubCategory ? ` > ${newItemSubCategory}` : ''}`;
    const finalImageUrl = newItemImageUrl.trim() || getProductMockImage(newItemName.trim(), newItemCategory);

    if (editingItemId) {
      // Update existing item
      setItems((prevItems) => {
        const updated = prevItems.map((item) => {
          if (item.id === editingItemId) {
            return {
              ...item,
              barcode: newItemBarcode.trim(),
              name: newItemName.trim(),
              category: fullCategory,
              quantity: Math.max(1, newItemQuantity),
              unit: newItemUnit === 'no unit' ? '' : newItemUnit,
              expiry: newItemExpiry,
              image_url: finalImageUrl,
              notes: newItemNotes.trim(),
            };
          }
          return item;
        });
        triggerBackendSync(updated);
        return updated;
      });
    } else {
      // Create new item
      const newItem: InventoryItem = {
        id: `item-${Date.now()}`,
        barcode: newItemBarcode.trim(),
        name: newItemName.trim(),
        category: fullCategory,
        quantity: Math.max(1, newItemQuantity),
        unit: newItemUnit === 'no unit' ? '' : newItemUnit,
        expiry: newItemExpiry,
        image_url: finalImageUrl,
        notes: newItemNotes.trim(),
      };

      setItems((prevItems) => {
        const updated = [newItem, ...prevItems];
        triggerBackendSync(updated);
        return updated;
      });
    }

    // Reset Form & Close Drawer
    setEditingItemId(null);
    setNewItemName('');
    setNewItemBarcode('');
    setNewItemCategory('Produce');
    setNewItemSubCategory('Fresh Vegetables');
    setNewItemQuantity(1);
    setNewItemUnit('no unit');
    setNewItemExpiry('');
    setNewItemImageUrl('');
    setNewItemNotes('');
    setIsModalOpen(false);
  };

  // Expiry date helper
  const getExpiryStatus = (expiryStr?: string) => {
    if (!expiryStr) return { status: 'none', label: 'No expiry', colorClass: 'text-slate-500 bg-slate-100 border-slate-200' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(expiryStr);
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      return {
        status: 'expired',
        label: `Expired ${daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`}`,
        colorClass: 'text-rose-700 bg-rose-50 border-rose-200 font-semibold',
      };
    } else if (diffDays <= 2) {
      return {
        status: 'warning',
        label: diffDays === 0 ? 'Expires TODAY' : diffDays === 1 ? 'Expires TOMORROW' : `Expires in 2 days`,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200 font-semibold animate-pulse',
      };
    } else {
      return {
        status: 'ok',
        label: `Expires in ${diffDays}d (${expiryStr})`,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      };
    }
  };

  // Calculate summary stats
  const expiredCount = items.filter((item) => getExpiryStatus(item.expiry).status === 'expired').length;
  const warningCount = items.filter((item) => getExpiryStatus(item.expiry).status === 'warning').length;

  // Filter items by category & search query
  const filteredItems = items.filter((item) => {
    const expiryInfo = getExpiryStatus(item.expiry);
    let matchesCategory = true;

    if (selectedCategory === 'All') {
      matchesCategory = true;
    } else if (selectedCategory === 'Expiring Soon') {
      matchesCategory = expiryInfo.status === 'warning';
    } else if (selectedCategory === 'Expired') {
      matchesCategory = expiryInfo.status === 'expired';
    } else {
      matchesCategory = !!(item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase()));
    }

    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q));

    return matchesCategory && matchesQuery;
  });

  // Calculate counts for filter pills
  const getFilterCount = (catId: string) => {
    if (catId === 'All') return items.length;
    if (catId === 'Expiring Soon') return warningCount;
    if (catId === 'Expired') return expiredCount;
    return items.filter((i) => i.category && i.category.toLowerCase().includes(catId.toLowerCase())).length;
  };

  const currentTaxonomyObj = taxonomy.find((t) => t.name === newItemCategory);
  const subCategories = currentTaxonomyObj ? currentTaxonomyObj.sub : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-800 pb-28 select-none font-sans">
      {/* Sticky Mobile Light Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShoppingBag className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 bg-clip-text text-transparent">
                  SGTracker
                </h1>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm">
                  v1.0 Live
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-slate-700">Smart Grocery & Pantry Tracker</span>
                <span className="text-slate-300">•</span>
                {syncSource === 'google_sheets' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Google Sheets Cloud Sync
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Local Store
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Merge Duplicates Button */}
            <button
              onClick={handleMergeDuplicates}
              className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-indigo-600 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
              title="Merge duplicate items with same name or barcode"
            >
              <Combine className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Merge</span>
            </button>

            {/* Camera Scan Button */}
            <button
              onClick={handleOpenScanner}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-indigo-600/20 hover:bg-indigo-700"
              title="Scan Barcode with Camera"
            >
              <Camera className="w-4 h-4 text-white animate-pulse" />
              <span>Scan</span>
            </button>

            {/* Refresh Inventory */}
            <button
              onClick={fetchInventory}
              disabled={loading || syncing}
              className="p-2.5 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 active:scale-95 transition-all shadow-sm"
              title="Refresh Inventory"
            >
              <RefreshCw className={`w-4 h-4 ${loading || syncing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Mode Toggle: My Inventory vs Global API Search */}
        <div className="mt-3 grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs font-bold shadow-inner">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'inventory'
                ? 'bg-white text-indigo-600 shadow-md shadow-slate-200 border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>My Inventory ({items.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'global'
                ? 'bg-white text-indigo-600 shadow-md shadow-slate-200 border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Global API Search</span>
          </button>
        </div>

        {/* SEARCH BAR 1: Search My Inventory */}
        {activeTab === 'inventory' && (
          <div className="mt-3 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search my inventory by name, barcode, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* SEARCH BAR 2: Search Global Products via API */}
        {activeTab === 'global' && (
          <div className="mt-3 relative">
            <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600" />
            <input
              type="text"
              placeholder="Search global API (Open Food Facts / Dictionary)..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-indigo-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
            />
            {globalSearching ? (
              <RefreshCw className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 animate-spin" />
            ) : globalSearchQuery ? (
              <button
                onClick={() => setGlobalSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        )}

        {/* Category & Department Filters with Lucide Icons */}
        {activeTab === 'inventory' && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {CATEGORY_FILTERS.map((cat) => {
              const count = getFilterCount(cat.id);
              const isSelected = selectedCategory === cat.id;
              const IconComp = cat.Icon;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-600'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100/80 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : cat.color}`} />
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Merge Toast Notice Banner */}
        {mergeNotice && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-900 font-bold shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="flex items-center gap-2">
              <Combine className="w-4 h-4 text-indigo-600" />
              {mergeNotice}
            </span>
            <button onClick={() => setMergeNotice(null)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Syncing Progress Banner */}
        {syncing && (
          <div className="mb-4 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-700 animate-pulse shadow-sm">
            <span className="flex items-center gap-2 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              Syncing updates to Google Sheets...
            </span>
            <span className="font-bold">Optimistic UI</span>
          </div>
        )}

        {/* INVENTORY TAB CONTENT */}
        {activeTab === 'inventory' && (
          <>
            {/* Dashboard Stats Cards */}
            {!loading && items.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3 text-center shadow-sm">
                  <span className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Total</span>
                  <span className="text-xl font-black text-slate-900">{items.length}</span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-center shadow-sm">
                  <span className="block text-[10px] uppercase font-extrabold text-amber-700 tracking-wider">Expiring Soon</span>
                  <span className="text-xl font-black text-amber-700">{warningCount}</span>
                </div>
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3 text-center shadow-sm">
                  <span className="block text-[10px] uppercase font-extrabold text-rose-700 tracking-wider">Expired</span>
                  <span className="text-xl font-black text-rose-700">{expiredCount}</span>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Loading pantry inventory...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              /* Empty State */
              <div className="py-16 text-center px-4 bg-white border border-slate-200/80 rounded-3xl shadow-sm">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-4 shadow-inner">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {searchQuery || selectedCategory !== 'All' ? 'No matching items found' : 'No Items in Pantry'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-6">
                  {searchQuery || selectedCategory !== 'All'
                    ? `No pantry items matched your search or category filter.`
                    : 'Tap the blue "+" button below or camera icon above to scan your first barcode item.'}
                </p>
                {(searchQuery || selectedCategory !== 'All') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shadow-sm"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              /* Inventory Items List Cards */
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>Pantry Stock ({filteredItems.length})</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleMergeDuplicates}
                      className="text-indigo-600 hover:underline text-[11px] font-extrabold flex items-center gap-1 lowercase"
                    >
                      <Combine className="w-3 h-3" />
                      merge duplicates
                    </button>
                    <span>Adjust / Actions</span>
                  </div>
                </div>

                {filteredItems.map((item) => {
                  const expiryInfo = getExpiryStatus(item.expiry);
                  const isEditingNote = editingNoteId === item.id;
                  const itemImg = item.image_url || getProductMockImage(item.name, item.category);

                  return (
                    <div
                      key={item.id}
                      className="group relative bg-white border border-slate-200/90 rounded-2xl p-4 transition-all duration-200 shadow-sm hover:shadow-md hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Thumbnail Image with Open Source Fallback */}
                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          <img
                            src={itemImg}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getProductMockImage(item.name, item.category);
                            }}
                          />
                        </div>

                        {/* Item Details */}
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="text-base font-extrabold text-slate-900 leading-snug break-words">
                              {item.name}
                            </h2>

                            {/* CRUD Action Buttons: Edit Item & Delete Item */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"
                                title="Edit Item Details"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id, item.name)}
                                className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                                title="Remove Item from Inventory"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Category Tag */}
                          {item.category && (
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-indigo-600 font-semibold">
                              <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="break-words">{item.category}</span>
                            </div>
                          )}

                          {/* Editable Notes Section */}
                          <div className="mt-1.5">
                            {isEditingNote ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingNoteValue}
                                  onChange={(e) => setEditingNoteValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveNote(item.id);
                                    if (e.key === 'Escape') setEditingNoteId(null);
                                  }}
                                  placeholder="Add notes..."
                                  className="flex-1 px-2.5 py-1 bg-slate-50 border border-indigo-400 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveNote(item.id)}
                                  className="p-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                                  title="Save Note"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="italic break-words">
                                  {item.notes || 'No notes added'}
                                </span>
                                <button
                                  onClick={() => handleStartEditNote(item)}
                                  className="p-0.5 rounded text-slate-400 hover:text-indigo-600 transition"
                                  title="Edit Note"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Barcode badge */}
                          {item.barcode && (
                            <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                              <Barcode className="w-3 h-3 text-slate-400" />
                              <span>{item.barcode}</span>
                            </p>
                          )}

                          {/* Expiry Badge */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${expiryInfo.colorClass}`}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{expiryInfo.label}</span>
                            </span>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/80 shrink-0 shadow-inner">
                          <button
                            onClick={() => handleAdjustQuantity(item.id, -1)}
                            className="w-10 h-10 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center active:scale-90 transition-transform touch-none"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="w-4 h-4 stroke-[3]" />
                          </button>

                          <div className="w-11 text-center flex flex-col items-center justify-center">
                            <span className="text-lg font-black text-slate-900 tracking-tight leading-none">
                              {item.quantity}
                            </span>
                            {item.unit && item.unit !== 'no unit' && (
                              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mt-0.5 truncate max-w-full">
                                {item.unit}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleAdjustQuantity(item.id, 1)}
                            className="w-10 h-10 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center active:scale-90 transition-transform touch-none"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="w-4 h-4 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* GLOBAL API SEARCH TAB CONTENT */}
        {activeTab === 'global' && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-900 flex items-start gap-3 shadow-sm">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-slate-900">Global Product Search</p>
                <p className="mt-0.5 text-slate-600">
                  Search real-world products via Open Food Facts API & dictionary. Tap "+ Add to Pantry" to pre-fill details and images.
                </p>
              </div>
            </div>

            {!globalSearchQuery.trim() ? (
              <div className="py-12 text-center px-4 bg-white border border-slate-200/80 rounded-3xl shadow-sm">
                <Globe className="w-12 h-12 text-indigo-300 mx-auto mb-3 animate-pulse" />
                <h4 className="text-base font-bold text-slate-800">Start typing to search global database</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  e.g. "Nutella", "Coca Cola", "Greek Yogurt", "Doritos", "Oat Milk"...
                </p>
              </div>
            ) : globalSearching ? (
              <div className="py-16 text-center space-y-3 bg-white border border-slate-200/80 rounded-3xl shadow-sm">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm text-slate-500 font-medium">Searching global product database...</p>
              </div>
            ) : globalResults.length === 0 ? (
              <div className="py-12 text-center bg-white border border-slate-200/80 rounded-3xl shadow-sm">
                <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-700 font-semibold">No global products found for "{globalSearchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Global API Matches ({globalResults.length})
                </div>

                {globalResults.map((res, idx) => {
                  const resImg = res.image_url || getProductMockImage(res.name, res.category);

                  return (
                    <div
                      key={`${res.name}-${idx}`}
                      className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-indigo-300 transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          src={resImg}
                          alt={res.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getProductMockImage(res.name, res.category);
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{res.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {res.category} {res.sub ? `> ${res.sub}` : ''}
                          </span>
                          {res.source === 'open_food_facts' && (
                            <span className="text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                              Open Food Facts
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleQuickAddFromGlobal(res)}
                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shrink-0 shadow-md shadow-indigo-600/20 hover:bg-indigo-700"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Add</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => {
            setEditingItemId(null);
            setNewItemName('');
            setNewItemBarcode('');
            setNewItemQuantity(1);
            setNewItemUnit('no unit');
            setNewItemExpiry('');
            setNewItemImageUrl('');
            setNewItemNotes('');
            setIsModalOpen(true);
          }}
          className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-95 transition-all duration-200 border-2 border-indigo-400/30"
          aria-label="Add New Product"
        >
          <Plus className="w-8 h-8 stroke-[3] group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Camera Barcode Scanner Overlay */}
      {isCameraScannerOpen && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={handleScannerClose}
        />
      )}

      {/* Bottom-Sheet Add / Edit Product Drawer - Light Theme */}
      {isModalOpen && !isCameraScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setIsModalOpen(false);
              setEditingItemId(null);
            }}
          />

          {/* Bottom Sheet Drawer */}
          <div className="relative w-full max-w-lg bg-white border-t border-slate-200 rounded-t-3xl p-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto text-slate-800">
            {/* Sheet Handle Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-5" />

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Package className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingItemId ? 'Edit Pantry Item' : 'Add to Pantry'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingItemId(null);
                }}
                className="p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera Scan Trigger Banner */}
            <div className="mb-5 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Scan Product Barcode</p>
                  <p className="text-[11px] text-slate-500">Open camera to fetch Open Food Facts data</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenScanner}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Open Camera
              </button>
            </div>

            <form onSubmit={handleAddOrUpdateProduct} className="space-y-4">
              {/* Barcode Input & Lookup */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Barcode (EAN / UPC)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 5449000000996"
                      value={newItemBarcode}
                      onChange={(e) => setNewItemBarcode(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 font-mono shadow-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchOpenFoodFactsBarcode(newItemBarcode)}
                    disabled={barcodeFetching || !newItemBarcode.trim()}
                    className="px-3.5 py-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-indigo-600 hover:bg-slate-200/80 disabled:opacity-50 transition shadow-sm"
                  >
                    {barcodeFetching ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> : 'Fetch API'}
                  </button>
                </div>
              </div>

              {/* Smart Autocomplete Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <ProductAutocomplete
                  value={newItemName}
                  onChange={setNewItemName}
                  onSelectSuggestion={handleSelectAutocomplete}
                  placeholder="Type product name or select from search..."
                />
              </div>

              {/* Taxonomy Category & Subcategory Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Category *
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setNewItemCategory(newCat);
                      const catObj = taxonomy.find((t) => t.name === newCat);
                      if (catObj && catObj.sub.length > 0) {
                        setNewItemSubCategory(catObj.sub[0]);
                      }
                    }}
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:outline-none focus:border-indigo-600 shadow-sm"
                  >
                    {taxonomy.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sub-Category
                  </label>
                  <select
                    value={newItemSubCategory}
                    onChange={(e) => setNewItemSubCategory(e.target.value)}
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:outline-none focus:border-indigo-600 shadow-sm"
                  >
                    {subCategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Quantity
                </label>
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-sm">
                  <button
                    type="button"
                    onClick={() => setNewItemQuantity((q) => Math.max(1, q - 1))}
                    className="w-12 h-12 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 shadow-sm"
                  >
                    <Minus className="w-5 h-5 stroke-[3]" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-center bg-transparent text-xl font-bold text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNewItemQuantity((q) => q + 1)}
                    className="w-12 h-12 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 shadow-sm"
                  >
                    <Plus className="w-5 h-5 stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* Unit Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Unit (Optional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {UNIT_OPTIONS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setNewItemUnit(u)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        newItemUnit === u
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-600'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={newItemExpiry}
                  onChange={(e) => setNewItemExpiry(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:outline-none focus:border-indigo-600 shadow-sm"
                />
              </div>

              {/* Image URL with Open Source mock fallback */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="Leave empty for automatic high-res mock image"
                  value={newItemImageUrl}
                  onChange={(e) => setNewItemImageUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 shadow-sm"
                />
              </div>

              {/* Notes Field */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Organic, Freezer tray, Buy extra"
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 shadow-sm"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-base shadow-lg shadow-indigo-600/25 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{editingItemId ? 'Update Pantry Item' : 'Save to Pantry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
