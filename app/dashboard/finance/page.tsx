'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Plus, ShieldAlert, ArrowRight, DollarSign } from 'lucide-react';

export default function FinanceDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('COMIDA');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('EXPENSE');
  const [submitting, setSubmitting] = useState(false);

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    setSubmitting(true);
    try {
      await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, category, amountBs: amount, description }),
      });
      setAmount('');
      setDescription('');
      fetchFinance();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Finanzas & Control Quincenal
          </h1>
          <p className="text-xs text-zinc-400">
            Presupuesto de {data?.fortnight || 'Quincena activa'} • Sueldo Base: 3,300 Bs / mes
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Margen Diario Seguro (Burn Rate)</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {data?.burnRateBs ?? 0} <span className="text-xs font-normal text-zinc-400">Bs/día</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Quedan {data?.daysRemaining ?? 0} días de quincena</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Gastado esta Quincena</span>
          <p className="text-2xl font-bold text-rose-400 mt-1">
            {data?.totalSpentFortnight ?? 0} <span className="text-xs font-normal text-zinc-400">Bs</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Presupuesto libre: {data?.remainingFreeBudget ?? 0} Bs</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Deuda Activa (Maycol)</span>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {data?.debt?.remainingAmountBs ?? 1500} <span className="text-xs font-normal text-zinc-400">Bs</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">250 Bs/quincena (3 meses restantes)</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Paga Fija Quincenal</span>
          <p className="text-2xl font-bold text-white mt-1">
            1,650 <span className="text-xs font-normal text-zinc-400">Bs</span>
          </p>
          <span className="text-[10px] text-emerald-400 mt-1 block">Días 15 y 30 de cada mes</span>
        </div>
      </div>

      {/* Grid: Form & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Quick Add */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl h-fit">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            Registrar Transacción
          </h2>

          <form onSubmit={handleAddTransaction} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  type === 'EXPENSE'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  type === 'INCOME'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                }`}
              >
                Ingreso
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Monto en Bolivianos (Bs)</label>
              <input
                type="number"
                step="0.5"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Ej: 25.00"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {type === 'EXPENSE' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="COMIDA">COMIDA (Almuerzo, feria, snacks)</option>
                  <option value="TRANSPORTE">TRANSPORTE (Micros, trufis)</option>
                  <option value="SERVICIOS">SERVICIOS (Gas, WiFi, luz)</option>
                  <option value="SALUD">SALUD (Farmacia, consultas)</option>
                  <option value="SALIDAS_OCIO">SALIDAS / OCIO</option>
                  <option value="RECREATIVO">RECREATIVO / HÁBITOS</option>
                  <option value="TRABAJO">TRABAJO / HERRAMIENTAS</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ej: Almuerzo pollo a la brasa"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar Transacción'}
            </button>
          </form>
        </div>

        {/* Transaction History List */}
        <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Historial de Transacciones</h2>
            <span className="text-xs text-zinc-500">{data?.transactions?.length ?? 0} registros</span>
          </div>

          <div className="divide-y divide-zinc-800/60 max-h-[500px] overflow-y-auto">
            {data?.transactions?.map((t: any) => (
              <div key={t.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl border ${
                      t.type === 'INCOME'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {t.type === 'INCOME' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="font-medium text-xs text-white block">{t.description}</span>
                    <span className="text-[10px] text-zinc-500">{t.category} • {new Date(t.date).toLocaleDateString()}</span>
                  </div>
                </div>

                <span
                  className={`font-bold text-xs font-mono ${
                    t.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {t.type === 'INCOME' ? '+' : '-'}{t.amountBs} Bs
                </span>
              </div>
            ))}

            {(!data?.transactions || data.transactions.length === 0) && !loading && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No hay transacciones registradas en esta quincena.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
