import React, { useState } from 'react';
import { Plus, Phone, Mail, Truck } from 'lucide-react';
import { crearProveedor, actualizarProveedor } from '../../api/api';

export default function Erp_Proveedores({ isOpen, onClose, proveedores, onCambio, config }) {
  const colorBtn = config?.colorPrimario || '#ff5a1f';
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', ruc: '', direccion: '' });
  const [guardando, setGuardando] = useState(false);

  if (!isOpen) return null;

  const abrirNuevo = () => {
    setEditando('nuevo');
    setForm({ nombre: '', telefono: '', email: '', ruc: '', direccion: '' });
  };

  const abrirEditar = (p) => {
    setEditando(p.id);
    setForm({ nombre: p.nombre || '', telefono: p.telefono || '', email: p.email || '', ruc: p.ruc || '', direccion: p.direccion || '' });
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio.');
    setGuardando(true);
    try {
      if (editando === 'nuevo') {
        await crearProveedor(form);
      } else {
        await actualizarProveedor(editando, form);
      }
      setEditando(null);
      onCambio?.();
    } catch (err) {
      alert('Error al guardar el proveedor.');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (p) => {
    if (!window.confirm(`¿Desactivar a "${p.nombre}"? No aparecerá al crear nuevos pedidos.`)) return;
    await actualizarProveedor(p.id, { activo: false });
    onCambio?.();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[125] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#111] border border-[#222] w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        <div className="p-8 border-b border-[#222] flex justify-between items-center bg-[#161616] shrink-0">
          <div>
            <p className="text-[10px] text-[#ff5a1f] font-black uppercase tracking-widest mb-1">Contactos</p>
            <h2 className="text-2xl font-black text-white flex items-center gap-3"><Truck size={26} /> Proveedores</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-4xl font-light transition-colors">×</button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-4">
          {editando ? (
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-6 space-y-3">
              <input placeholder="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 rounded-xl text-white outline-none focus:border-[#ff5a1f]" />
              <input placeholder="WhatsApp (ej. 987654321)" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 rounded-xl text-white outline-none focus:border-[#ff5a1f]" />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 rounded-xl text-white outline-none focus:border-[#ff5a1f]" />
              <input placeholder="RUC" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 rounded-xl text-white outline-none focus:border-[#ff5a1f]" />
              <input placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 rounded-xl text-white outline-none focus:border-[#ff5a1f]" />
              <div className="flex gap-2 pt-2">
                <button onClick={guardar} disabled={guardando} style={{ backgroundColor: colorBtn }}
                  className="flex-1 text-white font-black py-3 rounded-xl disabled:opacity-50">Guardar</button>
                <button onClick={() => setEditando(null)} className="px-4 text-neutral-400 hover:text-white">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={abrirNuevo}
              className="w-full border-2 border-dashed border-[#333] hover:border-[#ff5a1f] text-neutral-400 hover:text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-sm transition-colors">
              <Plus size={18} /> Nuevo Proveedor
            </button>
          )}

          {proveedores.filter(p => p.activo).map(p => (
            <div key={p.id} className="bg-[#161616] border border-[#222] rounded-2xl p-5 flex justify-between items-center">
              <div>
                <p className="text-white font-bold">{p.nombre}</p>
                <div className="flex gap-4 mt-1 text-xs text-neutral-500">
                  {p.telefono && <span className="flex items-center gap-1"><Phone size={12} /> {p.telefono}</span>}
                  {p.email && <span className="flex items-center gap-1"><Mail size={12} /> {p.email}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => abrirEditar(p)} className="text-xs font-bold text-neutral-400 hover:text-white px-3 py-2">Editar</button>
                <button onClick={() => desactivar(p)} className="text-xs font-bold text-red-500/70 hover:text-red-500 px-3 py-2">Desactivar</button>
              </div>
            </div>
          ))}

          {proveedores.filter(p => p.activo).length === 0 && !editando && (
            <p className="text-center text-neutral-600 text-sm py-8">Todavía no tienes proveedores registrados.</p>
          )}
        </div>
      </div>
    </div>
  );
}
