'use client';

import React, { useState, useEffect } from 'react';
import { Shirt, Plus, Heart, CheckCircle2, DollarSign, Sparkles, Tag } from 'lucide-react';

export default function WardrobeDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wishlistTitle, setWishlistTitle] = useState('');
  const [wishlistPrice, setWishlistPrice] = useState('');
  const [wishlistCategory, setWishlistCategory] = useState('SETUP');
  const [wishlistPriority, setWishlistPriority] = useState('MEDIA');

  const fetchWardrobe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wardrobe');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWardrobe();
  }, []);

  const handleAddWishlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlistTitle || !wishlistPrice) return;
    try {
      await fetch('/api/wardrobe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'ADD_WISHLIST',
          title: wishlistTitle,
          estimatedPriceBs: wishlistPrice,
          category: wishlistCategory,
          priority: wishlistPriority,
        }),
      });
      setWishlistTitle('');
      setWishlistPrice('');
      fetchWardrobe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePurchased = async (itemId: string) => {
    try {
      await fetch('/api/wardrobe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'WISHLIST_TOGGLE', itemId }),
      });
      fetchWardrobe();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shirt className="w-5 h-5 text-purple-400" />
            Armario, Outfits & Wishlist Anti-Impulsiva
          </h1>
          <p className="text-xs text-zinc-400">
            Inventario de ropa adaptado al clima de Santa Cruz • Totalizador de deseos para evitar compras impulsivas
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Wishlist Acumulada Pendiente</span>
          <p className="text-2xl font-bold text-purple-400 mt-1 font-mono">
            {data?.pendingWishlistTotalBs ?? 0} <span className="text-xs font-normal text-zinc-400">Bs</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Filtro anti-compras impulsivas</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Deseos Activos</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            {data?.wishlist?.filter((w: any) => !w.purchased).length ?? 0}
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Setup, habitación, ropa y casa</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Prendas en Armario</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            {data?.wardrobe?.length ?? 0}
          </p>
          <span className="text-[10px] text-emerald-400 mt-1 block">Ropa y calzado inventariados</span>
        </div>
      </div>

      {/* Grid: Wishlist & Armario */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Wishlist Section (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Heart className="w-4 h-4 text-purple-400" />
              Wishlist de Compras Planeadas
            </h2>
            <span className="text-xs text-purple-400 font-mono font-bold">
              Total: {data?.pendingWishlistTotalBs ?? 0} Bs
            </span>
          </div>

          <div className="divide-y divide-zinc-800/60 flex-1 max-h-[350px] overflow-y-auto">
            {data?.wishlist?.map((item: any) => (
              <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleTogglePurchased(item.id)}
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                      item.purchased
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {item.purchased && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <div>
                    <span className={`text-xs font-medium block ${item.purchased ? 'line-through text-zinc-500' : 'text-white'}`}>
                      {item.title}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {item.category} • Prioridad {item.priority}
                    </span>
                  </div>
                </div>

                <span className="font-bold text-xs text-purple-400 font-mono">
                  {item.estimatedPriceBs} Bs
                </span>
              </div>
            ))}

            {(!data?.wishlist || data.wishlist.length === 0) && !loading && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No hay compras pendientes en tu Wishlist.
              </div>
            )}
          </div>

          {/* Form Add Wishlist */}
          <form onSubmit={handleAddWishlist} className="p-4 border-t border-zinc-800 bg-zinc-950/40 grid grid-cols-3 gap-2">
            <input
              type="text"
              value={wishlistTitle}
              onChange={e => setWishlistTitle(e.target.value)}
              placeholder="Artículo (ej: Monitor 27'')"
              required
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
            />
            <input
              type="number"
              value={wishlistPrice}
              onChange={e => setWishlistPrice(e.target.value)}
              placeholder="Precio Bs (ej: 1200)"
              required
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
            />
            <button
              type="submit"
              className="bg-purple-500 hover:bg-purple-600 text-white font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-1 shadow-md shadow-purple-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir Deseo
            </button>
          </form>
        </div>

        {/* Armario Inventory (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Armario & Clima Santa Cruz
          </h2>

          <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800 space-y-2 text-xs">
            <span className="font-semibold text-zinc-300 block">Sugerencia de Outfit Automática</span>
            <p className="text-[11px] text-zinc-400">
              Sofi analiza la ocasión (Trabajo en casa, salida casual, calor intenso) para recomendar combinaciones frescas.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <span className="text-zinc-400 font-medium block">Prendas Registradas ({data?.wardrobe?.length ?? 0}):</span>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {data?.wardrobe?.map((w: any) => (
                <div key={w.id} className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-white font-medium">{w.name}</span>
                  <span className="text-zinc-500">{w.color} • {w.category}</span>
                </div>
              ))}
              {(!data?.wardrobe || data.wardrobe.length === 0) && (
                <p className="text-[11px] text-zinc-500">Mándale una foto de tus prendas a Sofi por Telegram para indexarlas al vuelo con visión.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
