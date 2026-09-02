'use client';

import React, { useState, useEffect } from 'react';
import { Flame, Clock, CheckSquare, Plus, Award } from 'lucide-react';

export default function DeepWorkDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState('Sofi AI');
  const [hours, setHours] = useState('2.25');
  const [deliverables, setDeliverables] = useState('');

  const fetchDeepWork = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deepwork');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeepWork();
  }, []);

  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverables || !hours) return;
    try {
      await fetch('/api/deepwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, hoursLogged: hours, deliverables }),
      });
      setDeliverables('');
      fetchDeepWork();
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
            <Flame className="w-5 h-5 text-rose-500" />
            Bloque de Poder & Deep Work (19:30 - 21:45 PM)
          </h1>
          <p className="text-xs text-zinc-400">
            Horario sagrado diario para proyectos propios (Sofi AI, BrandBook AI, SaaS)
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Total Horas Acumuladas</span>
          <p className="text-2xl font-bold text-rose-400 mt-1 font-mono">
            {data?.totalHours ?? 0} <span className="text-xs font-normal text-zinc-400">horas</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Meta semanal: 12 horas</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Sesiones Registradas</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            {data?.count ?? 0}
          </p>
          <span className="text-[10px] text-emerald-400 mt-1 block">Racha activa de constancia</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Horario Fijo de Bloque</span>
          <p className="text-sm font-semibold text-zinc-200 mt-2">
            19:30 a 21:45 PM (2.25h)
          </p>
          <span className="text-[10px] text-rose-400 mt-1 block">Notificación automática a las 19:25 PM</span>
        </div>
      </div>

      {/* Grid: Form & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Add Session */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl h-fit">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-rose-400" />
            Registrar Avance de Sesión
          </h2>

          <form onSubmit={handleLogSession} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Proyecto</label>
              <input
                type="text"
                value={project}
                onChange={e => setProject(e.target.value)}
                placeholder="Ej: Sofi AI, OtherBrain"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Horas Dedicadas</label>
              <input
                type="number"
                step="0.25"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="Ej: 2.25"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Entregables Concretos Logrados</label>
              <textarea
                rows={3}
                value={deliverables}
                onChange={e => setDeliverables(e.target.value)}
                placeholder="Ej: Completado módulo de Knowledge Base y diseño de UI..."
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-rose-500/20"
            >
              Guardar Sesión
            </button>
          </form>
        </div>

        {/* History List */}
        <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Historial del Bloque de Poder</h2>
            <span className="text-xs text-zinc-500">{data?.logs?.length ?? 0} sesiones</span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {data?.logs?.map((l: any) => (
              <div key={l.id} className="p-4 space-y-1.5 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{l.project}</span>
                    <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-mono">
                      {l.hoursLogged}h
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{new Date(l.createdAt).toLocaleDateString()}</span>
                </div>

                <p className="text-xs text-zinc-300 whitespace-pre-wrap">{l.deliverables}</p>
              </div>
            ))}

            {(!data?.logs || data.logs.length === 0) && !loading && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No hay sesiones de Deep Work registradas aún.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
