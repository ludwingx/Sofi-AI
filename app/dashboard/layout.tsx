'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  ShoppingBag,
  Users,
  Flame,
  BookOpen,
  Lightbulb,
  Shirt,
  HeartPulse,
  Contact2,
  ShieldCheck,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Chat & Portada 360°', icon: LayoutDashboard },
  { href: '/dashboard/finance', label: 'Finanzas & Presupuesto', icon: Wallet },
  { href: '/dashboard/pantry', label: 'Despensa & Compras', icon: ShoppingBag },
  { href: '/dashboard/roomies', label: 'Roomie Split (Depa)', icon: Users },
  { href: '/dashboard/deepwork', label: 'Deep Work (19:30)', icon: Flame },
  { href: '/dashboard/knowledge', label: 'Obsidian Vault', icon: BookOpen },
  { href: '/dashboard/ideas', label: 'Sandbox de Ideas', icon: Lightbulb },
  { href: '/dashboard/wardrobe', label: 'Armario & Wishlist', icon: Shirt },
  { href: '/dashboard/health', label: 'Salud, DDI & Hábitos', icon: HeartPulse },
  { href: '/dashboard/crm', label: 'CRM & Directorio', icon: Contact2 },
  { href: '/dashboard/users', label: 'Usuarios Multi-Tenant', icon: ShieldCheck },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-zinc-900/70 border-r border-zinc-800/80 p-4 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <Link href="/" className="flex items-center gap-3 px-2 py-3 mb-4 rounded-xl hover:bg-zinc-800/50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-base shadow-md shadow-pink-500/20 text-white font-bold">
              🌸
            </div>
            <div>
              <h1 className="font-bold text-sm text-white flex items-center gap-1.5">
                Sofi AI <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-1.5 py-0.2 rounded-full font-normal">v2.0</span>
              </h1>
              <p className="text-[11px] text-zinc-400">Segundo Cerebro 360°</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-pink-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Info */}
        <div className="pt-4 border-t border-zinc-800/80 px-2 text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Tono: <strong>Camba Cruceña</strong></span>
          </div>
          <p>Telegram: @sofi_777_bot</p>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
