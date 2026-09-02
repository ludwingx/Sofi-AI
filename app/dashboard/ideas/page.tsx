'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, Plus, Tag, CheckCircle2, Clock, Archive } from 'lucide-react';

export default function IdeasDashboardPage() {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('TECH');
  const [tags, setTags] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const fetchIdeas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ideas');
      const json = await res.json();
      if (json.ideas) setIdeas(json.ideas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, []);

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    try {
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category, tags }),
      });
      setTitle('');
      setDescription('');
      setTags('');
      fetchIdeas();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (ideaId: string, status: string) => {
    try {
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STATUS', ideaId, status }),
      });
      fetchIdeas();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredIdeas = selectedCategory === 'ALL'
    ? ideas
    : ideas.filter(i => i.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            Sandbox de Ideas & Proyectos
          </h1>
          <p className="text-xs text-zinc-400">
            Banco de ideas, SaaS, automatizaciones y conceptos a futuro
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 text-xs">
          {['ALL', 'TECH', 'NEGOCIO', 'PERSONAL', 'SOFI'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl border transition-colors ${
                selectedCategory === cat
                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 font-semibold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Form & Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Add Idea */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl h-fit">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-yellow-400" />
            Capturar Nueva Idea
          </h2>

          <form onSubmit={handleAddIdea} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Título de la Idea</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Bot IA para Bienes Raíces en Santa Cruz"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-yellow-500"
                >
                  <option value="TECH">TECH</option>
                  <option value="NEGOCIO">NEGOCIO</option>
                  <option value="PERSONAL">PERSONAL</option>
                  <option value="SOFI">SOFI</option>
                  <option value="GENERAL">GENERAL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="ai, saas, b2b"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Descripción / Notas Clave</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Explicación o modelo de monetización..."
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black font-semibold text-xs py-2.5 rounded-xl transition-all shadow-md shadow-yellow-500/20"
            >
              Guardar en Sandbox
            </button>
          </form>
        </div>

        {/* Ideas Grid List */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 h-fit">
          {filteredIdeas.map(idea => (
            <div key={idea.id} className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full font-semibold">
                    {idea.category}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      idea.status === 'EN_PROCESO'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : idea.status === 'ARCHIVADA'
                        ? 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {idea.status}
                  </span>
                </div>

                <h3 className="font-bold text-xs text-white mb-1">{idea.title}</h3>
                <p className="text-[11px] text-zinc-300 whitespace-pre-wrap">{idea.description}</p>
                {idea.tags && (
                  <span className="text-[10px] text-zinc-500 mt-2 block font-mono">#{idea.tags.split(',').join(' #')}</span>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-end gap-1.5 text-[10px]">
                {idea.status !== 'EN_PROCESO' && (
                  <button
                    onClick={() => handleUpdateStatus(idea.id, 'EN_PROCESO')}
                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-zinc-400 transition-colors"
                  >
                    En Proceso
                  </button>
                )}
                {idea.status !== 'ARCHIVADA' && (
                  <button
                    onClick={() => handleUpdateStatus(idea.id, 'ARCHIVADA')}
                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                  >
                    Archivar
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredIdeas.length === 0 && !loading && (
            <div className="col-span-2 p-12 text-center text-xs text-zinc-500 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
              No hay ideas en esta categoría.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
