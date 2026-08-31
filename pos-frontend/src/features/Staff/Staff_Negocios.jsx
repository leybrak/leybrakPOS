import React, { useEffect, useState } from 'react';
import { listarNegociosStaff, actualizarNegocioStaff, crearNegocioStaff, getPlanesDisponibles } from '../../api/api';

function ModalNuevoNegocio({ planes, onClose, onCreado }) {
  const [form, setForm] = useState({
    nombre: '', propietario_username: '', propietario_email: '',
    propietario_password: '', plan: '', sede_nombre: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const handleCrear = async () => {
    if (!form.nombre.trim() || !form.propietario_username.trim()) {
      setError('Nombre del negocio y usuario del propietario son obligatorios.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await crearNegocioStaff({ ...form, plan: form.plan || undefined });
      onCreado();
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo crear el negocio.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-black text-sm mb-1">Nuevo negocio</h3>

        <input placeholder="Nombre del negocio" value={form.nombre} onChange={set('nombre')}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />

        <div className="pt-2 border-t border-[#1a1a1a]">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Propietario</p>
          <input placeholder="Usuario (login)" value={form.propietario_username} onChange={set('propietario_username')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 mb-2 focus:outline-none focus:border-[#ff5a1f]" />
          <input placeholder="Email" value={form.propietario_email} onChange={set('propietario_email')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 mb-2 focus:outline-none focus:border-[#ff5a1f]" />
          <input type="password" placeholder="Contraseña (vacío = aleatoria)" value={form.propietario_password} onChange={set('propietario_password')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
        </div>

        <div className="pt-2 border-t border-[#1a1a1a]">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Plan y sede (opcional)</p>
          <select value={form.plan} onChange={set('plan')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white mb-2 focus:outline-none focus:border-[#ff5a1f]">
            <option value="">Sin plan</option>
            {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input placeholder="Nombre de la primera sede" value={form.sede_nombre} onChange={set('sede_nombre')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
        </div>

        {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 text-xs font-black uppercase tracking-widest">
            Cancelar
          </button>
          <button onClick={handleCrear} disabled={enviando}
            className="flex-1 py-2.5 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest disabled:opacity-40">
            {enviando ? 'Creando…' : 'Crear negocio'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Staff_Negocios() {
  const [negocios, setNegocios] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([listarNegociosStaff(), getPlanesDisponibles()])
      .then(([r1, r2]) => { setNegocios(r1.data); setPlanes(r2.data); })
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const toggleActivo = async (negocio) => {
    const resp = await actualizarNegocioStaff(negocio.id, { activo: !negocio.activo });
    setNegocios(prev => prev.map(n => (n.id === negocio.id ? resp.data : n)));
  };

  if (cargando) return <div className="text-neutral-500 text-sm">Cargando negocios…</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">{negocios.length} negocios</h3>
        <button
          onClick={() => setMostrarModal(true)}
          className="px-4 py-2 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest"
        >
          + Nuevo negocio
        </button>
      </div>

      <div className="rounded-2xl border border-[#222] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#111] text-[10px] uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="text-left px-4 py-3 font-black">Negocio</th>
              <th className="text-left px-4 py-3 font-black">Propietario</th>
              <th className="text-left px-4 py-3 font-black">Plan</th>
              <th className="text-left px-4 py-3 font-black">Estado</th>
              <th className="text-right px-4 py-3 font-black">Acción</th>
            </tr>
          </thead>
          <tbody>
            {negocios.map(n => (
              <tr key={n.id} className="border-t border-[#1a1a1a]">
                <td className="px-4 py-3 text-white font-bold">{n.nombre}</td>
                <td className="px-4 py-3 text-neutral-400">{n.propietario_username}</td>
                <td className="px-4 py-3 text-neutral-400">{n.plan_detalles?.nombre || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                    n.activo ? 'text-emerald-500 bg-emerald-500/15' : 'text-red-500 bg-red-500/15'
                  }`}>
                    {n.activo ? 'Activo' : 'Bloqueado'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActivo(n)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                      n.activo
                        ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                        : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                    }`}
                  >
                    {n.activo ? 'Bloquear' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarModal && (
        <ModalNuevoNegocio
          planes={planes}
          onClose={() => setMostrarModal(false)}
          onCreado={() => { setMostrarModal(false); cargar(); }}
        />
      )}
    </div>
  );
}
