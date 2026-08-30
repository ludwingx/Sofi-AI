'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Zap,
  TrendingDown,
  ShoppingBag,
  Users,
  Flame,
  Send,
  Sparkles,
  Bot,
  Calendar,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export default function SofiDashboard() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola Ludwing! 🌸 Estoy lista para acompañarte hoy. Todo tu sistema de finanzas, despensa, roomies y Bloque de Poder está conectado.',
      time: '12:00',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setMessages((prev) => [...prev, { role: 'user', content: userMsg, time: timeStr }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response, time: timeStr }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '🌸 Tuve un problema al procesar la respuesta, pero todo está en orden.', time: timeStr },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '🌸 No pude conectar con el servidor en este momento.', time: timeStr },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center shadow-lg shadow-pink-500/20 text-white font-bold text-lg">
            🌸
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg text-white">Sofi AI</h1>
              <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Telegram Live (@sofi_777_bot)
              </span>
            </div>
            <p className="text-xs text-zinc-400">Copiloto de Vida & Ejecutiva Personal • Powered by DeepSeek V4</p>
          </div>
        </div>

        {/* Sofi Mood / Stats Header */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700">
            <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
            <span className="text-zinc-300">Afecto: <strong className="text-pink-300">90%</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-zinc-300">Paciencia: <strong className="text-amber-300">100%</strong></span>
          </div>
          <a
            href="/dashboard/users"
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 transition-colors"
          >
            <Users className="w-4 h-4 text-pink-400" />
            <span>Usuarios</span>
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Left Side: Widgets & Control Center (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Card 1: Finanzas & Quincena */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <h2 className="font-medium text-sm text-zinc-200">Presupuesto Quincenal</h2>
              </div>
              <span className="text-xs text-zinc-400">Base: 1,650 Bs</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60">
                <span className="text-xs text-zinc-400">Margen Diario Seguro</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">~35.00 <span className="text-xs font-normal text-zinc-400">Bs/día</span></p>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/60">
                <span className="text-xs text-zinc-400">Deuda Maycol</span>
                <p className="text-xl font-bold text-rose-400 mt-1">1,500 <span className="text-xs font-normal text-zinc-400">Bs (250/qna)</span></p>
              </div>
            </div>
          </div>

          {/* Card 2: Despensa & Alacena */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h2 className="font-medium text-sm text-zinc-200">Despensa Inteligente</h2>
              </div>
              <span className="text-xs text-emerald-400">6 insumos rastreados</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg border border-zinc-800/40">
                <span className="text-zinc-300">Yerba Mate (500g)</span>
                <span className="text-emerald-400 font-medium">Disponible</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg border border-zinc-800/40">
                <span className="text-zinc-300">Huevos Frescos (1 Maple)</span>
                <span className="text-emerald-400 font-medium">30 uds</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg border border-zinc-800/40">
                <span className="text-zinc-300">Café Molido</span>
                <span className="text-emerald-400 font-medium">200g</span>
              </div>
            </div>
          </div>

          {/* Card 3: Roomie Split & Deep Work */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="font-medium text-xs text-zinc-200">Roomies (4)</h3>
              </div>
              <p className="text-xs text-zinc-400">Ramón, Rocío, Molly, Ludwing</p>
              <div className="mt-2 text-xs text-emerald-400 font-medium">División 1/4 activa</div>
            </div>

            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <h3 className="font-medium text-xs text-zinc-200">Bloque de Poder</h3>
              </div>
              <p className="text-xs text-zinc-400">19:30 - 21:45 PM</p>
              <div className="mt-2 text-xs text-rose-400 font-medium">Deep Work Diario</div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Chat with Sofi (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex flex-col h-[650px] shadow-sm overflow-hidden">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="font-medium text-sm text-zinc-200">Conversación Central</span>
            </div>
            <span className="text-xs text-zinc-500">Sincronizado con Telegram</span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-xs shrink-0 text-white font-bold">
                    🌸
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'bg-rose-500 text-white rounded-br-none'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-none border border-zinc-700/60'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  <span className="text-[10px] opacity-60 mt-1 block text-right">{m.time}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start items-center text-xs text-zinc-400">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-xs shrink-0 text-white font-bold">
                  🌸
                </div>
                <div className="bg-zinc-800 px-4 py-2 rounded-2xl border border-zinc-700/60 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.4s]"></span>
                  <span>Sofi está pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-zinc-800/80 bg-zinc-900/60 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe a Sofi... (ej: 'Gasté 25 Bs en almuerzo', 'Me preparé un mate', '¿Cómo vamos?')"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-md shadow-pink-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
