import React, { useEffect, useState } from 'react';
import { getPlanesDisponibles, crearPlanStaff, actualizarPlanStaff, eliminarPlanStaff } from '../../api/api';

const MODULOS_META = [
  { key: 'modulo_kds',        label: 'Pantalla KDS' },
  { key: 'modulo_inventario', label: 'Inventario' },
  { key: 'modulo_delivery',   label: 'Delivery' },
  { key: 'modulo_carta_qr',   label: 'Carta QR' },
  { key: 'modulo_bot_wsp',    label: 'Bot WhatsApp' },
  { key: 'modulo_ml',         label: 'Predicciones IA' },
];

const PLAN_VACIO = {
  nombre: '', precio_mensual: '', max_sedes: 1,
  ...Object.fromEntries(MODULOS_META.map(m => [m.key, false])),
};

function ModalPlan({ plan, onClose, onGuardado }) {
  const esNuevo = !plan;
  const [form, setForm] = useState(plan ? { ...plan } : PLAN_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const toggleModulo = (key) => setForm({ ...form, [key]: !form[key] });

  const guardar = async () => {
    if (!form.nombre.trim() || !form.precio_mensual) {
      setError('Nombre y precio mensual son obligatorios.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const resp = esNuevo ? await crearPlanStaff(form) : await actualizarPlanStaff(plan.id, form);
      onGuardado(resp.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo guardar el plan.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-black text-sm mb-1">{esNuevo ? 'Nuevo plan' : `Editar ${plan.nombre}`}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Nombre del plan" value={form.nombre} onChange={set('nombre')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f] md:col-span-2" />
          <input type="number" step="0.01" placeholder="Precio mensual (S/)" value={form.precio_mensual} onChange={set('precio_mensual')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
          <input type="number" min="1" placeholder="Máx. sedes" value={form.max_sedes} onChange={set('max_sedes')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
        </div>

        <div className="pt-2 border-t border-[#1a1a1a]">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Módulos incluidos</p>
          <div className="grid grid-cols-2 gap-2">
            {MODULOS_META.map(m => (
              <label key={m.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] cursor-pointer">
                <input type="checkbox" checked={!!form[m.key]} onChange={() => toggleModulo(m.key)} className="accent-[#ff5a1f]" />
                <span className="text-xs text-neutral-300">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 text-xs font-black uppercase tracking-widest">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="flex-1 py-2.5 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest disabled:opacity-40">
            {guardando ? 'Guardando…' : esNuevo ? 'Crear plan' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Staff_Planes() {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null | 'nuevo' | plan-object
  const [error, setError] = useState(null);

  const cargar = () => {
    setCargando(true);
    getPlanesDisponibles().then(res => setPlanes(res.data)).finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const eliminar = async (plan) => {
    if (!window.confirm(`¿Borrar el plan "${plan.nombre}"?`)) return;
    setError(null);
    try {
      await eliminarPlanStaff(plan.id);
      setPlanes(prev => prev.filter(p => p.id !== plan.id));
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo borrar el plan.');
    }
  };

  const handleGuardado = (actualizado) => {
    setPlanes(prev => {
      const existe = prev.some(p => p.id === actualizado.id);
      return existe ? prev.map(p => (p.id === actualizado.id ? actualizado : p)) : [...prev, actualizado];
    });
    setModal(null);
  };

  if (cargando) return <div className="text-neutral-500 text-sm">Cargando planes…</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">{planes.length} planes</h3>
        <button
          onClick={() => setModal('nuevo')}
          className="px-4 py-2 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest"
        >
          + Nuevo plan
        </button>
      </div>

      {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {planes.map(p => (
          <div key={p.id} className="p-5 rounded-2xl border bg-[#111] border-[#222]">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-black text-white text-sm">{p.nombre}</h4>
                <p className="text-2xl font-black text-[#ff5a1f]">S/ {Number(p.precio_mensual).toFixed(2)}<span className="text-xs text-neutral-500">/mes</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setModal(p)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-[#333] text-neutral-400 hover:bg-[#1a1a1a]">
                  Editar
                </button>
                <button onClick={() => eliminar(p)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-500/30 text-red-500 hover:bg-red-500/10">
                  Borrar
                </button>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 mb-3">Hasta {p.max_sedes} {p.max_sedes === 1 ? 'sede' : 'sedes'}</p>
            <div className="flex flex-wrap gap-1.5">
              {MODULOS_META.filter(m => p[m.key]).map(m => (
                <span key={m.key} className="text-[9px] px-2 py-1 rounded-full font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/15">
                  {m.label}
                </span>
              ))}
              {MODULOS_META.every(m => !p[m.key]) && (
                <span className="text-[10px] text-neutral-600">Sin módulos extra incluidos</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <ModalPlan
          plan={modal === 'nuevo' ? null : modal}
          onClose={() => setModal(null)}
          onGuardado={handleGuardado}
        />
      )}
    </div>
  );
}
