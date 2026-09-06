import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, CalendarDays, CalendarRange, Settings2,
  ChevronDown, DollarSign, ShoppingCart, Receipt, MapPin, TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { obtenerAnaliticas } from '../../api/api';

const hoyISO = () => new Date().toISOString().split('T')[0];
const restarDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
};
const inicioDeMesISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const OPCIONES_TIEMPO = [
  { id: 'hoy', label: 'Hoy', icon: <Calendar size={16} /> },
  { id: '7d', label: 'Últimos 7 días', icon: <Clock size={16} /> },
  { id: '30d', label: 'Últimos 30 días', icon: <CalendarDays size={16} /> },
  { id: 'mes', label: 'Este Mes', icon: <CalendarRange size={16} /> },
  { id: 'rango', label: 'Rango Específico...', icon: <Settings2 size={16} /> },
];

function calcularRango(preset, fechaInicioManual, fechaFinManual) {
  const hoy = hoyISO();
  switch (preset) {
    case 'hoy':  return { fecha_inicio: hoy, fecha_fin: hoy };
    case '7d':   return { fecha_inicio: restarDias(6), fecha_fin: hoy };
    case '30d':  return { fecha_inicio: restarDias(29), fecha_fin: hoy };
    case 'mes':  return { fecha_inicio: inicioDeMesISO(), fecha_fin: hoy };
    case 'rango': return { fecha_inicio: fechaInicioManual, fecha_fin: fechaFinManual };
    default:     return { fecha_inicio: restarDias(29), fecha_fin: hoy };
  }
}

const formatearFechaCorta = (iso) => {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
};

export default function Erp_TabAnaliticas({ config, sedesReales = [] }) {
  const isDark = config.temaFondo === 'dark';
  const colorPrimario = config.colorPrimario || '#3b82f6';

  const rolUsuario = localStorage.getItem('usuario_rol')?.toLowerCase() || '';
  const esDueño = rolUsuario === 'dueño';

  const [sedeFiltroId, setSedeFiltroId] = useState('');
  const [preset, setPreset] = useState('30d');
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [fechaInicioManual, setFechaInicioManual] = useState(restarDias(29));
  const [fechaFinManual, setFechaFinManual] = useState(hoyISO());

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const opcionActual = OPCIONES_TIEMPO.find(o => o.id === preset);
  const { fecha_inicio, fecha_fin } = useMemo(
    () => calcularRango(preset, fechaInicioManual, fechaFinManual),
    [preset, fechaInicioManual, fechaFinManual]
  );

  const cargarAnaliticas = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const negocioId = localStorage.getItem('negocio_id');
      const params = { negocio_id: negocioId, fecha_inicio, fecha_fin };
      if (sedeFiltroId) params.sede_id = sedeFiltroId;
      const { data } = await obtenerAnaliticas(params);
      setDatos(data);
    } catch (e) {
      setError('No se pudieron cargar las analíticas.');
    } finally {
      setCargando(false);
    }
  }, [sedeFiltroId, fecha_inicio, fecha_fin]);

  useEffect(() => { cargarAnaliticas(); }, [cargarAnaliticas]);

  const evolucionGrafico = useMemo(() => {
    if (!datos) return [];
    return datos.evolucion_ventas.map(d => ({ ...d, etiqueta: formatearFechaCorta(d.fecha) }));
  }, [datos]);

  const horasGrafico = useMemo(() => {
    if (!datos) return [];
    return datos.horas_pico.map(h => ({ ...h, etiqueta: `${String(h.hora).padStart(2, '0')}h` }));
  }, [datos]);

  const cardCls = `p-6 rounded-2xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`;
  const tickColor = isDark ? '#737373' : '#9ca3af';
  const gridColor = isDark ? '#222' : '#e5e7eb';

  return (
    <div className="animate-fadeIn pb-10 space-y-6">

      {/* ========== CABECERA: SEDE + FECHAS ========== */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        {esDueño && sedesReales?.length > 1 ? (
          <div className={`flex w-full xl:w-auto p-1 rounded-xl overflow-x-auto custom-scrollbar shrink-0 border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-100 border-gray-200'}`}>
            <button
              onClick={() => setSedeFiltroId('')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${!sedeFiltroId ? 'text-white' : isDark ? 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}
              style={!sedeFiltroId ? { backgroundColor: colorPrimario } : {}}
            >
              General
            </button>
            {sedesReales.map(s => (
              <button
                key={s.id}
                onClick={() => setSedeFiltroId(s.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${String(sedeFiltroId) === String(s.id) ? 'text-white' : isDark ? 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}
                style={String(sedeFiltroId) === String(s.id) ? { backgroundColor: colorPrimario } : {}}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        ) : (
          <div className={`flex items-center px-4 py-2 rounded-xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
            <MapPin size={16} className={isDark ? 'text-neutral-500 mr-2' : 'text-gray-400 mr-2'} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              Sede Activa:
              <span className={`ml-2 text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {localStorage.getItem('sede_nombre') || 'Local Principal'}
              </span>
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-3 relative z-20">
          <div className="relative">
            <button
              onClick={() => setDropdownAbierto(!dropdownAbierto)}
              className={`flex items-center justify-between gap-3 min-w-[180px] px-4 py-2.5 rounded-xl text-xs font-bold transition-colors w-full border ${isDark ? 'bg-[#111] border-[#222] hover:border-[#333] text-white' : 'bg-white border-gray-200 hover:border-gray-300 text-gray-900'}`}
            >
              <span className="flex items-center gap-2">
                <span className={isDark ? 'text-neutral-400' : 'text-gray-500'}>{opcionActual?.icon}</span>
                {opcionActual?.label}
              </span>
              <ChevronDown size={14} className={`transition-transform ${dropdownAbierto ? 'rotate-180' : ''}`} />
            </button>

            {dropdownAbierto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownAbierto(false)}></div>
                <div className={`absolute top-full right-0 mt-2 w-full min-w-[220px] rounded-xl shadow-xl z-20 overflow-hidden border animate-fadeIn ${isDark ? 'bg-[#161616] border-[#222]' : 'bg-white border-gray-200'}`}>
                  {OPCIONES_TIEMPO.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setPreset(opt.id); setDropdownAbierto(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-xs font-bold transition-colors text-left ${preset === opt.id ? (isDark ? 'bg-[#222] text-white' : 'bg-gray-50 text-gray-900') : (isDark ? 'text-neutral-400 hover:bg-[#222] hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')}`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {preset === 'rango' && (
            <div className={`flex items-center gap-3 px-4 py-1.5 rounded-xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
              <input type="date" value={fechaInicioManual} onChange={(e) => setFechaInicioManual(e.target.value)}
                className={`bg-transparent outline-none text-xs font-bold cursor-pointer ${isDark ? 'text-white dark-calendar' : 'text-gray-900'}`} />
              <span className={`font-black text-xs ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}>/</span>
              <input type="date" value={fechaFinManual} onChange={(e) => setFechaFinManual(e.target.value)}
                className={`bg-transparent outline-none text-xs font-bold cursor-pointer ${isDark ? 'text-white dark-calendar' : 'text-gray-900'}`} />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold">{error}</div>
      )}

      {/* ========== TARJETAS DE MÉTRICAS ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className={cardCls}>
          <div className="flex justify-between items-start mb-4">
            <p className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Ingresos del Periodo</p>
            <DollarSign size={16} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
          </div>
          <h3 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <span className={`text-xl mr-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>S/</span>
            {(datos?.resumen.ingresos_totales ?? 0).toFixed(2)}
          </h3>
        </div>
        <div className={cardCls}>
          <div className="flex justify-between items-start mb-4">
            <p className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Total Órdenes</p>
            <ShoppingCart size={16} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
          </div>
          <h3 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {datos?.resumen.total_ordenes ?? 0}
          </h3>
        </div>
        <div className={cardCls}>
          <div className="flex justify-between items-start mb-4">
            <p className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Ticket Promedio</p>
            <Receipt size={16} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
          </div>
          <h3 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <span className={`text-xl mr-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>S/</span>
            {(datos?.resumen.ticket_promedio ?? 0).toFixed(2)}
          </h3>
        </div>
      </div>

      {/* ========== EVOLUCIÓN DE VENTAS ========== */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp size={16} className={isDark ? 'text-neutral-500' : 'text-gray-400'} />
          <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Evolución de Ventas</h3>
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={evolucionGrafico} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorPrimario} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={colorPrimario} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                contentStyle={{ background: isDark ? '#161616' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: isDark ? '#fff' : '#111' }}
                formatter={(value, name) => name === 'ingresos' ? [`S/ ${Number(value).toFixed(2)}`, 'Ingresos'] : [value, 'Órdenes']}
              />
              <Area type="monotone" dataKey="ingresos" stroke={colorPrimario} strokeWidth={2} fill="url(#gradIngresos)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {!cargando && evolucionGrafico.length === 0 && (
          <p className={`text-center text-xs font-bold py-6 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Sin ventas en este periodo.</p>
        )}
      </div>

      {/* ========== TOP PRODUCTOS Y CATEGORÍAS ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardCls}>
          <h3 className={`font-black text-lg mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Productos Más Vendidos</h3>
          {datos?.productos_top?.length ? (
            <div style={{ width: '100%', height: Math.max(220, datos.productos_top.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={datos.productos_top} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="nombre" type="category" width={130} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: isDark ? '#161616' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: isDark ? '#fff' : '#111' }}
                    formatter={(value, name) => name === 'cantidad' ? [value, 'Cantidad'] : [`S/ ${Number(value).toFixed(2)}`, 'Ingresos']}
                  />
                  <Bar dataKey="cantidad" fill={colorPrimario} radius={[0, 6, 6, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={`text-center text-xs font-bold py-10 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Sin ventas en este periodo.</p>
          )}
        </div>

        <div className={cardCls}>
          <h3 className={`font-black text-lg mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Categorías Más Vendidas</h3>
          {datos?.categorias_top?.length ? (
            <div style={{ width: '100%', height: Math.max(220, datos.categorias_top.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={datos.categorias_top} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="nombre" type="category" width={130} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: isDark ? '#161616' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: isDark ? '#fff' : '#111' }}
                    formatter={(value, name) => name === 'cantidad' ? [value, 'Cantidad'] : [`S/ ${Number(value).toFixed(2)}`, 'Ingresos']}
                  />
                  <Bar dataKey="cantidad" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={`text-center text-xs font-bold py-10 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Sin ventas en este periodo.</p>
          )}
        </div>
      </div>

      {/* ========== HORAS PICO ========== */}
      <div className={cardCls}>
        <h3 className={`font-black text-lg mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Horas Pico</h3>
        <p className={`text-xs mb-6 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Órdenes por hora del día, sumado en todo el periodo</p>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={horasGrafico} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="etiqueta" interval={1} tick={{ fill: tickColor, fontSize: 10 }} axisLine={{ stroke: gridColor }} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: isDark ? '#161616' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: isDark ? '#fff' : '#111' }}
                formatter={(value, name) => name === 'ordenes' ? [value, 'Órdenes'] : [`S/ ${Number(value).toFixed(2)}`, 'Ingresos']}
              />
              <Bar dataKey="ordenes" fill={colorPrimario} radius={[6, 6, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
