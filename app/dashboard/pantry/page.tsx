'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, Minus, RefreshCw, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';

export default function PantryDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newUnit, setNewUnit] = useState('g');
  const [newPrice, setNewPrice] = useState('');

  const fetchPantry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pantry');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPantry();
  }, []);

  const handleConsume = async (itemId: string) => {
    try {
      await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CONSUME', itemId }),
      });
      fetchPantry();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestock = async (itemId: string) => {
    try {
      await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESTOCK', itemId }),
      });
      fetchPantry();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newStock) return;
    try {
      await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          currentStock: newStock,
          unit: newUnit,
          estimatedPriceBs: newPrice,
          minThreshold: '2',
        }),
      });
      setNewName('');
      setNewStock('');
      setNewPrice('');
      fetchPantry();
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
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            Despensa Inteligente & Alacena
          </h1>
          <p className="text-xs text-zinc-400">
            Auto-descuento por consumo diario • Lista de reposición con precios locales en Santa Cruz (Bs)
          </p>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {data?.lowStock?.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-xs font-semibold text-amber-300">
                Insumos que requieren reposición ({data.lowStock.length})
              </h2>
              <p className="text-[11px] text-zinc-400">
                {data.lowStock.map((i: any) => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-amber-400 block font-mono">~{data?.estimatedRestockTotalBs ?? 0} Bs</span>
            <span className="text-[10px] text-zinc-500">Costo total est.</span>
          </div>
        </div>
      )}

      {/* Grid: Item Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data?.items?.map((item: any) => {
          const isWarning = item.status !== 'DISPONIBLE';
          return (
            <div
              key={item.id}
              className={`bg-zinc-900/60 border rounded-2xl p-4 transition-all ${
                isWarning ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-white">{item.name}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    item.status === 'DISPONIBLE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-2xl font-bold text-white font-mono">{item.currentStock}</span>
                <span className="text-xs text-zinc-400">{item.unit}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60 text-xs">
                <span className="text-[10px] text-zinc-500">
                  Porción: {item.defaultPortion} {item.unit} • Est: {item.estimatedPriceBs ?? 0} Bs
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleConsume(item.id)}
                    title="Consumir porción"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 transition-colors border border-zinc-700"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRestock(item.id)}
                    title="Reponer stock"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-zinc-400 transition-colors border border-zinc-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Add New Item */}
      <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl max-w-xl">
        <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-400" />
          Añadir Insumo a la Despensa
        </h2>

        <form onSubmit={handleAddItem} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-zinc-400 mb-1">Nombre del Insumo</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Aceite de Oliva"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Stock Inicial</label>
            <input
              type="number"
              value={newStock}
              onChange={e => setNewStock(e.target.value)}
              placeholder="Ej: 500"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Unidad</label>
            <select
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option value="g">Gramos (g)</option>
              <option value="unidades">Unidades</option>
              <option value="ml">Mililitros (ml)</option>
              <option value="porciones">Porciones</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-zinc-400 mb-1">Precio Estimado de Reposición (Bs)</label>
            <input
              type="number"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              placeholder="Ej: 35.00"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <button
            type="submit"
            className="col-span-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20"
          >
            Registrar Insumo
          </button>
        </form>
      </div>
    </div>
  );
}
