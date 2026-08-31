import React, { useEffect, useState } from 'react';
import {
  Rocket, CheckCircle2, XCircle, Building2,
  CalendarClock, CreditCard, AlertTriangle, Zap,
  ShoppingBag, Bot, BrainCircuit, QrCode, ChefHat,
  Package, Loader2, Sparkles, ArrowRight,
  Clock, Receipt,Crown
} from 'lucide-react';
import api, { generarPagoSuscripcion, getEstadoSuscripcion } from '../../api/api';
import Erp_PagoManual from './Erp_PagoManual';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const diasRestantes = (fechaFin) => {
  if (!fechaFin) return null;
  const diff = Math.ceil((new Date(fechaFin) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

// Metadatos visuales por módulo — nombres, íconos y colores fijos en frontend
const MODULOS_META = [
  { key: 'modulo_kds',        label: 'Pantalla KDS',    icon: ChefHat,     color: '#f59e0b' },
  { key: 'modulo_inventario', label: 'Inventario',       icon: Package,     color: '#3b82f6' },
  { key: 'modulo_delivery',   label: 'Delivery',         icon: ShoppingBag, color: '#8b5cf6' },
  { key: 'modulo_carta_qr',   label: 'Carta QR',         icon: QrCode,      color: '#10b981' },
  { key: 'modulo_bot_wsp',    label: 'Bot WhatsApp',     icon: Bot,         color: '#22c55e' },
  { key: 'modulo_ml',         label: 'Machine Learning', icon: BrainCircuit,color: '#ec4899' },
];

// Colores asignados a planes por índice (el orden viene del backend por precio_mensual ASC)
const PLAN_COLORS = ['#6b7280', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#10b981'];

// Enriquece cada plan del backend con color e ícono visuales
const enriquecerPlan = (plan, index) => ({
  ...plan,
  color: PLAN_COLORS[index % PLAN_COLORS.length],
  icon: index === 0 ? Zap : index === 1 ? Rocket : Sparkles,
});

// ─────────────────────────────────────────────────────────────
// Sub-componente: barra de uso
// ─────────────────────────────────────────────────────────────
function BarraUso({ label, icon: Icon, usado, maximo, color, isDark }) {
  const pct     = maximo > 0 ? Math.min((usado / maximo) * 100, 100) : 0;
  const critico = pct >= 90;
  const barColor = critico ? '#ef4444' : color;

  return (
    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#161616] border-[#2a2a2a]' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }} />
          <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {label}
          </span>
        </div>
        <span className={`text-xs font-black tabular-nums ${critico ? 'text-red-500' : isDark ? 'text-white' : 'text-gray-900'}`}>
          {usado} / {maximo === 9999 ? '∞' : maximo}
        </span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-200'}`}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      {critico && (
        <p className="text-[10px] text-red-400 font-bold mt-2 flex items-center gap-1">
          <AlertTriangle size={10} /> Límite casi alcanzado
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componente: tarjeta de módulo del plan
// ─────────────────────────────────────────────────────────────
function ChipModulo({ label, activo, icon: Icon, color, isDark }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
      activo
        ? isDark
          ? 'border-transparent'
          : 'border-transparent'
        : isDark
          ? 'bg-[#161616] border-[#2a2a2a] opacity-40'
          : 'bg-gray-50 border-gray-200 opacity-40'
    }`}
      style={activo ? { backgroundColor: color + '18', borderColor: color + '40', color } : {}}
    >
      <Icon size={13} />
      <span className={activo ? '' : isDark ? 'text-neutral-500' : 'text-gray-400'}>{label}</span>
      {activo
        ? <CheckCircle2 size={11} className="ml-auto" />
        : <XCircle size={11} className="ml-auto" style={{ color: isDark ? '#444' : '#ccc' }} />
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function Tab_Plan({ config, setConfig, isDark, colorPrimario }) {
  const [planData,       setPlanData]       = useState(null);
  const [usageData,      setUsageData]      = useState(null);
  const [planes,         setPlanes]         = useState([]);
  const [historial,      setHistorial]      = useState([]);
  const [cargando,       setCargando]       = useState(true);
  const [cargandoPlanes, setCargandoPlanes] = useState(false);
  const [cargandoHist,   setCargandoHist]   = useState(false);
  const [errorHist,      setErrorHist]      = useState(null);
  const [error,          setError]          = useState(null);
  const [seccion,        setSeccion]        = useState('resumen');
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [verificandoPago, setVerificandoPago] = useState(false);

  // ── Iniciar pago de suscripción en MercadoPago ───────────
  const handlePagar = async (planId) => {
    setProcesandoPago(true);
    setError(null);
    try {
      const res = await generarPagoSuscripcion(planId);
      if (res.data?.init_point) {
        window.location.assign(res.data.init_point);   // redirige a MercadoPago
      } else {
        setError('No se pudo iniciar el pago. Intenta de nuevo.');
        setProcesandoPago(false);
      }
    } catch {
      setError('No se pudo iniciar el pago. Intenta de nuevo.');
      setProcesandoPago(false);
    }
  };

  // ── Cargar datos del negocio + sedes ─────────────────────
  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const negocioId = localStorage.getItem('negocio_id');
        const [resPlan, resSedes] = await Promise.all([
          api.get(`/negocios/${negocioId}/`),
          api.get(`/sedes/`, { params: { negocio_id: negocioId } }),
        ]);
        const negocio = resPlan.data;
        setPlanData(negocio);
        setUsageData({
          sedes_usadas: resSedes.data?.count ?? resSedes.data?.length ?? 0,
          sedes_max:    negocio.plan_detalles?.max_sedes ?? 1,
        });
      } catch (e) {
        setError('No se pudo cargar la información del plan.');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  // ── Cargar planes disponibles solo cuando se abre la sección ──
  useEffect(() => {
    if (seccion !== 'planes' || planes.length > 0) return;
    const fetchPlanes = async () => {
      setCargandoPlanes(true);
      try {
        const res = await api.get('/planes-saas/');
        const data = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
        setPlanes(data.map(enriquecerPlan));
      } catch {
        setPlanes([]);
      } finally {
        setCargandoPlanes(false);
      }
    };
    fetchPlanes();
  }, [seccion]);

  // ── Cargar historial solo cuando se abre la sección ──────
  useEffect(() => {
    if (seccion !== 'historial' || historial.length > 0) return;
    const fetchHistorial = async () => {
      setCargandoHist(true);
      setErrorHist(null);
      try {
        const negocioId = localStorage.getItem('negocio_id');
        const res = await api.get(`/pagos-suscripcion/`, { params: { negocio_id: negocioId } });
        const data = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
        setHistorial(data);
      } catch {
        setErrorHist('No se pudo cargar el historial de pagos.');
      } finally {
        setCargandoHist(false);
      }
    };
    fetchHistorial();
  }, [seccion]);

  // ── Al volver de MercadoPago (?status=success): el webhook confirma
  //    asíncronamente, así que hacemos polling al estado de suscripción ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') !== 'success') return;

    const limpiarUrl = () => {
      ['status', 'pago', 'collection_status', 'payment_id',
       'preference_id', 'merchant_order_id'].forEach((k) => params.delete(k));
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    };

    setVerificandoPago(true);
    let intentos = 0;
    const intervalo = setInterval(async () => {
      intentos += 1;
      try {
        const res = await getEstadoSuscripcion();
        if (res.data?.estado === 'activo') {
          clearInterval(intervalo);
          setVerificandoPago(false);
          limpiarUrl();
          const negocioId = localStorage.getItem('negocio_id');
          const resPlan = await api.get(`/negocios/${negocioId}/`);
          setPlanData(resPlan.data);
          return;
        }
      } catch { /* reintenta */ }
      if (intentos >= 10) {          // ~30s
        clearInterval(intervalo);
        setVerificandoPago(false);
        limpiarUrl();
      }
    }, 3000);

    return () => clearInterval(intervalo);
  }, []);

  // ── Estados de carga / error ─────────────────────────────
  if (cargando) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 size={32} className="animate-spin" style={{ color: colorPrimario }} />
      <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Cargando plan...</p>
    </div>
  );

  if (error) return (
    <div className={`p-8 rounded-3xl border flex items-center gap-4 ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
      <AlertTriangle size={24} className="text-red-500 shrink-0" />
      <div>
        <p className={`font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Error al cargar el plan</p>
        <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{error}</p>
      </div>
    </div>
  );

  const plan          = planData?.plan_detalles;
  const dias          = diasRestantes(planData?.fin_prueba);
  // fin_prueba ya pasó → no "en prueba", simplemente tiene plan activo normal
  const enPrueba      = dias !== null && dias > 0 && planData?.activo && !planData?.activo_pago;
  const plazoUrgente  = enPrueba && dias <= 5;

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ── Verificación de pago al volver de MercadoPago ──── */}
      {verificandoPago && (
        <div className="p-4 rounded-2xl border flex items-center gap-3 bg-amber-500/10 border-amber-500/30">
          <Loader2 size={18} className="animate-spin text-amber-500 shrink-0" />
          <p className={`text-sm font-bold ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>
            Verificando tu pago… esto puede tardar unos segundos.
          </p>
        </div>
      )}

      {/* ── SUB-NAVEGACIÓN ────────────────────────────────── */}
      <div className={`flex gap-1 p-1 rounded-2xl w-fit ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}>
        {[
          { id: 'resumen',  label: 'Resumen',  icon: Rocket    },
          { id: 'planes',   label: 'Planes',   icon: Sparkles  },
          { id: 'historial',label: 'Historial',icon: Receipt   },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSeccion(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              seccion === id
                ? 'text-white shadow-md'
                : isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-400 hover:text-gray-700'
            }`}
            style={seccion === id ? { backgroundColor: colorPrimario } : {}}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN: RESUMEN
      ══════════════════════════════════════════════════════ */}
      {seccion === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Tarjeta principal del plan ────────────────── */}
          <div className={`lg:col-span-2 p-6 md:p-8 rounded-[2rem] border shadow-sm overflow-hidden relative ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>

            {/* Fondo decorativo */}
            <div
              className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-5 pointer-events-none"
              style={{ backgroundColor: colorPrimario }}
            />

            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: colorPrimario + '20', color: colorPrimario }}>
                  <Rocket size={26} />
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                    Plan Actual
                  </p>
                  <h3 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {plan?.nombre ?? 'Sin plan asignado'}
                  </h3>
                </div>
              </div>

              {/* Badge estado */}
              {enPrueba ? (
                <span className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-500 border border-amber-500/20">
                  Demo
                </span>
              ) : planData?.activo ? (
                <span className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-500/15 text-green-500 border border-green-500/20">
                  Activo
                </span>
              ) : (
                <span className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/15 text-red-500 border border-red-500/20">
                  Inactivo
                </span>
              )}
            </div>

            {/* Precio */}
            <div className="flex items-end gap-2 mb-6">
              <span className={`text-4xl font-black tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                S/ {parseFloat(plan?.precio_mensual ?? 0).toFixed(2)}
              </span>
              <span className={`text-sm font-bold pb-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>/mes</span>
            </div>

            {/* Alerta prueba */}
            {enPrueba && (
              <div className={`flex items-center gap-3 p-4 rounded-2xl mb-6 border ${
                plazoUrgente
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                {plazoUrgente
                  ? <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  : <Clock size={16} className="text-amber-500 shrink-0" />
                }
                <div>
                  <p className={`text-xs font-black ${plazoUrgente ? 'text-red-500' : 'text-amber-500'}`}>
                    {plazoUrgente
                      ? `⚠️ Solo quedan ${dias} días de prueba`
                      : `Período de prueba: ${dias} días restantes`}
                  </p>
                  <p className={`text-[10px] font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                    Vence el {new Date(planData?.fin_prueba).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => setSeccion('planes')}
                  className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all hover:brightness-110"
                  style={{ backgroundColor: plazoUrgente ? '#ef4444' : '#f59e0b' }}
                >
                  Contratar <ArrowRight size={10} />
                </button>
              </div>
            )}

            {/* Módulos del plan */}
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                Módulos incluidos en tu plan
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MODULOS_META.map(({ key, label, icon, color }) => (
                  <ChipModulo
                    key={key}
                    label={label}
                    activo={plan?.[key] ?? false}
                    icon={icon}
                    color={color}
                    isDark={isDark}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Columna derecha ───────────────────────────── */}
          <div className="space-y-6">

            {/* Uso de recursos */}
            <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}>
                  <CalendarClock size={18} />
                </div>
                <h4 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Uso de recursos
                </h4>
              </div>
              <div className="space-y-3">
                <BarraUso
                  label="Sedes activas"
                  icon={Building2}
                  usado={usageData?.sedes_usadas ?? 0}
                  maximo={usageData?.sedes_max ?? 1}
                  color={colorPrimario}
                  isDark={isDark}
                />
                {/* Fácil de extender cuando el backend devuelva más métricas */}
              </div>
            </div>

            {/* CTA upgrade */}
            {(!plan || plan.nombre?.toLowerCase() !== 'elite') && (
              <div
                className="p-6 rounded-[2rem] border"
                style={{ background: `linear-gradient(135deg, ${colorPrimario}18 0%, ${colorPrimario}08 100%)`, borderColor: colorPrimario + '30' }}
              >
                <Crown size={22} style={{ color: colorPrimario }} className="mb-3" />
                <p className={`text-sm font-black mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ¿Quieres más potencia?
                </p>
                <p className={`text-xs mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  Desbloquea todos los módulos, más sedes y ML predictivo.
                </p>
                <button
                  onClick={() => setSeccion('planes')}
                  className="w-full py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-95"
                  style={{ backgroundColor: colorPrimario }}
                >
                  Ver planes <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SECCIÓN: PLANES DISPONIBLES
      ══════════════════════════════════════════════════════ */}
      {seccion === 'planes' && (
        <div className="animate-fadeIn">
          {cargandoPlanes ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 size={28} className="animate-spin" style={{ color: colorPrimario }} />
              <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                Cargando planes...
              </p>
            </div>
          ) : planes.length === 0 ? (
            <div className={`p-8 rounded-3xl border flex items-center gap-4 ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
              <AlertTriangle size={20} className="text-amber-500 shrink-0" />
              <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                No se pudieron cargar los planes. Intenta nuevamente.
              </p>
              <button
                onClick={() => setPlanes([])} // resetea para re-fetch
                className="ml-auto text-xs font-black px-3 py-1.5 rounded-xl"
                style={{ backgroundColor: colorPrimario + '20', color: colorPrimario }}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className={`grid gap-6 ${planes.length <= 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {planes.map((p) => {
                const esActual = planData?.plan_detalles?.id === p.id;
                const IconPlan = p.icon;
                // El plan del medio (índice 1) es el "popular" si hay 3+
                const esPopular = planes.length >= 3 && planes.indexOf(p) === Math.floor(planes.length / 2);

                return (
                  <div
                    key={p.id}
                    className={`relative p-6 rounded-[2rem] border shadow-sm flex flex-col transition-all ${
                      esActual
                        ? ''
                        : isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'
                    }`}
                    style={esActual ? {
                      borderColor: colorPrimario + '60',
                      background: isDark
                        ? `linear-gradient(160deg, ${colorPrimario}12 0%, #111 100%)`
                        : `linear-gradient(160deg, ${colorPrimario}08 0%, #fff 100%)`,
                    } : esPopular ? {
                      borderColor: p.color + '50',
                      background: isDark ? `linear-gradient(160deg, ${p.color}10 0%, #111 100%)` : `linear-gradient(160deg, ${p.color}06 0%, #fff 100%)`,
                    } : {}}
                  >
                    {/* Badge popular */}
                    {esPopular && !esActual && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg whitespace-nowrap"
                        style={{ backgroundColor: p.color }}
                      >
                        Más popular
                      </div>
                    )}

                    {/* Badge plan actual */}
                    {esActual && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg whitespace-nowrap"
                        style={{ backgroundColor: colorPrimario }}
                      >
                        ✓ Tu plan actual
                      </div>
                    )}

                    {/* Cabecera */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: p.color + '20', color: p.color }}
                      >
                        <IconPlan size={18} />
                      </div>
                      <div>
                        <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {p.nombre}
                        </p>
                      </div>
                    </div>

                    {/* Precio */}
                    <div className="mb-5">
                      <span className={`text-3xl font-black tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        S/ {parseFloat(p.precio_mensual).toFixed(2)}
                      </span>
                      <span className={`text-xs font-bold ml-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                        /mes
                      </span>
                    </div>

                    {/* Sedes */}
                    <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50'}`}>
                      <Building2 size={13} style={{ color: p.color }} />
                      <span className={`text-xs font-bold ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
                        Hasta {p.max_sedes} {p.max_sedes === 1 ? 'sede' : 'sedes'}
                      </span>
                    </div>

                    {/* Módulos incluidos */}
                    <div className="space-y-2 flex-1 mb-6">
                      {MODULOS_META.map(({ key, label, icon: Icon, color }) => {
                        const incluido = p[key] === true;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-2 text-xs font-bold ${
                              incluido
                                ? isDark ? 'text-neutral-200' : 'text-gray-700'
                                : isDark ? 'text-neutral-600 opacity-40' : 'text-gray-300'
                            }`}
                          >
                            {incluido
                              ? <CheckCircle2 size={12} style={{ color: p.color }} />
                              : <XCircle size={12} />
                            }
                            <Icon size={11} style={{ color: incluido ? color : undefined }} />
                            {label}
                          </div>
                        );
                      })}
                    </div>

                    {/* CTA */}
                    <button
                      disabled={esActual || procesandoPago}
                      className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={esActual
                        ? { backgroundColor: isDark ? '#2a2a2a' : '#e5e7eb', color: isDark ? '#555' : '#aaa' }
                        : { backgroundColor: p.color, color: '#fff' }
                      }
                      onClick={() => handlePagar(p.id)}
                    >
                      {procesandoPago
                        ? <><Loader2 size={12} className="animate-spin" /> Redirigiendo…</>
                        : esActual
                          ? 'Plan actual'
                          : <>{`Contratar ${p.nombre}`}<ArrowRight size={12} /></>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Erp_PagoManual isDark={isDark} colorPrimario={colorPrimario} />

      {/* ══════════════════════════════════════════════════════
          SECCIÓN: HISTORIAL DE PAGOS
      ══════════════════════════════════════════════════════ */}
      {seccion === 'historial' && (
        <div className={`p-6 md:p-8 rounded-[2rem] border shadow-sm animate-fadeIn ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>

          {/* Cabecera */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}>
              <CreditCard size={18} />
            </div>
            <h4 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Historial de pagos
            </h4>
          </div>

          {/* Estado: cargando */}
          {cargandoHist && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="animate-spin" style={{ color: colorPrimario }} />
              <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                Cargando historial...
              </p>
            </div>
          )}

          {/* Estado: error */}
          {!cargandoHist && errorHist && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-400 flex-1">{errorHist}</p>
              <button
                onClick={() => { setHistorial([]); setErrorHist(null); setSeccion('resumen'); setTimeout(() => setSeccion('historial'), 50); }}
                className="text-xs font-black px-3 py-1.5 rounded-xl"
                style={{ backgroundColor: colorPrimario + '20', color: colorPrimario }}
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Estado: vacío */}
          {!cargandoHist && !errorHist && historial.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}>
                <Receipt size={28} className={isDark ? 'text-neutral-600' : 'text-gray-300'} />
              </div>
              <div className="text-center">
                <p className={`font-black text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  Sin registros de pago aún
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                  Los pagos aparecerán aquí una vez contrates un plan
                </p>
              </div>
            </div>
          )}

          {/* Estado: con datos */}
          {!cargandoHist && !errorHist && historial.length > 0 && (
            <div className="space-y-3">
              {/* Resumen rápido */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  {
                    label: 'Total pagado',
                    valor: `S/ ${historial.filter(p => p.estado === 'pagado').reduce((acc, p) => acc + parseFloat(p.monto), 0).toFixed(2)}`,
                    color: '#10b981',
                  },
                  {
                    label: 'Último pago',
                    valor: historial.find(p => p.estado === 'pagado')
                      ? new Date(historial.find(p => p.estado === 'pagado').fecha_pago).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                      : '—',
                    color: colorPrimario,
                  },
                  {
                    label: 'Pendientes',
                    valor: historial.filter(p => p.estado === 'pendiente').length,
                    color: '#f59e0b',
                  },
                ].map(({ label, valor, color }) => (
                  <div key={label} className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-[#161616] border-[#2a2a2a]' : 'bg-gray-50 border-gray-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{label}</p>
                    <p className="text-lg font-black" style={{ color }}>{valor}</p>
                  </div>
                ))}
              </div>

              {/* Lista de pagos */}
              {historial.map((pago) => {
                const ESTADO_META = {
                  pagado:    { label: 'Pagado',    bg: 'bg-green-500/15',  text: 'text-green-500',  icon: CheckCircle2 },
                  pendiente: { label: 'Pendiente', bg: 'bg-amber-500/15',  text: 'text-amber-500',  icon: Clock        },
                  fallido:   { label: 'Fallido',   bg: 'bg-red-500/15',    text: 'text-red-500',    icon: XCircle      },
                  reembolsado:{ label: 'Reembolso',bg: 'bg-blue-500/15',   text: 'text-blue-400',   icon: Receipt      },
                };
                const meta     = ESTADO_META[pago.estado] ?? ESTADO_META.pendiente;
                const IconEstado = meta.icon;
                const fechaStr = new Date(pago.fecha_pago).toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'long', year: 'numeric'
                });

                return (
                  <div
                    key={pago.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isDark ? 'bg-[#161616] border-[#2a2a2a] hover:border-[#333]' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                  >
                    {/* Ícono estado */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <IconEstado size={16} className={meta.text} />
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {pago.plan_nombre ?? 'Plan'}
                        </p>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className={`text-[11px] font-bold mt-0.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                        {fechaStr}
                        {pago.periodo && ` · ${pago.periodo}`}
                        {pago.metodo_pago && ` · ${pago.metodo_pago}`}
                      </p>
                    </div>

                    {/* Monto */}
                    <p className={`text-sm font-black tabular-nums shrink-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      S/ {parseFloat(pago.monto).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}