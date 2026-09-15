'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Heart,
  Zap,
  TrendingDown,
  ShoppingBag,
  Users,
  Flame,
  Send,
  Sparkles,
  BookOpen,
  Lightbulb,
  Shirt,
  HeartPulse,
  Contact2,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  Wallet,
  Compass
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

const DASHBOARD_MODULES = [
  { href: '/dashboard/finance', title: 'Finanzas & Presupuesto', desc: 'Control quincenal y balances', icon: Wallet, color: 'text-emerald-400', border: 'hover:border-emerald-500/40' },
  { href: '/dashboard/pantry', title: 'Despensa & Compras', desc: 'Smart Pantry y auto-descuentos', icon: ShoppingBag, color: 'text-amber-400', border: 'hover:border-amber-500/40' },
  { href: '/dashboard/wardrobe', title: 'Guardarropa & Estilo', desc: 'Outfits y Wishlist de compras', icon: Shirt, color: 'text-purple-400', border: 'hover:border-purple-500/40' },
  { href: '/dashboard/roomies', title: 'Roomies & Depa', desc: 'División de gastos y acuerdos', icon: Users, color: 'text-cyan-400', border: 'hover:border-cyan-500/40' },
  { href: '/dashboard/crm', title: 'CRM & Contactos', desc: 'Directorio y cumpleaños', icon: Contact2, color: 'text-teal-400', border: 'hover:border-teal-500/40' },
  { href: '/dashboard/health', title: 'Salud & Bienestar', desc: 'Sondeo, hábitos y DDI', icon: HeartPulse, color: 'text-pink-400', border: 'hover:border-pink-500/40' },
  { href: '/dashboard/deepwork', title: 'Bloque de Poder', desc: '19:30 - 21:45 PM Deep Work', icon: Flame, color: 'text-rose-400', border: 'hover:border-rose-500/40' },
  { href: '/dashboard/ideas', title: 'Banco de Ideas', desc: 'Sandbox SaaS y Proyectos', icon: Lightbulb, color: 'text-yellow-400', border: 'hover:border-yellow-500/40' },
  { href: '/dashboard/knowledge', title: 'Obsidian Vault', desc: 'Notas de vida y RAG', icon: BookOpen, color: 'text-indigo-400', border: 'hover:border-indigo-500/40' },
  { href: '/dashboard/users', title: 'Gestión de Usuarios', desc: 'Multi-tenant y permisos', icon: ShieldCheck, color: 'text-blue-400', border: 'hover:border-blue-500/40' },
];

export default function SofiDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingQueueRef = useRef<string[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBuffering, loading]);

  // Cargar historial real y métricas financieras
  useEffect(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([
            {
              role: 'assistant',
              content: '¡Holi Ludwing! 🌸 Todo tu sistema 360° está conectado: finanzas, despensa, notas y Bloque de Poder.',
              time: '12:00',
            },
          ]);
        }
      })
      .catch(() => {});

    fetch('/api/finance').then((r) => r.json()).then(setMetrics).catch(() => {});
  }, []);

  // Función que despacha el lote acumulado de mensajes al servidor
  const dispatchAccumulatedMessages = async () => {
    const queue = [...pendingQueueRef.current];
    pendingQueueRef.current = [];
    setIsBuffering(false);

    if (queue.length === 0) return;

    setLoading(true);
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: queue }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response, time: timeStr }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '🌸 Todo registrado correctamente, dale.', time: timeStr },
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg) return;

    setInput('');
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Añadir mensaje visualmente a la UI al instante
    setMessages((prev) => [...prev, { role: 'user', content: userMsg, time: timeStr }]);

    // Agregar a la cola de ráfaga
    pendingQueueRef.current.push(userMsg);
    setIsBuffering(true);

    // Reiniciar temporizador del buffer (2.5 segundos tras el último mensaje)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      dispatchAccumulatedMessages();
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/70 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center shadow-lg shadow-pink-500/20 text-white font-bold text-base">
            🌸
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-white">Sofi AI 360°</h1>
              <span className="bg-emerald-500/10 text-emerald-400 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Telegram Live (@sofi_777_bot)
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Personalidad Camba Cruceña • Qwen 3.8 Flash & PostgreSQL RAG</p>
          </div>
        </div>

        {/* Sofi Mood & Nav Bar */}
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700">
            <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
            <span className="text-zinc-300">Afecto: <strong className="text-pink-300">90%</strong></span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-zinc-300">Paciencia: <strong className="text-amber-300">100%</strong></span>
          </div>
          <Link
            href="/dashboard/finance"
            className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-xl border border-zinc-700 text-zinc-300 transition-colors font-medium"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Módulos 360°</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Left Side: Navigation Hub & Discreet Summaries (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Quick Safe Margin Card */}
          <Link
            href="/dashboard/finance"
            className="bg-zinc-900/70 border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-4 transition-all block group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <h2 className="font-semibold text-xs text-zinc-200 group-hover:text-emerald-400 transition-colors">
                  Control Financiero & Presupuesto
                </h2>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400">Margen Diario Libre</span>
                <p className="text-lg font-bold text-emerald-400 mt-0.5 font-mono">
                  {metrics?.burnRateBs ?? 35} <span className="text-[10px] font-normal text-zinc-400">Bs/día</span>
                </p>
              </div>
              <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                <span className="text-[10px] text-zinc-400">Días Restantes Quincena</span>
                <p className="text-lg font-bold text-zinc-200 mt-0.5 font-mono">
                  {metrics?.daysRemaining ?? 12} <span className="text-[10px] font-normal text-zinc-400">días</span>
                </p>
              </div>
            </div>
          </Link>

          {/* Module Navigation Menu Grid */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Menú de Pantallas</span>
              <span className="text-[10px] text-zinc-500">10 Módulos Activos</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs max-h-[480px] overflow-y-auto pr-1">
              {DASHBOARD_MODULES.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className={`bg-zinc-900/70 border border-zinc-800/80 ${mod.border} p-3 rounded-2xl transition-all group flex items-center justify-between hover:bg-zinc-800/40`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800">
                        <Icon className={`w-4 h-4 ${mod.color}`} />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-zinc-200 group-hover:text-white block truncate text-[11px]">
                          {mod.title}
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">
                          {mod.desc}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-white shrink-0 ml-1 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Chat with Sofi (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex flex-col h-[650px] shadow-sm overflow-hidden">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="font-medium text-sm text-zinc-200">Conversación Central 24/7</span>
            </div>
            <span className="text-xs text-zinc-500">Sincronizado con Telegram & PostgreSQL</span>
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
            {isBuffering && !loading && (
              <div className="flex gap-3 justify-start items-center text-xs text-zinc-400">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-xs shrink-0 text-white font-bold">
                  🌸
                </div>
                <div className="bg-zinc-800/90 px-4 py-2 rounded-2xl border border-pink-500/30 flex items-center gap-2 text-pink-300">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></span>
                  <span>Sofi está esperando por si mandas más mensajes...</span>
                </div>
              </div>
            )}
            {loading && (
              <div className="flex gap-3 justify-start items-center text-xs text-zinc-400">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-xs shrink-0 text-white font-bold">
                  🌸
                </div>
                <div className="bg-zinc-800 px-4 py-2 rounded-2xl border border-zinc-700/60 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.4s]"></span>
                  <span>Sofi está respondiendo...</span>
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
              placeholder="Escribe a Sofi... (puedes enviar varias líneas seguidas)"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim()}
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

