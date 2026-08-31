import React, { useEffect, useState } from 'react';
import {
  listarNegociosStaff, actualizarNegocioStaff, crearNegocioStaff, getPlanesDisponibles,
  consultarRuc, consultarDni,
} from '../../api/api';

// Input + botón "Buscar" (SUNAT/RENIEC) — mismo patrón para RUC y DNI, en
// el modal de crear y en el de editar.
function CampoBusqueda({ placeholder, value, onChange, onBuscar, className = '' }) {
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);

  const handleBuscar = async () => {
    setBuscando(true);
    setError(null);
    try {
      await onBuscar();
    } catch (e) {
      setError(e?.response?.data?.error || 'No se encontró.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-2">
        <input placeholder={placeholder} value={value} onChange={onChange}
          className="flex-1 min-w-0 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
        <button type="button" onClick={handleBuscar} disabled={buscando || !value}
          className="px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-300 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 shrink-0 hover:bg-[#222]">
          {buscando ? '…' : 'Buscar'}
        </button>
      </div>
      {error && <p className="text-red-400 text-[10px] font-bold mt-1">{error}</p>}
    </div>
  );
}

function ModalNuevoNegocio({ planes, onClose, onCreado }) {
  const [form, setForm] = useState({
    nombre: '', propietario_username: '', propietario_email: '',
    propietario_password: '', telefono_propietario: '',
    ruc: '', razon_social: '', dni_propietario: '', nombre_propietario: '',
    plan: '', sede_nombre: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const buscarRuc = async () => {
    const { data } = await consultarRuc(form.ruc);
    setForm(prev => ({ ...prev, razon_social: data.razon_social }));
  };
  const buscarDni = async () => {
    const { data } = await consultarDni(form.dni_propietario);
    setForm(prev => ({ ...prev, nombre_propietario: data.nombre }));
  };

  const handleCrear = async () => {
    if (!form.nombre.trim() || !form.propietario_username.trim()) {
      setError('Nombre del negocio y usuario del propietario son obligatorios.');
      return;
    }
    if (!form.sede_nombre.trim()) {
      setError('La sede es obligatoria: sin al menos una, el negocio no puede operar el POS.');
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
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-black text-sm mb-1">Nuevo negocio</h3>

        <input placeholder="Nombre del negocio" value={form.nombre} onChange={set('nombre')}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />

        <div className="pt-2 border-t border-[#1a1a1a] space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">RUC del negocio (opcional)</p>
          <CampoBusqueda placeholder="RUC (11 dígitos)" value={form.ruc} onChange={set('ruc')} onBuscar={buscarRuc} />
          <input placeholder="Razón social" value={form.razon_social} onChange={set('razon_social')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
        </div>

        <div className="pt-2 border-t border-[#1a1a1a] space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Propietario</p>
          <input placeholder="Usuario (login)" value={form.propietario_username} onChange={set('propietario_username')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
          <input placeholder="Email" value={form.propietario_email} onChange={set('propietario_email')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
          <input type="password" placeholder="Contraseña (vacío = aleatoria)" value={form.propietario_password} onChange={set('propietario_password')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
          <input placeholder="Celular del dueño (número principal)" value={form.telefono_propietario} onChange={set('telefono_propietario')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
          <CampoBusqueda placeholder="DNI del dueño (8 dígitos)" value={form.dni_propietario} onChange={set('dni_propietario')} onBuscar={buscarDni} />
          <input placeholder="Nombre completo del dueño" value={form.nombre_propietario} onChange={set('nombre_propietario')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
        </div>

        <div className="pt-2 border-t border-[#1a1a1a]">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Plan (opcional)</p>
          <select value={form.plan} onChange={set('plan')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white mb-2 focus:outline-none focus:border-[#ff5a1f]">
            <option value="">Sin plan</option>
            {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">
            Nombre de la primera sede <span className="text-[#ff5a1f]">*</span>
          </p>
          <input placeholder="Ej. Sede Principal" value={form.sede_nombre} onChange={set('sede_nombre')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
          <p className="text-[10px] text-neutral-600 mt-1">
            Obligatoria: sin al menos una sede, el negocio no puede operar el POS.
          </p>
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

const MODULOS_META = [
  { key: 'mod_salon_activo',       label: 'Salón' },
  { key: 'mod_cocina_activo',      label: 'KDS' },
  { key: 'mod_inventario_activo',  label: 'Inventario' },
  { key: 'mod_delivery_activo',    label: 'Delivery' },
  { key: 'mod_clientes_activo',    label: 'CRM' },
  { key: 'mod_facturacion_activo', label: 'Facturación' },
  { key: 'mod_carta_qr_activo',    label: 'Carta QR' },
  { key: 'mod_bot_wsp_activo',     label: 'Bot WhatsApp' },
  { key: 'mod_ml_activo',          label: 'Predicciones IA' },
];

function fechaInput(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function ModalEditarNegocio({ negocio, planes, onClose, onGuardado }) {
  const [form, setForm] = useState({
    nombre: negocio.nombre || '',
    ruc: negocio.ruc || '',
    razon_social: negocio.razon_social || '',
    telefono_propietario: negocio.telefono_propietario || '',
    dni_propietario: negocio.dni_propietario || '',
    nombre_propietario: negocio.nombre_propietario || '',
    plan: negocio.plan || '',
    fin_prueba: fechaInput(negocio.fin_prueba),
    ...Object.fromEntries(MODULOS_META.map(m => [m.key, negocio[m.key]])),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const toggleModulo = (key) => setForm({ ...form, [key]: !form[key] });

  const buscarRuc = async () => {
    const { data } = await consultarRuc(form.ruc);
    setForm(prev => ({ ...prev, razon_social: data.razon_social }));
  };
  const buscarDni = async () => {
    const { data } = await consultarDni(form.dni_propietario);
    setForm(prev => ({ ...prev, nombre_propietario: data.nombre }));
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const resp = await actualizarNegocioStaff(negocio.id, {
        ...form,
        plan: form.plan || null,
        fin_prueba: form.fin_prueba ? `${form.fin_prueba}T23:59:59` : undefined,
      });
      onGuardado(resp.data);
    } catch (e) {
      setError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-black text-sm mb-1">Editar {negocio.nombre}</h3>
        <p className="text-[11px] text-neutral-500 mb-2">Propietario: {negocio.propietario_username}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Nombre del negocio" value={form.nombre} onChange={set('nombre')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f] md:col-span-2" />
          <CampoBusqueda placeholder="RUC (11 dígitos)" value={form.ruc} onChange={set('ruc')} onBuscar={buscarRuc} />
          <input placeholder="Razón social" value={form.razon_social} onChange={set('razon_social')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
          <input placeholder="Celular del dueño (número principal)" value={form.telefono_propietario} onChange={set('telefono_propietario')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f] md:col-span-2" />
          <CampoBusqueda placeholder="DNI del dueño (8 dígitos)" value={form.dni_propietario} onChange={set('dni_propietario')} onBuscar={buscarDni} />
          <input placeholder="Nombre completo del dueño" value={form.nombre_propietario} onChange={set('nombre_propietario')}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#1a1a1a]">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Plan</label>
            <select value={form.plan} onChange={set('plan')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff5a1f]">
              <option value="">Sin plan</option>
              {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Fin de prueba / vencimiento</label>
            <input type="date" value={form.fin_prueba} onChange={set('fin_prueba')}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff5a1f]" />
          </div>
        </div>

        <div className="pt-2 border-t border-[#1a1a1a]">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">
            Módulos activos (independiente del plan — override manual)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
            {guardando ? 'Guardando…' : 'Guardar cambios'}
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
  const [negocioEditando, setNegocioEditando] = useState(null);

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
              <th className="text-left px-4 py-3 font-black">Celular</th>
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
                <td className="px-4 py-3 text-neutral-400">
                  {n.telefono_propietario
                    ? <a href={`https://wa.me/51${n.telefono_propietario.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-[#ff5a1f]">{n.telefono_propietario}</a>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-neutral-400">{n.plan_detalles?.nombre || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                    n.activo ? 'text-emerald-500 bg-emerald-500/15' : 'text-red-500 bg-red-500/15'
                  }`}>
                    {n.activo ? 'Activo' : 'Bloqueado'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setNegocioEditando(n)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-[#333] text-neutral-400 hover:bg-[#1a1a1a]"
                    >
                      Editar
                    </button>
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
                  </div>
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

      {negocioEditando && (
        <ModalEditarNegocio
          negocio={negocioEditando}
          planes={planes}
          onClose={() => setNegocioEditando(null)}
          onGuardado={(actualizado) => {
            setNegocios(prev => prev.map(n => (n.id === actualizado.id ? actualizado : n)));
            setNegocioEditando(null);
          }}
        />
      )}
    </div>
  );
}
