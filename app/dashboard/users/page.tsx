'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Shield, UserCheck, UserX, Check, X, RefreshCw } from 'lucide-react';

interface UserRecord {
  id: string;
  name: string;
  telegramId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    financialTransactions: number;
    chatMessages: number;
    pantryItems: number;
    ideas: number;
  };
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newTelegramId, setNewTelegramId] = useState('');
  const [newRole, setNewRole] = useState('USER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTelegramId.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          telegramId: newTelegramId.trim(),
          role: newRole,
        }),
      });
      if (res.ok) {
        setNewName('');
        setNewTelegramId('');
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: UserRecord) => {
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Gestión de Usuarios Multi-Tenant
            </h1>
            <p className="text-xs text-zinc-400">
              Whitelist dinámica en Base de Datos para acceso al Bot de Telegram y Web App
            </p>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Grid: Form & User List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Form: Add User */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl h-fit">
          <h2 className="font-semibold text-sm text-zinc-200 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-pink-400" />
            Dar de Alta Nuevo Usuario
          </h2>
          <p className="text-xs text-zinc-400 mb-4">
            Al registrarlo aquí, el usuario podrá interactuar inmediatamente con Sofi en Telegram sin reiniciar el servidor.
          </p>

          <form onSubmit={handleCreateUser} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Ludwing Armijo"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Telegram User ID (Numérico)</label>
              <input
                type="text"
                value={newTelegramId}
                onChange={(e) => setNewTelegramId(e.target.value)}
                placeholder="Ej: 123456789"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Rol</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-pink-500"
              >
                <option value="ADMIN">ADMIN (Acceso Total)</option>
                <option value="USER">USER (Usuario Estándar)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-md shadow-pink-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Registrando...' : 'Registrar Usuario'}
            </button>
          </form>
        </div>

        {/* User Table List */}
        <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-zinc-200">Usuarios Activos ({users.length})</h2>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-white">{u.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        u.role === 'ADMIN'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {u.role}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        u.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {u.isActive ? 'Activo' : 'Pausado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="font-mono">ID: {u.telegramId}</span>
                    <span>•</span>
                    <span>{u._count?.chatMessages ?? 0} mensajes</span>
                    <span>•</span>
                    <span>{u._count?.financialTransactions ?? 0} gastos</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleUserStatus(u)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                      u.isActive
                        ? 'border-zinc-700 bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 text-zinc-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    {u.isActive ? (
                      <>
                        <UserX className="w-3.5 h-3.5 text-zinc-400" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Activar
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}

            {users.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No hay usuarios registrados aún. Crea el primer usuario a la izquierda o envía un mensaje desde Telegram.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
