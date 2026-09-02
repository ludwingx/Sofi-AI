'use client';

import React, { useState, useEffect } from 'react';
import { HeartPulse, Zap, AlertOctagon, Plus, Activity, Heart } from 'lucide-react';

export default function HealthDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [discomfortType, setDiscomfortType] = useState('Dolor de cabeza');
  const [symptoms, setSymptoms] = useState('');
  const [triggers, setTriggers] = useState('');

  const [habitType, setHabitType] = useState('MARIHUANA');
  const [habitAmount, setHabitAmount] = useState('');
  const [habitDesc, setHabitDesc] = useState('');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleAddEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms) return;
    try {
      await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'HEALTH_EPISODE',
          discomfortType,
          symptoms,
          possibleTriggers: triggers,
        }),
      });
      setSymptoms('');
      setTriggers('');
      fetchHealth();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitDesc) return;
    try {
      await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'HABIT',
          habitType,
          amountBs: habitAmount,
          description: habitDesc,
        }),
      });
      setHabitAmount('');
      setHabitDesc('');
      fetchHealth();
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
            <HeartPulse className="w-5 h-5 text-rose-400" />
            Salud, Disciplina Diaria (DDI) & Hábitos
          </h1>
          <p className="text-xs text-zinc-400">
            Sondeo de síntomas físicos, rendimiento, racha limpia y motor de paciencia de Sofi
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Paciencia de Sofi</span>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">
            {data?.mood?.patience ?? 100}%
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            {data?.mood?.patience < 40 ? '⚠️ Modo Tough Love activado' : 'Trato cariñoso y equilibrado'}
          </span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Afecto de Sofi</span>
          <p className="text-2xl font-bold text-pink-400 mt-1 font-mono">
            {data?.mood?.affection ?? 90}%
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Cercanía y calidez emocional</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Racha Limpia</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            {data?.mood?.cleanStreakDays ?? 0} <span className="text-xs font-normal text-zinc-400">días</span>
          </p>
          <span className="text-[10px] text-zinc-500 mt-1 block">Días consecutivos sin vicios</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-xs text-zinc-400">Disciplina Diaria (DDI)</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            {data?.dailyLogs?.[0]?.ddiScore ?? 75}/100
          </p>
          <span className="text-[10px] text-emerald-400 mt-1 block">Último puntaje calculado</span>
        </div>
      </div>

      {/* Grid: Forms & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Symptoms Section */}
        <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            Registro de Síntomas & Malestar Físico
          </h2>

          <form onSubmit={handleAddEpisode} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tipo de Malestar</label>
              <input
                type="text"
                value={discomfortType}
                onChange={e => setDiscomfortType(e.target.value)}
                placeholder="Ej: Dolor de cabeza, Fatiga ocular, Gastritis"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Síntomas Detallados</label>
              <textarea
                rows={2}
                value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                placeholder="Punzadas en la sien derecha, pesadez en los ojos..."
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-rose-500/20"
            >
              Registrar Episodio de Salud
            </button>
          </form>

          {/* Episode List */}
          <div className="space-y-2 pt-3 border-t border-zinc-800 max-h-[250px] overflow-y-auto">
            <span className="text-xs text-zinc-400 font-medium block">Historial de Episodios:</span>
            {data?.episodes?.map((ep: any) => (
              <div key={ep.id} className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-400">{ep.discomfortType}</span>
                  <span className="text-[10px] text-zinc-500">{new Date(ep.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-zinc-300 text-[11px]">{ep.symptoms}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sensitive Habits / Accountability Section */}
        <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-400" />
            Rendición de Cuentas & Hábitos Sensibles
          </h2>

          <form onSubmit={handleAddHabit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Tipo de Evento</label>
                <select
                  value={habitType}
                  onChange={e => setHabitType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="MARIHUANA">MARIHUANA</option>
                  <option value="ALCOHOL">ALCOHOL</option>
                  <option value="GASTO_IMPULSIVO">GASTO IMPULSIVO</option>
                  <option value="DISCIPLINA_CUMPLIDA">DISCIPLINA CUMPLIDA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Gasto Asociado (Bs)</label>
                <input
                  type="number"
                  value={habitAmount}
                  onChange={e => setHabitAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Motivo o Contexto</label>
              <input
                type="text"
                value={habitDesc}
                onChange={e => setHabitDesc(e.target.value)}
                placeholder="Ej: Fumé para relajarme después de trabajar..."
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20"
            >
              Registrar Hábito
            </button>
          </form>

          {/* Habit History */}
          <div className="space-y-2 pt-3 border-t border-zinc-800 max-h-[250px] overflow-y-auto">
            <span className="text-xs text-zinc-400 font-medium block">Historial de Hábitos:</span>
            {data?.habits?.map((h: any) => (
              <div key={h.id} className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-amber-400 text-[11px] block">{h.habitType}</span>
                  <p className="text-zinc-300 text-[11px]">{h.description}</p>
                </div>
                <div className="text-right">
                  {h.amountBs && <span className="font-mono text-rose-400 font-bold block">{h.amountBs} Bs</span>}
                  <span className="text-[10px] text-zinc-500">{new Date(h.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
