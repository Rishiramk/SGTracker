'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Tag, ChevronRight, Package } from 'lucide-react';

export interface Suggestion {
  name: string;
  category: string;
  sub: string;
  default_unit?: string;
  image_url?: string;
  barcode?: string;
  source?: string;
}

interface ProductAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  placeholder?: string;
}

// Fallback high-res food image helper from open-source Unsplash food CDN
export function getProductMockImage(productName: string, category?: string): string {
  const nameLower = (productName || '').toLowerCase();

  if (nameLower.includes('milk')) return 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('cheese')) return 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('yogurt') || nameLower.includes('yoghurt')) return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('egg')) return 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('apple')) return 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('banana')) return 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('tomato')) return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('spinach') || nameLower.includes('lettuce') || nameLower.includes('green')) return 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('potato')) return 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('chicken')) return 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('beef') || nameLower.includes('meat')) return 'https://images.unsplash.com/photo-1588347818036-558601350947?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('salmon') || nameLower.includes('fish')) return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('pasta') || nameLower.includes('noodle')) return 'https://images.unsplash.com/photo-1621996346565-e3def6166763?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('rice')) return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('oil')) return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('bread') || nameLower.includes('bun')) return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('coffee') || nameLower.includes('tea')) return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=250&auto=format&fit=crop&q=80';
  if (nameLower.includes('juice') || nameLower.includes('drink') || nameLower.includes('cola')) return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=250&auto=format&fit=crop&q=80';

  const catLower = (category || '').toLowerCase();
  if (catLower.includes('produce')) return 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=250&auto=format&fit=crop&q=80';
  if (catLower.includes('dairy')) return 'https://images.unsplash.com/photo-1528750997573-59b89d66f4f7?w=250&auto=format&fit=crop&q=80';
  if (catLower.includes('meat')) return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=250&auto=format&fit=crop&q=80';
  if (catLower.includes('household')) return 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=250&auto=format&fit=crop&q=80';

  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=250&auto=format&fit=crop&q=80';
}

export default function ProductAutocomplete({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = 'e.g. Tomatoes, Milk, Greek Yogurt...',
}: ProductAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!value.trim() || value.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setIsOpen((data.suggestions || []).length > 0);
        }
      } catch (err) {
        console.error('Autocomplete fetch error:', err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: Suggestion) => {
    const imgUrl = item.image_url || getProductMockImage(item.name, item.category);
    const enrichedItem = { ...item, image_url: imgUrl };
    onChange(item.name);
    onSelectSuggestion(enrichedItem);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          required
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Sparkles className={`w-4 h-4 text-indigo-500 ${loading ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown - Clean Light Theme */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150 max-h-72 overflow-y-auto">
          <div className="px-3.5 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100">
            <span className="flex items-center gap-1.5 text-indigo-600 font-bold">
              <Sparkles className="w-3 h-3" />
              Smart Product Suggestions
            </span>
            <span>Tap to select</span>
          </div>

          {suggestions.map((item, idx) => {
            const displayImg = item.image_url || getProductMockImage(item.name, item.category);

            return (
              <button
                key={`${item.name}-${idx}`}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full px-3.5 py-2.5 text-left hover:bg-indigo-50/50 active:bg-indigo-50 flex items-center justify-between gap-3 transition-colors group"
              >
                {/* Image Thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  <img
                    src={displayImg}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getProductMockImage(item.name, item.category);
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate">
                      <Tag className="w-2.5 h-2.5 text-indigo-500" />
                      {item.category} {item.sub ? `> ${item.sub}` : ''}
                    </span>
                    {item.source === 'open_food_facts' && (
                      <span className="text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200">
                        Global API
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
