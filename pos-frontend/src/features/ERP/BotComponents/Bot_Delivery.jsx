import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, Trash2, Pencil, Loader2, MapPin, AlertTriangle, Check, Plus } from 'lucide-react';
import api from '../../../api/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

const iconoPin = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

// El backend compara el radio contra la distancia por calle (≈1.5× la recta).
// Para que el círculo refleje la cobertura real, lo dibujamos a radio/1.5.
const FACTOR_RUTEO = 1.5;
const VACIO = { nombre: '', radio_max_km: '2', costo_envio: '', pedido_minimo: '', activa: true };

export default function Bot_Delivery({ sede, isDark, colorPrimario }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const sedeId = sede?.id;
  const lat = sede?.latitud != null ? Number(sede.latitud) : null;
  const lng = sede?.longitud != null ? Number(sede.longitud) : null;
  const sinCoords = lat == null || lng == null;

  const [zonas, setZonas]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm]       = useState(VACIO);
  const [editId, setEditId]   = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState(null);

  const cargar = useCallback(async () => {
    if (!sedeId) return;
    setCargando(true);
    try {
      const res = await api.get('/zonas-delivery/', { params: { sede_id: sedeId } });
      setZonas(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch { setZonas([]); }
    finally { setCargando(false); }
  }, [sedeId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setForm(VACIO); setEditId(null); }, [sedeId]);

  const limpiar = () => { setForm(VACIO); setEditId(null); };
  const editar = (z) => {
    setForm({ nombre: z.nombre, radio_max_km: String(z.radio_max_km), costo_envio: String(z.costo_envio), pedido_minimo: z.pedido_minimo ? String(z.pedido_minimo) : '', activa: z.activa });
    setEditId(z.id);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.warning('Ponle un nombre a la zona.'); return; }
    if (!form.radio_max_km || Number(form.radio_max_km) <= 0) { toast.warning('Indica el radio máximo (km).'); return; }
    if (form.costo_envio === '' || Number(form.costo_envio) < 0) { toast.warning('Indica el costo de envío.'); return; }
    setGuardando(true);
    try {
      const payload = {
        sede: sedeId,
        nombre: form.nombre.trim(),
        radio_max_km: Number(form.radio_max_km),
        costo_envio: Number(form.costo_envio),
        pedido_minimo: form.pedido_minimo === '' ? 0 : Number(form.pedido_minimo),
        activa: form.activa,
      };
      if (editId) await api.patch(`/zonas-delivery/${editId}/`, payload);
      else await api.post('/zonas-delivery/', payload);
      toast.success('Zona guardada.');
      limpiar(); cargar();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar la zona.');
    } finally { setGuardando(false); }
  };

  const toggleActiva = async (z) => {
    setAccionId(z.id);
    try { await api.patch(`/zonas-delivery/${z.id}/`, { activa: !z.activa }); cargar(); }
    catch { toast.error('No se pudo actualizar.'); }
    finally { setAccionId(null); }
  };

  const eliminar = async (z) => {
    if (!(await confirmar(`¿Eliminar la zona "${z.nombre}"?`, { titulo: 'Eliminar zona', peligroso: true }))) return;
    setAccionId(z.id);
    try { await api.delete(`/zonas-delivery/${z.id}/`); toast.success('Zona eliminada.'); cargar(); }
    catch { toast.error('No se pudo eliminar.'); }
    finally { setAccionId(null); }
  };

  const card = `rounded-[2rem] p-6 border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200 shadow-sm'}`;
  const inp = isDark ? 'bg-[#0a0a0a] border-[#333] text-white placeholder:text-neutral-600'
                     : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400';
  const lbl = isDark ? 'text-neutral-500' : 'text-gray-400';
  const txt = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-neutral-400' : 'text-gray-500';

  const radioForm = Number(form.radio_max_km) || 0;
  const estiloMapa = `.leaflet-container{z-index:0!important;background:${isDark ? '#0a0a0a' : '#e5e7eb'};}`;

  if (sinCoords) {
    return (
      <div className={card}>
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-500">
            <b>{sede?.nombre}</b> no tiene ubicación (lat/lng) configurada. El delivery necesita el punto del local —
            configúralo en <b>Gestión de Sedes → Información</b> (mapa) y vuelve aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
      <style>{estiloMapa}</style>

      {/* COLUMNA 1: MAPA + FORMULARIO */}
      <div className={card}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl" style={{ backgroundColor: colorPrimario + '20', color: colorPrimario }}>
            <Bike size={22} />
          </div>
          <div>
            <h3 className={`text-lg font-black ${txt}`}>{editId ? 'Editar zona' : 'Nueva zona'}</h3>
            <p className={`text-xs ${sub}`}>Centro: <b>{sede?.nombre}</b></p>
          </div>
        </div>

        {/* Mapa con anillos */}
        <div className="rounded-2xl overflow-hidden border mb-4" style={{ borderColor: isDark ? '#222' : '#e5e7eb', height: 280, isolation: 'isolate' }}>
          <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full" attributionControl={false} key={`${sedeId}-${lat}-${lng}`}>
            <TileLayer
              url={isDark
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'}
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            />
            <Marker position={[lat, lng]} icon={iconoPin} />
            {/* Zonas existentes (tenue) */}
            {zonas.filter(z => z.id !== editId).map(z => (
              <Circle key={z.id} center={[lat, lng]}
                radius={(Number(z.radio_max_km) / FACTOR_RUTEO) * 1000}
                pathOptions={{ color: z.activa ? '#10b981' : '#6b7280', weight: 1, fillOpacity: 0.05 }} />
            ))}
            {/* Zona en edición (resaltada, reacciona al radio) */}
            {radioForm > 0 && (
              <Circle center={[lat, lng]} radius={(radioForm / FACTOR_RUTEO) * 1000}
                pathOptions={{ color: colorPrimario, weight: 2, fillColor: colorPrimario, fillOpacity: 0.12 }} />
            )}
          </MapContainer>
        </div>

        {/* Slider de radio */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className={`text-[10px] font-black uppercase tracking-widest ${lbl}`}>Radio máximo</label>
            <span className="text-sm font-black" style={{ color: colorPrimario }}>{radioForm} km</span>
          </div>
          <input type="range" min="0.5" max="15" step="0.5" value={form.radio_max_km}
            onChange={(e) => setForm({ ...form, radio_max_km: e.target.value })}
            className="w-full accent-current" style={{ accentColor: colorPrimario }} />
        </div>

        <div className="space-y-3">
          <div>
            <label className={`text-[10px] font-black uppercase tracking-widest block mb-1.5 ${lbl}`}>Nombre de la zona</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Zona Cercana" className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium outline-none ${inp}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-[10px] font-black uppercase tracking-widest block mb-1.5 ${lbl}`}>Costo envío (S/)</label>
              <input type="number" min="0" step="0.5" value={form.costo_envio} onChange={(e) => setForm({ ...form, costo_envio: e.target.value })}
                placeholder="5" className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold outline-none ${inp}`} />
            </div>
            <div>
              <label className={`text-[10px] font-black uppercase tracking-widest block mb-1.5 ${lbl}`}>Pedido mín. (S/)</label>
              <input type="number" min="0" step="1" value={form.pedido_minimo} onChange={(e) => setForm({ ...form, pedido_minimo: e.target.value })}
                placeholder="0 (opcional)" className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold outline-none ${inp}`} />
            </div>
          </div>
          <button onClick={() => setForm({ ...form, activa: !form.activa })}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${form.activa ? 'text-green-500 border-green-500/30 bg-green-500/10' : `${sub} ${isDark ? 'border-[#333]' : 'border-gray-200'}`}`}>
            <Check size={15} /> {form.activa ? 'Zona activa' : 'Zona inactiva'}
          </button>

          <div className="flex gap-2 pt-1">
            {editId && (
              <button onClick={limpiar} className={`px-4 py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-[#222] text-neutral-300' : 'bg-gray-100 text-gray-600'}`}>
                Cancelar
              </button>
            )}
            <button onClick={guardar} disabled={guardando}
              className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: colorPrimario }}>
              {guardando ? <Loader2 size={15} className="animate-spin" /> : (editId ? <Check size={15} /> : <Plus size={15} />)}
              {editId ? 'Guardar cambios' : 'Crear zona'}
            </button>
          </div>
        </div>
      </div>

      {/* COLUMNA 2: LISTA DE ZONAS */}
      <div className={card}>
        <h3 className={`text-lg font-black mb-1 ${txt}`}>Zonas configuradas</h3>
        <p className={`text-xs mb-4 ${sub}`}>Se cobra la zona más chica que cubra al cliente.</p>

        {cargando ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: colorPrimario }} size={26} /></div>
        ) : zonas.length === 0 ? (
          <p className={`text-sm text-center py-16 ${sub}`}>Aún no hay zonas. Crea la primera en el formulario. 👈</p>
        ) : (
          <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
            {[...zonas].sort((a, b) => a.radio_max_km - b.radio_max_km).map(z => (
              <div key={z.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${editId === z.id ? '' : (isDark ? 'border-[#222] bg-[#161616]' : 'border-gray-100 bg-gray-50')} ${!z.activa ? 'opacity-50' : ''}`}
                style={editId === z.id ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '0d' } : {}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}>
                  <MapPin size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-sm ${txt}`}>{z.nombre}</p>
                  <p className={`text-[11px] ${sub}`}>
                    Hasta {z.radio_max_km} km · S/ {Number(z.costo_envio).toFixed(2)}
                    {Number(z.pedido_minimo) > 0 ? ` · mín. S/ ${Number(z.pedido_minimo).toFixed(2)}` : ''}
                  </p>
                </div>
                <button onClick={() => toggleActiva(z)} disabled={accionId === z.id}
                  className={`text-[10px] font-black px-2 py-1 rounded-full ${z.activa ? 'bg-green-500/10 text-green-500' : 'bg-neutral-500/10 text-neutral-400'}`}>
                  {z.activa ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => editar(z)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#222]' : 'hover:bg-gray-100'}`}>
                  <Pencil size={14} className={sub} />
                </button>
                <button onClick={() => eliminar(z)} disabled={accionId === z.id}
                  className={`p-2 rounded-lg ${isDark ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-red-50 hover:bg-red-100'}`}>
                  {accionId === z.id ? <Loader2 size={14} className="animate-spin text-red-500" /> : <Trash2 size={14} className="text-red-500" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
