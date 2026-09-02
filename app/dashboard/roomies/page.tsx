'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, CheckCircle2, DollarSign } from 'lucide-react';

export default function RoomiesDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('Ludwing');

  const fetchRoomies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/roomies');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomies();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept || !amount) return;
    try {
      await fetch('/api/roomies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept, totalAmountBs: amount, paidBy }),
      });
      setConcept('');
      setAmount('');
      fetchRoomies();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSettle = async (expenseId: string) => {
    try {
      await fetch('/api/roomies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SETTLE', expenseId }),
      });
      fetchRoomies();
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
            <Users className="w-5 h-5 text-cyan-400" />
            Roomie Split (Cuentas del Departamento)
          </h1>
          <p className="text-xs text-zinc-400">
            División automática 1/4 entre Ramón, Rocío, Molly y Ludwing
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Gastos Comunes Pendientes</span>
          <p className="text-2xl font-bold text-cyan-400 mt-1">
            {data?.totalPendingBs ?? 0} <span className="text-xs font-normal text-zinc-400">Bs</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">{data?.pendingCount ?? 0} cuentas sin liquidar</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Cuota por Roomie (1/4)</span>
          <p className="text-2xl font-bold text-white mt-1">
            {data?.totalPendingBs ? (data.totalPendingBs / 4).toFixed(2) : 0} <span className="text-xs font-normal text-zinc-400">Bs/persona</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Saldo pendiente acumulado</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Compañeros de Piso</span>
          <p className="text-sm font-semibold text-zinc-200 mt-2">
            Ramón, Rocío, Molly, Ludwing
          </p>
          <span className="text-[10px] text-emerald-400 mt-1 block">4 miembros activos</span>
        </div>
      </div>

      {/* Grid: Form & Expense List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Add Expense */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl h-fit">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" />
            Registrar Gasto del Depa
          </h2>

          <form onSubmit={handleAddExpense} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Concepto</label>
              <input
                type="text"
                value={concept}
                onChange={e => setConcept(e.target.value)}
                placeholder="Ej: Garrafa de gas, Detergente"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Monto Total en Bs</label>
              <input
                type="number"
                step="0.5"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Ej: 25.00"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">¿Quién pagó?</label>
              <select
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="Ludwing">Ludwing</option>
                <option value="Ramón">Ramón</option>
                <option value="Rocío">Rocío</option>
                <option value="Molly">Molly</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-cyan-500/20"
            >
              Registrar y Dividir
            </button>
          </form>
        </div>

        {/* Expense List */}
        <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Historial de Gastos Compartidos</h2>
            <span className="text-xs text-zinc-500">{data?.expenses?.length ?? 0} registrados</span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {data?.expenses?.map((e: any) => (
              <div key={e.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{e.concept}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        e.status === 'PENDIENTE'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Pagó: <strong className="text-zinc-200">{e.paidBy}</strong> • Total: <strong className="text-cyan-400 font-mono">{e.totalAmountBs} Bs</strong> • Por persona: <span className="text-white font-mono">{e.perPersonBs} Bs</span>
                  </p>
                </div>

                {e.status === 'PENDIENTE' && (
                  <button
                    onClick={() => handleSettle(e.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Liquidar
                  </button>
                )}
              </div>
            ))}

            {(!data?.expenses || data.expenses.length === 0) && !loading && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No hay gastos compartidos registrados en el departamento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
