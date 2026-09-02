'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  FileText,
  FolderUp,
  FolderSync,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Tag,
  X,
  Sparkles
} from 'lucide-react';

export default function KnowledgeDashboardPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [search, setSearch] = useState('');
  
  // Modals & States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    isDanger: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirmar',
    isDanger: false,
    onConfirm: () => {},
  });

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('PROYECTO');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [localPath, setLocalPath] = useState('d:/Users/ludwi/Documents/workspace/my-brain-obsidian/01 - Personal');

  const folderInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const json = await res.json();
      if (json.documents) {
        setDocs(json.documents);
        if (json.documents.length > 0 && !selectedDoc) {
          setSelectedDoc(json.documents[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, []);

  // 1. Manejador de Selección de Carpeta del Navegador
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    showToast('Leyendo archivos Markdown de la carpeta seleccionada...', 'info');

    const mdFiles: { title: string; content: string; sourcePath: string; category: string; tags: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.md')) {
        const text = await file.text();
        const cleanTitle = file.name.replace('.md', '');
        mdFiles.push({
          title: cleanTitle,
          content: text,
          sourcePath: file.webkitRelativePath || file.name,
          category: 'OBSIDIAN_VAULT',
          tags: '#obsidian, #importado',
        });
      }
    }

    if (mdFiles.length === 0) {
      showToast('No se encontraron archivos .md en la carpeta seleccionada.', 'error');
      setImporting(false);
      return;
    }

    try {
      const res = await fetch('/api/knowledge/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: mdFiles }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`¡Éxito! Se importaron ${data.count} notas con sus fragmentos indexados.`, 'success');
        fetchKnowledge();
      } else {
        showToast(`Error: ${data.error || 'No se pudo importar'}`, 'error');
      }
    } catch (err) {
      showToast(`Error al conectar con el servidor: ${String(err)}`, 'error');
    } finally {
      setImporting(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // 2. Manejador de Sincronización de Ruta Local
  const handleSyncLocalPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPath) return;

    setImporting(true);
    showToast('Escaneando carpeta local en el servidor...', 'info');

    try {
      const res = await fetch('/api/knowledge/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localPath, category: 'OBSIDIAN', tags: '#obsidian, #vault' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`¡Éxito! ${data.count} archivos sincronizados desde "${localPath}".`, 'success');
        setShowSyncModal(false);
        fetchKnowledge();
      } else {
        showToast(`Error: ${data.error || 'No se encontró la ruta'}`, 'error');
      }
    } catch (err) {
      showToast(`Error al procesar ruta: ${String(err)}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    try {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category, tags }),
      });
      setTitle('');
      setContent('');
      setTags('');
      setShowAddModal(false);
      showToast(`Documento "${title}" guardado e indexado.`, 'success');
      fetchKnowledge();
    } catch (e) {
      showToast('Error al guardar documento.', 'error');
    }
  };

  const requestDeleteDoc = (id: string, docTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Documento',
      description: `¿Estás seguro de que deseas eliminar permanentemente la nota "${docTitle}" y todos sus fragmentos indexados?`,
      confirmText: 'Eliminar Documento',
      isDanger: true,
      onConfirm: async () => {
        try {
          await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
          showToast(`Documento "${docTitle}" eliminado.`, 'info');
          fetchKnowledge();
          if (selectedDoc?.id === id) setSelectedDoc(null);
        } catch {
          showToast('Error al eliminar.', 'error');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const requestClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Vaciar Toda la Base de Conocimiento?',
      description: 'Esta acción eliminará todas las notas y chunks de PostgreSQL. Podrás volver a importar tus carpetas cuando lo desees.',
      confirmText: 'Sí, Vaciar Todo',
      isDanger: true,
      onConfirm: async () => {
        try {
          await fetch('/api/knowledge?clearAll=true', { method: 'DELETE' });
          showToast('Todas las notas han sido eliminadas.', 'info');
          fetchKnowledge();
          setSelectedDoc(null);
        } catch {
          showToast('Error al vaciar base de conocimiento.', 'error');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const filteredDocs = docs.filter(
    d =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.content.toLowerCase().includes(search.toLowerCase()) ||
      (d.tags && d.tags.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification Floating */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
              : 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />}
          <span className="text-xs font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-zinc-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-zinc-800 gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Base de Conocimiento & Obsidian Vault
          </h1>
          <p className="text-xs text-zinc-400">
            Importa carpetas enteras de `.md` a PostgreSQL • Búsqueda semántica & RAG en vivo para Sofi
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden folder input */}
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderUpload}
            className="hidden"
            {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
          />

          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={importing}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-colors border border-zinc-700 disabled:opacity-50"
          >
            <FolderUp className="w-4 h-4 text-indigo-400" />
            <span>Seleccionar Carpeta .md</span>
          </button>

          <button
            onClick={() => setShowSyncModal(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-colors border border-zinc-700"
          >
            <FolderSync className="w-4 h-4 text-cyan-400" />
            <span>Sincronizar Ruta Local</span>
          </button>

          {docs.length > 0 && (
            <button
              onClick={requestClearAll}
              className="bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-colors border border-zinc-700"
              title="Vaciar todas las notas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar Base</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Nota</span>
          </button>
        </div>
      </div>

      {/* Grid: Search & Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
        {/* Left Column: Document List (4 cols) */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 border-b border-zinc-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar en tus notas de Obsidian..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
            {filteredDocs.map(doc => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-500/10 border-l-2 border-indigo-400' : 'hover:bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white truncate">{doc.title}</span>
                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                      {doc._count?.chunks ?? 0} chunks
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2">{doc.content}</p>
                  {doc.tags && (
                    <span className="text-[9px] text-indigo-400 mt-1.5 block font-mono">{doc.tags}</span>
                  )}
                </div>
              );
            })}

            {filteredDocs.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No se encontraron notas. Haz clic en <strong>"Seleccionar Carpeta .md"</strong> para importar tu Vault.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Markdown Document Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
          {selectedDoc ? (
            <div className="flex flex-col h-full">
              {/* Header Viewer */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    {selectedDoc.title}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Categoría: <span className="text-zinc-200">{selectedDoc.category}</span> • {selectedDoc.sourcePath ? `Ruta: ${selectedDoc.sourcePath}` : `Actualizado: ${new Date(selectedDoc.updatedAt).toLocaleDateString()}`}
                  </p>
                </div>

                <button
                  onClick={() => requestDeleteDoc(selectedDoc.id, selectedDoc.title)}
                  title="Eliminar documento"
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 transition-colors border border-zinc-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Content Box */}
              <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed bg-zinc-950/40">
                {selectedDoc.content}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-3">
              <BookOpen className="w-12 h-12 text-zinc-700" />
              <div>
                <p className="text-sm font-semibold text-zinc-300">Base de Conocimiento</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Selecciona una nota de la izquierda o importa una carpeta completa con el botón de arriba.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modern Custom Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${confirmDialog.isDanger ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{confirmDialog.description}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
                  confirmDialog.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sync Local Path */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-cyan-400" />
                Sincronizar Carpeta Local del Servidor
              </h2>
              <button onClick={() => setShowSyncModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSyncLocalPath} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Ruta local de la carpeta con archivos .md</label>
                <input
                  type="text"
                  value={localPath}
                  onChange={e => setLocalPath(e.target.value)}
                  placeholder="d:/Users/ludwi/Documents/workspace/my-brain-obsidian/..."
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span>Presets rápidos:</span>
                <button
                  type="button"
                  onClick={() => setLocalPath('d:/Users/ludwi/Documents/workspace/my-brain-obsidian/01 - Personal')}
                  className="text-cyan-400 hover:underline"
                >
                  01 - Personal
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setLocalPath('d:/Users/ludwi/Documents/workspace/my-brain-obsidian/01 - Personal/01 - Finanzas')}
                  className="text-cyan-400 hover:underline"
                >
                  01 - Finanzas
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-4 py-2 rounded-xl text-xs bg-cyan-500 hover:bg-cyan-600 text-black font-semibold shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {importing ? 'Sincronizando...' : 'Iniciar Sincronización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Manual Note */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Crear Nota Markdown en Base de Conocimiento
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Estrategia de Ventas B2B"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PROYECTO">PROYECTO</option>
                    <option value="FINANZAS">FINANZAS</option>
                    <option value="RUTINA">RUTINA</option>
                    <option value="IDEAS">IDEAS</option>
                    <option value="OBSIDIAN">OBSIDIAN</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Tags (opcional)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="Ej: #sofi, #marketing"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Contenido Markdown</label>
                <textarea
                  rows={8}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="# Mi Nota..."
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-md shadow-indigo-500/20"
                >
                  Guardar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
