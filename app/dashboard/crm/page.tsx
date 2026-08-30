'use client';

import React, { useState, useEffect } from 'react';
import { Contact2, Plus, Cake, User, ShieldCheck, FileText, CheckCircle } from 'lucide-react';

export default function CRMDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');

  const [bdayName, setBdayName] = useState('');
  const [bdayDate, setBdayDate] = useState('');
  const [bdayRel, setBdayRel] = useState('Amigo');

  const fetchCRM = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCRM();
  }, []);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'PERSON', name, role, note }),
      });
      setName('');
      setRole('');
      setNote('');
      fetchCRM();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddBirthday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bdayName || !bdayDate) return;
    try {
      await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'BIRTHDAY', personName: bdayName, birthDateIso: bdayDate, relationship: bdayRel }),
      });
      setBdayName('');
      setBdayDate('');
      fetchCRM();
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
            <Contact2 className="w-5 h-5 text-teal-400" />
            CRM Personal, Relaciones & Cumpleaños
          </h1>
          <p className="text-xs text-zinc-400">
            Directorio de roomies, socios de OtherBrain, clientes y alertas de cumpleaños
          </p>
        </div>
      </div>

      {/* Grid: Forms & Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Forms (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Add Contact */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-400" />
              Nuevo Contacto
            </h2>

            <form onSubmit={handleAddPerson} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Carlos, Natalia, Lucas"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Rol / Vínculo</label>
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="Ej: Colega Dev, Amigo, Cliente"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nota Inicial</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Contexto o acuerdos clave..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-teal-500/20"
              >
                Guardar Contacto
              </button>
            </form>
          </div>

          {/* Add Birthday */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Cake className="w-4 h-4 text-pink-400" />
              Registrar Cumpleaños
            </h2>

            <form onSubmit={handleAddBirthday} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={bdayName}
                  onChange={e => setBdayName(e.target.value)}
                  placeholder="Ej: Mamá, Valentina, Carlos"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Fecha</label>
                <input
                  type="date"
                  value={bdayDate}
                  onChange={e => setBdayDate(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-pink-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-pink-500/20"
              >
                Guardar Cumpleaños
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Contact Cards (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3">Directorio de Personas ({data?.persons?.length ?? 0})</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
              {data?.persons?.map((p: any) => (
                <div key={p.id} className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">{p.name}</span>
                    <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">
                      {p.role || 'Contacto'}
                    </span>
                  </div>

                  {p.notes?.length > 0 && (
                    <div className="space-y-1 text-[11px] text-zinc-400">
                      <span className="text-[10px] text-zinc-500 font-semibold block">Notas:</span>
                      {p.notes.map((n: any) => (
                        <p key={n.id} className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/60">
                          {n.content}
                        </p>
                      ))}
                    </div>
                  )}

                  {p.agreements?.length > 0 && (
                    <div className="space-y-1 text-[11px] text-emerald-400">
                      <span className="text-[10px] text-zinc-500 font-semibold block">Acuerdos Activos:</span>
                      {p.agreements.map((a: any) => (
                        <span key={a.id} className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {a.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Birthday List */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Cake className="w-4 h-4 text-pink-400" />
              Cumpleaños Registrados
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data?.birthdays?.map((b: any) => (
                <div key={b.id} className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl text-center">
                  <span className="font-semibold text-xs text-white block">{b.personName}</span>
                  <span className="text-xs text-pink-400 font-mono block mt-1">
                    {new Date(b.birthDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">{b.relationship}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
