import React, { useEffect, useState } from 'react';
import {
  getModulosGlobalesStaff, actualizarModulosGlobalesStaff,
  getDatosPagoStaff, actualizarDatosPagoStaff,
} from '../../api/api';

const MODULOS_META = [
  { key: 'salon_activo',       label: 'Gestión de Salón' },
  { key: 'cocina_activo',      label: 'Pantalla KDS' },
  { key: 'inventario_activo',  label: 'Inventario' },
  { key: 'delivery_activo',    label: 'Delivery' },
  { key: 'clientes_activo',    label: 'CRM' },
  { key: 'facturacion_activo', label: 'Facturación' },
  { key: 'carta_qr_activo',    label: 'Carta QR' },
  { key: 'bot_wsp_activo',     label: 'Bot WhatsApp' },
  { key: 'ml_activo',          label: 'Predicciones IA' },
];

function Tarjeta({ children, titulo }) {
  return (
    <div className="p-6 rounded-2xl border bg-[#111] border-[#222]">
      <h3 className="text-sm font-black text-white mb-4">{titulo}</h3>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div
        className="w-10 h-6 rounded-full transition-colors bg-[#333] peer-checked:bg-[#ff5a1f]
          after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white
          after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"
      />
    </label>
  );
}

function SeccionModulos() {
  const [modulos, setModulos] = useState(null);

  useEffect(() => { getModulosGlobalesStaff().then(res => setModulos(res.data)); }, []);

  const toggle = async (key) => {
    const nuevoValor = !modulos[key];
    setModulos({ ...modulos, [key]: nuevoValor }); // optimista
    try {
      await actualizarModulosGlobalesStaff({ [key]: nuevoValor });
    } catch {
      setModulos(prev => ({ ...prev, [key]: !nuevoValor })); // revierte si falla
      alert('No se pudo actualizar el módulo.');
    }
  };

  if (!modulos) return <div className="text-neutral-500 text-sm">Cargando…</div>;

  return (
    <Tarjeta titulo='Módulos bloqueados globalmente ("Próximamente")'>
      <p className="text-xs text-neutral-500 mb-4">
        Apagá acá un módulo que todavía tiene cosas pendientes — desaparece para
        TODOS los negocios sin tocar lo que cada uno tenía configurado.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MODULOS_META.map(m => (
          <div key={m.key} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <span className="text-xs font-bold text-neutral-300">{m.label}</span>
            <Toggle checked={modulos[m.key]} onChange={() => toggle(m.key)} />
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

function SeccionDatosPago() {
  const [datos, setDatos] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => { getDatosPagoStaff().then(res => setDatos(res.data)); }, []);

  const set = (campo) => (e) => { setDatos({ ...datos, [campo]: e.target.value }); setGuardado(false); };

  const guardar = async () => {
    setGuardando(true);
    try {
      const resp = await actualizarDatosPagoStaff(datos);
      setDatos(resp.data);
      setGuardado(true);
    } catch {
      alert('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  if (!datos) return <div className="text-neutral-500 text-sm">Cargando…</div>;

  const campo = (key, label, placeholder = '') => (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">{label}</label>
      <input
        value={datos[key] || ''}
        onChange={set(key)}
        placeholder={placeholder}
        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]"
      />
    </div>
  );

  return (
    <Tarjeta titulo="Datos de pago de Leybrak (a dónde te pagan los negocios)">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {campo('yape_numero', 'Yape — número')}
        {campo('yape_titular', 'Yape — titular')}
        {campo('plin_numero', 'Plin — número')}
        {campo('plin_titular', 'Plin — titular')}
        {campo('banco', 'Banco')}
        {campo('numero_cuenta', 'Número de cuenta')}
        {campo('cci', 'CCI')}
        {campo('titular_cuenta', 'Titular de la cuenta')}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando}
          className="px-5 py-2.5 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {guardado && <span className="text-emerald-500 text-xs font-bold">✓ Guardado</span>}
      </div>
    </Tarjeta>
  );
}

export default function Staff_Configuracion() {
  return (
    <div className="space-y-6 max-w-4xl">
      <SeccionModulos />
      <SeccionDatosPago />
    </div>
  );
}
